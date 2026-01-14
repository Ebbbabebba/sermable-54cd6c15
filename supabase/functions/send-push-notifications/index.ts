import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserWithDueReviews {
  user_id: string;
  push_token: string;
  push_platform: 'ios' | 'android' | 'web';
  due_count: number;
  speech_titles: string[];
}

async function sendIOSNotification(token: string, title: string, body: string, data: any) {
  // APNs requires Apple Developer account setup
  // This is a placeholder - you'll need to configure APNs with your certificates
  console.log('iOS notification would be sent:', { token, title, body, data });
  
  // In production, you would use node-apn or similar service
  // For now, we'll use Firebase Cloud Messaging which supports both iOS and Android
  return sendFCMNotification(token, title, body, data);
}

async function sendAndroidNotification(token: string, title: string, body: string, data: any) {
  return sendFCMNotification(token, title, body, data);
}

async function sendFCMNotification(token: string, title: string, body: string, data: any) {
  // Firebase Cloud Messaging
  // Requires FCM_SERVER_KEY secret to be set
  const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
  
  if (!fcmServerKey) {
    console.error('FCM_SERVER_KEY not configured');
    return { success: false, error: 'FCM not configured' };
  }

  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${fcmServerKey}`,
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title,
          body,
          sound: 'default',
          badge: data.due_count,
        },
        data,
        priority: 'high',
      }),
    });

    const result = await response.json();
    console.log('FCM response:', result);
    
    return { success: response.ok, result };
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Scheduler secret validation for scheduled jobs
    // This function should only be called by scheduled jobs or admin with secret
    const schedulerSecret = Deno.env.get('SCHEDULER_SECRET');
    const providedSecret = req.headers.get('x-scheduler-secret');
    
    // SECURITY: SCHEDULER_SECRET must be configured - reject all requests if not set
    if (!schedulerSecret) {
      console.error('SCHEDULER_SECRET not configured - rejecting request for security');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (providedSecret !== schedulerSecret) {
      console.error('Unauthorized scheduler access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching users with due reviews...');
    
    // Get all users with due reviews
    const { data: usersWithDueReviews, error } = await supabase
      .rpc('get_users_with_due_reviews');

    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }

    console.log(`Found ${usersWithDueReviews?.length || 0} users with due reviews`);

    const results = [];

    // Send notifications to each user
    for (const user of (usersWithDueReviews as UserWithDueReviews[] || [])) {
      const title = user.due_count === 1 
        ? '📝 Speech Review Due!'
        : `📝 ${user.due_count} Speeches Due for Review!`;
      
      const body = user.due_count === 1
        ? `Time to practice: ${user.speech_titles[0]}`
        : `Practice these speeches: ${user.speech_titles.slice(0, 2).join(', ')}${user.due_count > 2 ? ` and ${user.due_count - 2} more` : ''}`;

      const notificationData = {
        type: 'speech_review_due',
        due_count: user.due_count,
        user_id: user.user_id,
      };

      let result;
      if (user.push_platform === 'ios') {
        result = await sendIOSNotification(user.push_token, title, body, notificationData);
      } else if (user.push_platform === 'android') {
        result = await sendAndroidNotification(user.push_token, title, body, notificationData);
      }

      results.push({
        user_id: user.user_id,
        platform: user.push_platform,
        success: result?.success || false,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-push-notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
