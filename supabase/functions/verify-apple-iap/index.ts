// Verifies an Apple App Store In-App Purchase receipt and upgrades the user
// to premium on success. Called by the native iOS layer after StoreKit
// confirms a purchase, OR by the web layer when the iOS bridge forwards
// the receipt via window.dispatchEvent('iap-purchase-success', { receipt }).
//
// Flow:
//   1. Verify caller's JWT to get user_id.
//   2. POST receipt to Apple production verifyReceipt.
//   3. If status 21007 (sandbox receipt), retry against sandbox endpoint.
//   4. Validate bundle id and look at latest_receipt_info to determine tier.
//   5. Upsert subscriptions row + flip profiles.subscription_tier.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const APPLE_PROD = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';

const BodySchema = z.object({
  receipt_data: z.string().min(20), // base64 receipt from StoreKit
  product_id: z.string().optional(), // hint from native side
});

interface AppleVerifyResponse {
  status: number;
  environment?: 'Production' | 'Sandbox';
  receipt?: { bundle_id?: string };
  latest_receipt_info?: Array<{
    product_id: string;
    transaction_id: string;
    original_transaction_id: string;
    expires_date_ms?: string;
    purchase_date_ms?: string;
    cancellation_date_ms?: string;
  }>;
  pending_renewal_info?: Array<{
    auto_renew_status?: string;
    expiration_intent?: string;
  }>;
}

async function verifyWithApple(
  receiptData: string,
  password: string,
  endpoint: string,
): Promise<AppleVerifyResponse> {
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receiptData,
      password,
      'exclude-old-transactions': true,
    }),
  });
  return (await resp.json()) as AppleVerifyResponse;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ---- Auth ----
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    // ---- Validate body ----
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { receipt_data } = parsed.data;

    const sharedSecret = Deno.env.get('APPLE_IAP_SHARED_SECRET');
    const expectedBundleId = Deno.env.get('APPLE_IAP_BUNDLE_ID') ?? 'com.ebba.sermable';
    if (!sharedSecret) {
      console.error('APPLE_IAP_SHARED_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Apple verification (prod, fallback to sandbox) ----
    let result = await verifyWithApple(receipt_data, sharedSecret, APPLE_PROD);
    if (result.status === 21007) {
      console.log('Sandbox receipt detected, retrying against sandbox endpoint');
      result = await verifyWithApple(receipt_data, sharedSecret, APPLE_SANDBOX);
    }

    if (result.status !== 0) {
      console.error('Apple verifyReceipt failed', { status: result.status });
      return new Response(
        JSON.stringify({ error: 'Receipt verification failed', apple_status: result.status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate bundle id
    const bundleId = result.receipt?.bundle_id;
    if (bundleId && bundleId !== expectedBundleId) {
      console.error('Bundle id mismatch', { bundleId, expectedBundleId });
      return new Response(JSON.stringify({ error: 'Bundle mismatch' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pick the most recent active subscription transaction
    const infos = (result.latest_receipt_info ?? []).slice().sort((a, b) => {
      const ax = Number(a.expires_date_ms ?? a.purchase_date_ms ?? 0);
      const bx = Number(b.expires_date_ms ?? b.purchase_date_ms ?? 0);
      return bx - ax;
    });
    const latest = infos[0];
    if (!latest) {
      return new Response(JSON.stringify({ error: 'No transactions in receipt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = Date.now();
    const expiresMs = latest.expires_date_ms ? Number(latest.expires_date_ms) : null;
    const isActive =
      !latest.cancellation_date_ms && (expiresMs == null || expiresMs > now);

    // ---- DB updates (service role) ----
    const admin = createClient(supabaseUrl, serviceKey);
    const env = result.environment === 'Sandbox' ? 'sandbox' : 'live';
    const periodStart = latest.purchase_date_ms
      ? new Date(Number(latest.purchase_date_ms)).toISOString()
      : new Date().toISOString();
    const periodEnd = expiresMs ? new Date(expiresMs).toISOString() : null;

    // Upsert subscription row keyed by apple original_transaction_id
    // (stored in paddle_subscription_id since the column is unique not null).
    const subscriptionId = `apple_${latest.original_transaction_id}`;
    const { error: subErr } = await admin
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          paddle_subscription_id: subscriptionId,
          paddle_customer_id: `apple_${userId}`,
          product_id: latest.product_id,
          price_id: latest.product_id,
          status: isActive ? 'active' : 'canceled',
          environment: env,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at_period_end: !!latest.cancellation_date_ms,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'paddle_subscription_id' },
      );
    if (subErr) {
      console.error('Failed to upsert subscription', subErr);
      return new Response(JSON.stringify({ error: 'DB error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update profile tier
    const tier = isActive ? 'regular' : 'free';
    const { error: profErr } = await admin
      .from('profiles')
      .update({ subscription_tier: tier, subscription_status: isActive ? 'active' : 'inactive' })
      .eq('id', userId);
    if (profErr) {
      console.error('Failed to update profile tier', profErr);
      return new Response(JSON.stringify({ error: 'Profile update failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('IAP verified', { userId, env, productId: latest.product_id, isActive });

    return new Response(
      JSON.stringify({
        success: true,
        tier,
        active: isActive,
        environment: env,
        product_id: latest.product_id,
        expires_at: periodEnd,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('verify-apple-iap error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
