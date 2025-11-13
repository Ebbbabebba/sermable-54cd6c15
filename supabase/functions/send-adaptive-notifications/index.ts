import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdaptiveNotification {
  user_id: string;
  push_token: string;
  push_platform: 'ios' | 'android' | 'web';
  speech_id: string;
  speech_title: string;
  days_until_deadline: number;
  frequency_multiplier: number;
  consecutive_struggles: number;
  last_accuracy: number;
}

async function sendFCMNotification(token: string, title: string, body: string, data: any) {
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
          badge: 1,
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Sending adaptive notifications...');
    
    // Get speeches requiring practice with adaptive scheduling
    const { data: speeches, error: speechError } = await supabase
      .from('speeches')
      .select(`
        id,
        title,
        goal_date,
        user_id,
        consecutive_struggles,
        last_accuracy,
        performance_trend,
        profiles!inner(
          push_token,
          push_platform,
          notifications_enabled
        ),
        schedules!inner(
          next_review_date,
          adaptive_frequency_multiplier
        )
      `)
      .eq('profiles.notifications_enabled', true)
      .not('profiles.push_token', 'is', null)
      .lte('schedules.next_review_date', new Date().toISOString());

    if (speechError) {
      console.error('Error fetching speeches:', speechError);
      throw speechError;
    }

    console.log(`Found ${speeches?.length || 0} speeches requiring adaptive practice`);

    const results = [];

    // Send personalized notifications based on adaptive learning data
    for (const speech of (speeches || [])) {
      const profile = Array.isArray(speech.profiles) ? speech.profiles[0] : speech.profiles;
      const schedule = Array.isArray(speech.schedules) ? speech.schedules[0] : speech.schedules;
      
      if (!profile || !schedule) continue;

      const daysUntilDeadline = Math.ceil(
        (new Date(speech.goal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      let title = '';
      let body = '';
      let priority = 'normal';

      // Adaptive notification content based on context
      if (speech.consecutive_struggles >= 2) {
        // Struggling - needs more practice
        title = '⚠️ Important Practice Session';
        body = `${speech.title}: Multiple practice sessions needed. Your presentation is in ${daysUntilDeadline} days.`;
        priority = 'high';
      } else if (daysUntilDeadline <= 3) {
        // Urgent - deadline approaching
        title = '🔥 Final Practice Session';
        body = `${speech.title}: ${daysUntilDeadline} ${daysUntilDeadline === 1 ? 'day' : 'days'} until your presentation! Time for final practice.`;
        priority = 'high';
      } else if (daysUntilDeadline <= 7) {
        // Important - week before
        title = '⏰ Practice Session Due';
        body = `${speech.title}: ${daysUntilDeadline} days to go. Stay consistent with your practice!`;
        priority = 'high';
      } else if (speech.last_accuracy < 75) {
        // Performance needs improvement
        title = '📊 Practice Recommended';
        body = `${speech.title}: Let's improve your accuracy. Practice session ready.`;
        priority = 'normal';
      } else {
        // Regular practice
        title = '✨ Practice Session Ready';
        body = `${speech.title}: Time for your scheduled practice. Keep up the great work!`;
        priority = 'normal';
      }

      const notificationData = {
        type: 'adaptive_practice',
        speech_id: speech.id,
        days_until_deadline: daysUntilDeadline,
        frequency_multiplier: schedule.adaptive_frequency_multiplier,
        priority,
      };

      const result = await sendFCMNotification(
        profile.push_token,
        title,
        body,
        notificationData
      );

      results.push({
        user_id: speech.user_id,
        speech_id: speech.id,
        success: result.success,
        error: result.error,
      });

      console.log(`Notification sent to user ${speech.user_id} for speech ${speech.title}:`, result.success ? 'Success' : result.error);
    }

    console.log('Adaptive notifications complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-adaptive-notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
