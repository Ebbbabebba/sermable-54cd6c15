import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPaddleClient, type PaddleEnv } from '../_shared/paddle.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { environment } = await req.json();
    const env = (environment || 'sandbox') as PaddleEnv;

    // Get user's subscription
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id, status")
      .eq("user_id", user.id)
      .eq("environment", env)
      .single();

    if (subError || !sub) {
      return new Response(JSON.stringify({ error: "No subscription found" }), { status: 404, headers: corsHeaders });
    }

    if (sub.status === "canceled") {
      return new Response(JSON.stringify({ error: "Subscription already canceled" }), { status: 400, headers: corsHeaders });
    }

    // Cancel immediately via Paddle API
    const paddle = getPaddleClient(env);
    await paddle.subscriptions.cancel(sub.paddle_subscription_id, { effectiveFrom: "immediately" });

    // Update local DB immediately
    await supabase
      .from("subscriptions")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("paddle_subscription_id", sub.paddle_subscription_id)
      .eq("environment", env);

    // Revoke tier immediately
    await supabase
      .from("profiles")
      .update({ subscription_tier: "free", subscription_status: "inactive" })
      .eq("id", user.id);

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (error) {
    console.error("Cancel error:", error);
    return new Response(JSON.stringify({ error: "Failed to cancel subscription" }), { status: 500, headers: corsHeaders });
  }
});
