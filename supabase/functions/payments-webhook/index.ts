import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWebhook, EventName, type PaddleEnv } from '../_shared/paddle.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Map Paddle product IDs to subscription_tier enum values
function getSubscriptionTier(productId: string): 'student' | 'regular' | 'enterprise' {
  switch (productId) {
    case 'student_plan': return 'student';
    case 'regular_plan': return 'regular';
    default: return 'regular';
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get('env') || 'sandbox') as PaddleEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log('Received event:', event.eventType, 'env:', env);

    switch (event.eventType) {
      case EventName.SubscriptionCreated:
        await handleSubscriptionCreated(event.data, env);
        break;
      case EventName.SubscriptionUpdated:
        await handleSubscriptionUpdated(event.data, env);
        break;
      case EventName.SubscriptionCanceled:
        await handleSubscriptionCanceled(event.data, env);
        break;
      case EventName.TransactionCompleted:
        console.log('Transaction completed:', event.data.id, 'env:', env);
        break;
      case EventName.TransactionPaymentFailed:
        console.log('Payment failed:', event.data.id, 'env:', env);
        break;
      default:
        console.log('Unhandled event:', event.eventType);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Webhook error', { status: 400 });
  }
});

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;

  const userId = customData?.userId;
  if (!userId) {
    console.error('No userId in customData');
    return;
  }

  const item = items[0];
  const priceId = item.price.importMeta?.externalId || item.price.id;
  const productId = item.product.importMeta?.externalId || item.product.id;

  // Upsert subscription record
  await supabase.from('subscriptions').upsert({
    user_id: userId,
    paddle_subscription_id: id,
    paddle_customer_id: customerId,
    product_id: productId,
    price_id: priceId,
    status: status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    environment: env,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id,environment',
  });

  // Update profile subscription_tier
  const tier = getSubscriptionTier(productId);
  await supabase.from('profiles').update({
    subscription_tier: tier,
    subscription_status: 'active',
  }).eq('id', userId);

  console.log(`Subscription created for user ${userId}, tier: ${tier}`);
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange, items, customData } = data;

  // Update subscription record
  await supabase.from('subscriptions')
    .update({
      status: status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === 'cancel',
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', id)
    .eq('environment', env);

  // If status changed to canceled or paused, revoke immediately
  if (status === 'canceled' || status === 'paused') {
    // Find the user from subscription
    const { data: sub } = await supabase.from('subscriptions')
      .select('user_id')
      .eq('paddle_subscription_id', id)
      .eq('environment', env)
      .single();

    if (sub) {
      await supabase.from('profiles').update({
        subscription_tier: 'free',
        subscription_status: 'inactive',
      }).eq('id', sub.user_id);

      console.log(`Subscription revoked immediately for user ${sub.user_id}`);
    }
  }

  // If items changed (upgrade/downgrade), update tier
  if (items?.length > 0 && status === 'active') {
    const productId = items[0].product.importMeta?.externalId || items[0].product.id;
    const tier = getSubscriptionTier(productId);

    const { data: sub } = await supabase.from('subscriptions')
      .select('user_id')
      .eq('paddle_subscription_id', id)
      .eq('environment', env)
      .single();

    if (sub) {
      await supabase.from('profiles').update({
        subscription_tier: tier,
      }).eq('id', sub.user_id);
    }
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  // Update subscription status
  await supabase.from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', data.id)
    .eq('environment', env);

  // Revoke immediately per user preference
  const { data: sub } = await supabase.from('subscriptions')
    .select('user_id')
    .eq('paddle_subscription_id', data.id)
    .eq('environment', env)
    .single();

  if (sub) {
    await supabase.from('profiles').update({
      subscription_tier: 'free',
      subscription_status: 'inactive',
    }).eq('id', sub.user_id);

    console.log(`Subscription canceled and revoked for user ${sub.user_id}`);
  }
}
