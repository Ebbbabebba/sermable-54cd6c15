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

    const { speechId, sessionAccuracy } = await req.json();
    
    console.log('Updating adaptive learning for speech:', speechId, 'Session accuracy:', sessionAccuracy);

    // Verify user owns the speech
    const { data: speech, error: speechError } = await supabase
      .from('speeches')
      .select('user_id, goal_date, last_accuracy, performance_trend, consecutive_struggles')
      .eq('id', speechId)
      .single();

    if (speechError || !speech || speech.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized access to speech' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate performance trend (compare current to last session)
    const lastAccuracy = speech.last_accuracy || 70;
    const accuracyDelta = sessionAccuracy - lastAccuracy;
    
    // Performance trend: -1 (declining) to +1 (improving)
    // Normalize the delta to be between -1 and 1
    const newTrend = Math.max(-1, Math.min(1, accuracyDelta / 30));
    
    // Track consecutive struggles (accuracy < 70%)
    let consecutiveStruggles = speech.consecutive_struggles || 0;
    if (sessionAccuracy < 70) {
      consecutiveStruggles += 1;
    } else if (sessionAccuracy >= 80) {
      consecutiveStruggles = Math.max(0, consecutiveStruggles - 1);
    }
    
    // Calculate days until deadline
    const goalDate = new Date(speech.goal_date);
    const today = new Date();
    const daysUntilDeadline = Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log('Performance analysis:', {
      lastAccuracy,
      sessionAccuracy,
      accuracyDelta,
      newTrend,
      consecutiveStruggles,
      daysUntilDeadline
    });

    // Calculate new word visibility using database function
    const { data: visibilityData, error: visibilityError } = await supabase
      .rpc('calculate_word_visibility', {
        p_speech_id: speechId,
        p_goal_date: speech.goal_date,
        p_performance_trend: newTrend,
        p_consecutive_struggles: consecutiveStruggles
      });

    if (visibilityError) {
      console.error('Error calculating word visibility:', visibilityError);
    }

    const newVisibility = visibilityData || 100;
    console.log('Calculated word visibility:', newVisibility + '%');

    // Calculate adaptive practice frequency multiplier
    const { data: frequencyData, error: frequencyError } = await supabase
      .rpc('calculate_practice_frequency', {
        p_days_until_deadline: daysUntilDeadline,
        p_performance_trend: newTrend,
        p_last_accuracy: sessionAccuracy,
        p_consecutive_struggles: consecutiveStruggles
      });

    if (frequencyError) {
      console.error('Error calculating frequency:', frequencyError);
    }

    const frequencyMultiplier = frequencyData || 1.0;
    console.log('Adaptive frequency multiplier:', frequencyMultiplier + 'x');

    // Update speech performance tracking
    const { error: updateError } = await supabase
      .from('speeches')
      .update({
        last_accuracy: sessionAccuracy,
        performance_trend: newTrend,
        consecutive_struggles: consecutiveStruggles,
        base_word_visibility_percent: newVisibility
      })
      .eq('id', speechId);

    if (updateError) {
      console.error('Error updating speech:', updateError);
      throw updateError;
    }

    // Update or create schedule with adaptive frequency
    const baseIntervalDays = 1; // Default base interval
    const adaptiveInterval = Math.max(0.25, baseIntervalDays / frequencyMultiplier); // Convert multiplier to days (min 6 hours)
    const nextReviewDate = new Date(Date.now() + adaptiveInterval * 24 * 60 * 60 * 1000);

    const { error: scheduleError } = await supabase
      .from('schedules')
      .upsert({
        speech_id: speechId,
        session_date: new Date().toISOString().split('T')[0],
        completed: true,
        next_review_date: nextReviewDate.toISOString(),
        interval_days: Math.ceil(adaptiveInterval),
        adaptive_frequency_multiplier: frequencyMultiplier,
        days_until_deadline: daysUntilDeadline,
        last_reviewed_at: new Date().toISOString()
      }, {
        onConflict: 'speech_id'
      });

    if (scheduleError) {
      console.error('Error updating schedule:', scheduleError);
    }

    // Generate recommendation message
    let recommendation = '';
    if (consecutiveStruggles >= 2) {
      recommendation = `⚠️ Performance needs attention. Practice ${Math.ceil(frequencyMultiplier)}x more frequently to improve before your deadline.`;
    } else if (daysUntilDeadline <= 7 && sessionAccuracy < 80) {
      recommendation = `⏰ Your presentation is in ${daysUntilDeadline} days. Practice daily to ensure you're ready!`;
    } else if (newVisibility < 30) {
      recommendation = `🎯 You're almost there! Only ${Math.round(newVisibility)}% of cue words remain visible.`;
    } else if (newTrend > 0.5) {
      recommendation = `📈 Great progress! Keep practicing to reach complete memorization.`;
    } else {
      recommendation = `✅ On track. Next practice session in ${Math.ceil(adaptiveInterval * 24)} hours.`;
    }

    console.log('Adaptive learning update complete');

    return new Response(
      JSON.stringify({
        success: true,
        wordVisibility: newVisibility,
        frequencyMultiplier,
        nextReviewDate: nextReviewDate.toISOString(),
        daysUntilDeadline,
        performanceTrend: newTrend,
        consecutiveStruggles,
        recommendation
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-adaptive-learning:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
