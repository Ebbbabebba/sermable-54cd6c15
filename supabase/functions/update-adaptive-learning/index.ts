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

    const { speechId, sessionAccuracy, wordVisibilityPercent = 100 } = await req.json();
    
    console.log('Updating adaptive learning for speech:', speechId, 'Session accuracy:', sessionAccuracy, 'Word visibility:', wordVisibilityPercent + '%');
    
    // Calculate weighted accuracy based on script visibility
    // Full script (100%) → 20% weight, No notes (0-10%) → 100% weight
    let performanceWeight = 1.0;
    if (wordVisibilityPercent >= 80) {
      // Full script: 20% weight
      performanceWeight = 0.20;
    } else if (wordVisibilityPercent >= 60) {
      // Heavy notes: 50% weight
      performanceWeight = 0.50;
    } else if (wordVisibilityPercent >= 40) {
      // Moderate notes: 70% weight
      performanceWeight = 0.70;
    } else if (wordVisibilityPercent >= 20) {
      // Light notes: 85% weight
      performanceWeight = 0.85;
    } else {
      // Minimal/no notes: 100% weight
      performanceWeight = 1.00;
    }
    
    const weightedAccuracy = sessionAccuracy * performanceWeight;
    
    console.log('Performance weighting:', {
      rawAccuracy: sessionAccuracy,
      visibility: wordVisibilityPercent + '%',
      weight: (performanceWeight * 100) + '%',
      weightedAccuracy: weightedAccuracy.toFixed(1)
    });

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

    // Calculate performance trend (compare weighted current to last weighted session)
    const lastAccuracy = speech.last_accuracy || 70;
    const accuracyDelta = weightedAccuracy - lastAccuracy;
    
    // Performance trend: -1 (declining) to +1 (improving)
    // Normalize the delta to be between -1 and 1
    const newTrend = Math.max(-1, Math.min(1, accuracyDelta / 30));
    
    // Track consecutive struggles (weighted accuracy < 50%)
    let consecutiveStruggles = speech.consecutive_struggles || 0;
    if (weightedAccuracy < 50) {
      consecutiveStruggles += 1;
    } else if (weightedAccuracy >= 60) {
      consecutiveStruggles = Math.max(0, consecutiveStruggles - 1);
    }
    
    // Calculate days until deadline
    const goalDate = new Date(speech.goal_date);
    const today = new Date();
    const daysUntilDeadline = Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log('Performance analysis:', {
      lastAccuracy,
      rawAccuracy: sessionAccuracy,
      weightedAccuracy: weightedAccuracy.toFixed(1),
      accuracyDelta: accuracyDelta.toFixed(1),
      newTrend: newTrend.toFixed(2),
      consecutiveStruggles,
      daysUntilDeadline
    });

    // Calculate new word visibility using database function with weighted accuracy
    const { data: visibilityData, error: visibilityError } = await supabase
      .rpc('calculate_word_visibility', {
        p_speech_id: speechId,
        p_goal_date: speech.goal_date,
        p_performance_trend: newTrend,
        p_consecutive_struggles: consecutiveStruggles,
        p_weighted_accuracy: weightedAccuracy
      });

    if (visibilityError) {
      console.error('Error calculating word visibility:', visibilityError);
    }

    const newVisibility = visibilityData || 100;
    console.log('Calculated word visibility:', newVisibility + '%');

    // Get speech length for adaptive calculation
    const { data: speechData } = await supabase
      .from('speeches')
      .select('text_current')
      .eq('id', speechId)
      .single();
    
    const wordCount = speechData?.text_current?.split(/\s+/).length || 0;

    // Calculate adaptive practice frequency multiplier
    const { data: frequencyData, error: frequencyError } = await supabase
      .rpc('calculate_practice_frequency', {
        p_days_until_deadline: daysUntilDeadline,
        p_performance_trend: newTrend,
        p_last_accuracy: weightedAccuracy,
        p_consecutive_struggles: consecutiveStruggles,
        p_word_count: wordCount,
        p_word_visibility: newVisibility
      });

    if (frequencyError) {
      console.error('Error calculating frequency:', frequencyError);
    }

    const frequencyMultiplier = frequencyData || 1.0;
    console.log('Adaptive frequency multiplier:', frequencyMultiplier + 'x');

    // Update speech performance tracking (store weighted accuracy)
    const { error: updateError } = await supabase
      .from('speeches')
      .update({
        last_accuracy: weightedAccuracy,
        performance_trend: newTrend,
        consecutive_struggles: consecutiveStruggles,
        base_word_visibility_percent: newVisibility
      })
      .eq('id', speechId);

    if (updateError) {
      console.error('Error updating speech:', updateError);
      throw updateError;
    }

    // ============================================================
    // ADAPTIVE INTERVAL RULES (Based on Weighted Performance)
    // ============================================================
    // 1. High score + minimal notes (≥70% weighted, ≤30% visibility)
    //    → INCREASE interval (2-4 days) - True memorization achieved
    //
    // 2. High score + full script (≥80% raw, ≥70% visibility) 
    //    → KEEP SHORT interval (4-8 hours) - Just reading, not memorizing
    //
    // 3. Low weighted score (<50% weighted)
    //    → SHORTEN interval (2-6 hours) - Needs more practice
    //
    // 4. Deadline pressure overrides:
    //    - ≤2 days: Max 4 hours between sessions
    //    - ≤7 days: Max 12 hours between sessions
    // ============================================================
    
    // Calculate interval based on STRICT ADAPTATION RULES
    let adaptiveIntervalMinutes: number;
    const baseIntervalMinutes = 24 * 60; // 1 day in minutes
    
    // Rule 1: High score with little/no notes → INCREASE interval
    if (weightedAccuracy >= 70 && wordVisibilityPercent <= 30) {
      // Excellent true memorization: 2-4 days
      adaptiveIntervalMinutes = baseIntervalMinutes * Math.min(4, 2 + (weightedAccuracy - 70) / 15);
    }
    // Rule 2: High score with full script → KEEP interval SHORT
    else if (sessionAccuracy >= 80 && wordVisibilityPercent >= 70) {
      // Just reading well, not memorizing: 4-8 hours
      adaptiveIntervalMinutes = 4 * 60 + (sessionAccuracy - 80) * 12;
    }
    // Rule 3: Low score → SHORTEN interval
    else if (weightedAccuracy < 50) {
      // Struggling: 2-6 hours based on severity
      adaptiveIntervalMinutes = Math.max(2 * 60, 6 * 60 * (weightedAccuracy / 50));
    }
    // Default: moderate performance
    else {
      adaptiveIntervalMinutes = baseIntervalMinutes / frequencyMultiplier;
    }
    
    // Cap intervals based on deadline urgency
    if (daysUntilDeadline <= 2) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 4 * 60); // Max 4 hours
    } else if (daysUntilDeadline <= 7) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 12 * 60); // Max 12 hours
    }
    
    adaptiveIntervalMinutes = Math.max(1, Math.min(14 * 24 * 60, adaptiveIntervalMinutes));
    const nextReviewDate = new Date(Date.now() + adaptiveIntervalMinutes * 60 * 1000);
    const adaptiveIntervalDays = adaptiveIntervalMinutes / (24 * 60);

    const { error: scheduleError } = await supabase
      .from('schedules')
      .upsert({
        speech_id: speechId,
        session_date: new Date().toISOString().split('T')[0],
        completed: true,
        next_review_date: nextReviewDate.toISOString(),
        interval_days: Math.ceil(adaptiveIntervalDays),
        adaptive_frequency_multiplier: frequencyMultiplier,
        days_until_deadline: daysUntilDeadline,
        last_reviewed_at: new Date().toISOString()
      }, {
        onConflict: 'speech_id'
      });

    if (scheduleError) {
      console.error('Error updating schedule:', scheduleError);
    }

    // Generate recommendation message based on weighted performance
    let recommendation = '';
    const timeUntilNext = adaptiveIntervalMinutes < 60 
      ? `${Math.round(adaptiveIntervalMinutes)} minute${Math.round(adaptiveIntervalMinutes) !== 1 ? 's' : ''}`
      : adaptiveIntervalMinutes < 24 * 60
      ? `${Math.round(adaptiveIntervalMinutes / 60)} hour${Math.round(adaptiveIntervalMinutes / 60) !== 1 ? 's' : ''}`
      : `${Math.round(adaptiveIntervalDays)} day${Math.round(adaptiveIntervalDays) !== 1 ? 's' : ''}`;
    
    if (daysUntilDeadline <= 1) {
      recommendation = '🚨 Presentation is tomorrow/today! Focus on key points and practice delivery flow.';
    } else if (daysUntilDeadline <= 3) {
      recommendation = '⚠️ Final countdown! Practice complete runs without notes.';
    } else if (consecutiveStruggles >= 2) {
      recommendation = '💪 You\'re struggling with true memorization - take it slow and practice with moderate visibility first.';
    } else if (weightedAccuracy >= 70 && newVisibility < 40) {
      recommendation = `🎯 Excellent! You\'re truly memorizing without heavy script reliance. Next practice in ${timeUntilNext}.`;
    } else if (sessionAccuracy >= 90 && wordVisibilityPercent >= 80) {
      recommendation = '📖 High accuracy but still reading from script. Time to reduce visibility and test real memorization.';
    } else if (weightedAccuracy >= 50) {
      recommendation = `✅ Solid progress on actual memorization! Next practice in ${timeUntilNext}.`;
    } else if (wordVisibilityPercent > 70) {
      recommendation = '📝 Start by memorizing key phrases, then gradually reduce script visibility.';
    } else {
      recommendation = `🔄 Keep practicing! Next session in ${timeUntilNext}.`;
    }

    console.log('Adaptive learning update complete');

    return new Response(
      JSON.stringify({
        success: true,
        rawAccuracy: sessionAccuracy,
        weightedAccuracy: Math.round(weightedAccuracy * 10) / 10,
        performanceWeight: Math.round(performanceWeight * 100),
        wordVisibility: newVisibility,
        currentVisibility: wordVisibilityPercent,
        frequencyMultiplier,
        intervalMinutes: Math.round(adaptiveIntervalMinutes),
        nextReviewDate: nextReviewDate.toISOString(),
        daysUntilDeadline,
        performanceTrend: newTrend,
        consecutiveStruggles,
        adaptationRule: weightedAccuracy >= 70 && wordVisibilityPercent <= 30 ? 'increasing_interval' :
                        sessionAccuracy >= 80 && wordVisibilityPercent >= 70 ? 'keeping_short' :
                        weightedAccuracy < 50 ? 'shortening_interval' : 'moderate',
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
