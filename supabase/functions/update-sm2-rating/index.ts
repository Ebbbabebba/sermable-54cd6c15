import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { 
        headers: { 
          Authorization: authHeader 
        } 
      },
      auth: {
        persistSession: false
      }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { speechId, userRating, practiceSessionId } = await req.json();
    
    console.log('SM-2 Rating Update:', { speechId, userRating, practiceSessionId });

    // Verify user owns the speech
    const { data: speech, error: speechError } = await supabase
      .from('speeches')
      .select('user_id, learning_mode, goal_date')
      .eq('id', speechId)
      .single();

    if (speechError || !speech || speech.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized access to speech' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update practice session with user rating
    const { error: updateError } = await supabase
      .from('practice_sessions')
      .update({ user_rating: userRating })
      .eq('id', practiceSessionId);

    if (updateError) {
      console.error('Error updating practice session:', updateError);
      throw updateError;
    }

    // Call SM-2 schedule update function
    const { error: scheduleError } = await supabase.rpc('update_sm2_schedule', {
      p_speech_id: speechId,
      p_user_rating: userRating,
      p_session_date: new Date().toISOString()
    });

    if (scheduleError) {
      console.error('Error updating SM-2 schedule:', scheduleError);
      throw scheduleError;
    }

    // Get updated schedule for response
    const { data: schedule } = await supabase
      .from('schedules')
      .select('next_review_date, interval_days, card_state, ease_factor, learning_step')
      .eq('speech_id', speechId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Generate user-friendly message based on rating and new interval
    let message = '';
    const intervalMinutes = schedule?.interval_days || 0;
    const nextReview = new Date(schedule?.next_review_date);
    const cardState = schedule?.card_state || 'new';
    
    if (cardState === 'learning' || cardState === 'relearning') {
      if (intervalMinutes < 60) {
        message = `📚 Learning Phase: Review again in ${intervalMinutes} minute${intervalMinutes !== 1 ? 's' : ''}`;
      } else if (intervalMinutes < 1440) {
        message = `📚 Learning Phase: Review again in ${Math.round(intervalMinutes / 60)} hour${Math.round(intervalMinutes / 60) !== 1 ? 's' : ''}`;
      } else {
        message = `🎓 Graduating to Review Phase: Next review in ${Math.round(intervalMinutes / 1440)} day${Math.round(intervalMinutes / 1440) !== 1 ? 's' : ''}`;
      }
    } else {
      const days = Math.round(intervalMinutes / 1440);
      if (days === 0) {
        message = `🔄 Review again in ${Math.round(intervalMinutes / 60)} hour${Math.round(intervalMinutes / 60) !== 1 ? 's' : ''}`;
      } else if (days < 7) {
        message = `✅ Next review in ${days} day${days !== 1 ? 's' : ''}`;
      } else if (days < 30) {
        message = `🌟 Next review in ${Math.round(days / 7)} week${Math.round(days / 7) !== 1 ? 's' : ''}`;
      } else if (days < 365) {
        message = `🏆 Next review in ${Math.round(days / 30)} month${Math.round(days / 30) !== 1 ? 's' : ''}`;
      } else {
        message = `💎 Mastered! Next review in ${Math.round(days / 365)} year${Math.round(days / 365) !== 1 ? 's' : ''}`;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message,
        schedule: {
          nextReviewDate: schedule?.next_review_date,
          intervalMinutes: schedule?.interval_days,
          cardState: schedule?.card_state,
          easeFactor: schedule?.ease_factor,
          learningStep: schedule?.learning_step
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in update-sm2-rating:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
