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
          notifications_enabled,
          practice_start_hour,
          practice_end_hour,
          timezone
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

      // Check if user is within their practice hours (sleep protection)
      const practiceStartHour = profile.practice_start_hour ?? 8;
      const practiceEndHour = profile.practice_end_hour ?? 22;
      const userTimezone = profile.timezone || 'UTC';
      
      // Get current hour in user's timezone
      let userLocalHour: number;
      try {
        const userLocalTime = new Date().toLocaleString('en-US', { 
          timeZone: userTimezone, 
          hour: 'numeric', 
          hour12: false 
        });
        userLocalHour = parseInt(userLocalTime, 10);
      } catch (e) {
        // Fallback to UTC if timezone is invalid
        userLocalHour = new Date().getUTCHours();
        console.warn(`Invalid timezone ${userTimezone}, falling back to UTC`);
      }
      
      // Skip notification if outside practice hours (sleep protection)
      const isWithinPracticeHours = userLocalHour >= practiceStartHour && userLocalHour < practiceEndHour;
      if (!isWithinPracticeHours) {
        console.log(`Skipping notification for user ${speech.user_id} - outside practice hours (${userLocalHour}:00, window: ${practiceStartHour}:00-${practiceEndHour}:00)`);
        continue;
      }

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
