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

    // Verify user owns the speech and get comprehensive speech data
    const { data: speech, error: speechError } = await supabase
      .from('speeches')
      .select('user_id, goal_date, last_accuracy, performance_trend, consecutive_struggles, created_at, base_word_visibility_percent')
      .eq('id', speechId)
      .single();

    if (speechError || !speech || speech.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized access to speech' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get session history to determine learning stage
    const { data: sessionHistory, error: sessionError } = await supabase
      .from('practice_sessions')
      .select('score, session_date')
      .eq('speech_id', speechId)
      .order('session_date', { ascending: false })
      .limit(10);

    const sessionCount = sessionHistory?.length || 0;
    const isEarlyStage = sessionCount < 10; // Extended to 10 sessions for better habit formation
    
    console.log('Learning stage:', {
      totalSessions: sessionCount,
      stage: isEarlyStage ? 'EARLY (high frequency)' : 'ESTABLISHED (adaptive)',
      speechAge: Math.floor((Date.now() - new Date(speech.created_at).getTime()) / (1000 * 60 * 60 * 24)) + ' days'
    });

    // Calculate performance trend (compare weighted current to last weighted session)
    const lastAccuracy = speech.last_accuracy || 70;
    const accuracyDelta = weightedAccuracy - lastAccuracy;
    
    // Calculate learning velocity: how fast is the user improving?
    let learningVelocity = 0;
    if (sessionHistory && sessionHistory.length >= 2) {
      const recentScores = sessionHistory.slice(0, 3).map(s => s.score || 0);
      const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      const olderScores = sessionHistory.slice(3, 6).map(s => s.score || 0);
      if (olderScores.length > 0) {
        const avgOlder = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
        learningVelocity = avgRecent - avgOlder; // Positive = improving, negative = declining
      }
    }
    
    // Performance trend: -1 (declining) to +1 (improving)
    const newTrend = Math.max(-1, Math.min(1, accuracyDelta / 30));
    
    // Track consecutive struggles with severity weighting
    let consecutiveStruggles = speech.consecutive_struggles || 0;
    if (weightedAccuracy < 50) {
      // Severe struggle: big penalty
      consecutiveStruggles += (weightedAccuracy < 30 ? 2 : 1);
    } else if (weightedAccuracy >= 65) {
      // Good recovery: reset faster
      consecutiveStruggles = Math.max(0, consecutiveStruggles - 2);
    } else if (weightedAccuracy >= 50) {
      // Moderate recovery
      consecutiveStruggles = Math.max(0, consecutiveStruggles - 1);
    }
    
    // Calculate days until deadline
    const goalDate = new Date(speech.goal_date);
    const today = new Date();
    const daysUntilDeadline = Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate visibility improvement rate
    const previousVisibility = speech.base_word_visibility_percent || 100;
    const visibilityDelta = previousVisibility - wordVisibilityPercent;
    const isReducingNotes = visibilityDelta > 5; // Reduced visibility by 5%+
    
    // VISIBILITY PROGRESSION GATE: Enforce reduction every 3 sessions
    const visibilityProgressionBlocked = sessionCount > 0 && sessionCount % 3 === 0 && wordVisibilityPercent > 80;
    
    if (visibilityProgressionBlocked && daysUntilDeadline > 7) {
      console.warn('⚠️ VISIBILITY GATE: User must reduce script visibility to progress');
      return new Response(
        JSON.stringify({
          error: 'visibility_gate',
          message: 'To continue progressing, you need to hide more words from your script. Try reducing your visible words by at least 10%.',
          currentVisibility: wordVisibilityPercent,
          requiredVisibility: 70,
          sessionCount,
          recommendation: 'Practice with fewer visible words to strengthen your memory before continuing.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Performance analysis:', {
      lastAccuracy,
      rawAccuracy: sessionAccuracy,
      weightedAccuracy: weightedAccuracy.toFixed(1),
      accuracyDelta: accuracyDelta.toFixed(1),
      learningVelocity: learningVelocity.toFixed(1),
      newTrend: newTrend.toFixed(2),
      consecutiveStruggles,
      daysUntilDeadline,
      visibilityProgress: `${previousVisibility}% → ${wordVisibilityPercent}% (${visibilityDelta > 0 ? '-' : '+'}${Math.abs(visibilityDelta).toFixed(1)}%)`
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

    // Get current speech data including segment info
    const { data: speechData } = await supabase
      .from('speeches')
      .select('text_current, current_segment_length')
      .eq('id', speechId)
      .single();
    
    const wordCount = speechData?.text_current?.split(/\s+/).length || 0;
    const currentSegmentLength = speechData?.current_segment_length || 100;
    
    // Calculate optimal segment length using database function
    const { data: segmentData, error: segmentError } = await supabase
      .rpc('calculate_segment_length', {
        p_weighted_accuracy: weightedAccuracy,
        p_consecutive_struggles: consecutiveStruggles,
        p_days_until_deadline: daysUntilDeadline,
        p_current_segment_length: currentSegmentLength
      });
    
    if (segmentError) {
      console.error('Error calculating segment length:', segmentError);
    }
    
    const newSegmentLength = segmentData || 100;
    console.log('Segment length adjustment:', currentSegmentLength + '% → ' + newSegmentLength + '%');

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

    // Update speech performance tracking (store weighted accuracy and new segment length)
    const { error: updateError } = await supabase
      .from('speeches')
      .update({
        last_accuracy: weightedAccuracy,
        performance_trend: newTrend,
        consecutive_struggles: consecutiveStruggles,
        base_word_visibility_percent: newVisibility,
        target_segment_length: newSegmentLength,
        current_segment_length: newSegmentLength
      })
      .eq('id', speechId);

    if (updateError) {
      console.error('Error updating speech:', updateError);
      throw updateError;
    }

    // ============================================================
    // ENHANCED SPACED REPETITION ALGORITHM
    // ============================================================
    // STAGE 1: EARLY LEARNING (Sessions 1-5)
    //   Force high frequency (2-6 hours) regardless of performance
    //   Goal: Build familiarity, prevent false confidence from reading
    //
    // STAGE 2: PROGRESSIVE MEMORIZATION (Sessions 6+)
    //   Adapt based on weighted performance + visibility reduction
    //
    // KEY FACTORS:
    //   - Weighted accuracy (true memorization indicator)
    //   - Word visibility % (notes reliance)
    //   - Learning velocity (improvement rate)
    //   - Consecutive struggles (difficulty patterns)
    //   - Deadline urgency (time pressure)
    // ============================================================
    
    let adaptiveIntervalMinutes: number;
    const baseIntervalMinutes = 12 * 60; // 12 hour base (reduced from 24h for more frequent reinforcement)
    
    // STAGE 1: EARLY LEARNING - Force frequent practice (Extended to 10 sessions)
    if (isEarlyStage) {
      console.log('🎯 EARLY STAGE: Enforcing high practice frequency');
      
      if (sessionCount <= 3) {
        // First 3 sessions: 2-4 hours regardless of performance
        adaptiveIntervalMinutes = 2 * 60 + Math.random() * 2 * 60;
      } else if (sessionCount <= 6) {
        // Sessions 4-6: 3-5 hours, slightly adaptive
        const baseEarly = 3 * 60;
        const adjustment = weightedAccuracy >= 75 ? 2 * 60 : weightedAccuracy >= 60 ? 1 * 60 : 0;
        adaptiveIntervalMinutes = baseEarly + adjustment;
      } else {
        // Sessions 7-10: 4-8 hours, more adaptive but still constrained
        const baseEarly = 4 * 60;
        const adjustment = weightedAccuracy >= 80 ? 4 * 60 : 
                          weightedAccuracy >= 70 ? 3 * 60 : 
                          weightedAccuracy >= 60 ? 2 * 60 : 1 * 60;
        adaptiveIntervalMinutes = baseEarly + adjustment;
      }
      
      console.log(`Early stage interval: ${Math.round(adaptiveIntervalMinutes / 60)} hours (session ${sessionCount + 1}/10)`);
    }
    // STAGE 2: ESTABLISHED LEARNING - Full adaptive algorithm
    else {
      console.log('📈 ESTABLISHED STAGE: Full adaptive scheduling');
      
      // Calculate base interval using comprehensive factors
      
      // Factor 1: Performance quality with STRICT visibility context (prevents gaming)
      let performanceFactor = 1.0;
      
      // HIGH VISIBILITY PENALTY: Prevents gaming by reading script
      if (wordVisibilityPercent >= 80) {
        // Reading mode: Cap at 1 day max regardless of accuracy
        performanceFactor = weightedAccuracy >= 90 ? 1.5 : 
                           weightedAccuracy >= 80 ? 1.0 : 
                           weightedAccuracy >= 70 ? 0.8 : 0.5;
      } else if (wordVisibilityPercent >= 60) {
        // Heavy notes: Cap at 1.5 days
        performanceFactor = weightedAccuracy >= 85 ? 2.0 : 
                           weightedAccuracy >= 75 ? 1.5 : 
                           weightedAccuracy >= 65 ? 1.0 : 0.6;
      } else if (wordVisibilityPercent >= 40) {
        // Moderate notes: Up to 2 days
        performanceFactor = weightedAccuracy >= 80 ? 2.5 : 
                           weightedAccuracy >= 70 ? 2.0 : 
                           weightedAccuracy >= 60 ? 1.2 : 0.7;
      } else if (wordVisibilityPercent >= 20) {
        // Light notes: Up to 3 days
        performanceFactor = weightedAccuracy >= 85 ? 3.5 : 
                           weightedAccuracy >= 75 ? 2.5 : 
                           weightedAccuracy >= 65 ? 1.5 : 0.8;
      } else {
        // True mastery (minimal visibility): Full range
        if (weightedAccuracy >= 85) {
          performanceFactor = 4.0 + (weightedAccuracy - 85) / 10; // 4-5.5 days
        } else if (weightedAccuracy >= 75) {
          performanceFactor = 3.0 + (weightedAccuracy - 75) / 10; // 3-4 days
        } else if (weightedAccuracy >= 65) {
          performanceFactor = 2.0 + (weightedAccuracy - 65) / 10; // 2-3 days
        } else if (weightedAccuracy >= 50) {
          performanceFactor = 1.0 + (weightedAccuracy - 50) / 15; // 1-2 days
        } else {
          performanceFactor = 0.25 + (weightedAccuracy / 100) * 0.75; // 3-9 hours
        }
      }
      
      // Factor 2: Learning velocity bonus (improving fast = can space more)
      const velocityFactor = learningVelocity > 5 ? 1.2 : learningVelocity < -5 ? 0.8 : 1.0;
      
      // Factor 3: Notes reduction bonus (reducing visibility = true learning)
      const visibilityFactor = isReducingNotes && weightedAccuracy >= 60 ? 1.15 : 1.0;
      
      // Factor 4: Struggle penalty (repeated struggles = need more practice)
      const strugglePenalty = consecutiveStruggles >= 3 ? 0.5 : 
                             consecutiveStruggles >= 2 ? 0.7 :
                             consecutiveStruggles >= 1 ? 0.85 : 1.0;
      
      // Combine all factors
      adaptiveIntervalMinutes = baseIntervalMinutes * performanceFactor * velocityFactor * visibilityFactor * strugglePenalty;
      
      console.log('Interval calculation:', {
        base: '12 hours',
        visibilityPercent: wordVisibilityPercent + '%',
        performanceFactor: performanceFactor.toFixed(2) + 'x',
        velocityFactor: velocityFactor.toFixed(2) + 'x',
        visibilityFactor: visibilityFactor.toFixed(2) + 'x',
        strugglePenalty: strugglePenalty.toFixed(2) + 'x',
        result: Math.round(adaptiveIntervalMinutes / 60) + ' hours'
      });
    }
    
    // CRITICAL: Deadline urgency caps (override all calculations)
    const originalInterval = adaptiveIntervalMinutes;
    if (daysUntilDeadline <= 1) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 2 * 60); // Max 2 hours
    } else if (daysUntilDeadline <= 2) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 4 * 60); // Max 4 hours
    } else if (daysUntilDeadline <= 5) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 8 * 60); // Max 8 hours
    } else if (daysUntilDeadline <= 10) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 24 * 60); // Max 1 day
    }
    
    if (originalInterval !== adaptiveIntervalMinutes) {
      console.log(`⚠️ Deadline cap applied: ${Math.round(originalInterval / 60)}h → ${Math.round(adaptiveIntervalMinutes / 60)}h`);
    }
    
    // Absolute bounds: 1 minute to 14 days
    adaptiveIntervalMinutes = Math.max(1, Math.min(14 * 24 * 60, adaptiveIntervalMinutes));
    const nextReviewDate = new Date(Date.now() + adaptiveIntervalMinutes * 60 * 1000);
    const adaptiveIntervalDays = adaptiveIntervalMinutes / (24 * 60);

    // Update schedule with enhanced tracking
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
        last_reviewed_at: new Date().toISOString(),
        review_count: sessionCount + 1
      }, {
        onConflict: 'speech_id'
      });

    if (scheduleError) {
      console.error('Error updating schedule:', scheduleError);
    }

    // Generate enhanced recommendation based on learning stage and performance
    let recommendation = '';
    const timeUntilNext = adaptiveIntervalMinutes < 60 
      ? `${Math.round(adaptiveIntervalMinutes)} minute${Math.round(adaptiveIntervalMinutes) !== 1 ? 's' : ''}`
      : adaptiveIntervalMinutes < 24 * 60
      ? `${Math.round(adaptiveIntervalMinutes / 60)} hour${Math.round(adaptiveIntervalMinutes / 60) !== 1 ? 's' : ''}`
      : `${Math.round(adaptiveIntervalDays)} day${Math.round(adaptiveIntervalDays) !== 1 ? 's' : ''}`;
    
    if (isEarlyStage) {
      recommendation = `🎯 Early learning phase (${sessionCount + 1}/10). Building solid foundation - practice again in ${timeUntilNext}.`;
    } else if (daysUntilDeadline <= 1) {
      recommendation = '🚨 Presentation is tomorrow/today! Focus on flow and confidence, not perfection.';
    } else if (daysUntilDeadline <= 3) {
      recommendation = '⚠️ Final countdown! Do complete run-throughs with minimal notes.';
    } else if (consecutiveStruggles >= 3) {
      recommendation = '💪 Multiple struggles detected. Take it slower and practice with more support words visible.';
    } else if (weightedAccuracy >= 80 && wordVisibilityPercent <= 20 && learningVelocity > 0) {
      recommendation = `🌟 Outstanding! True mastery with minimal notes. You've earned ${timeUntilNext} break.`;
    } else if (weightedAccuracy >= 70 && isReducingNotes) {
      recommendation = `🎯 Great progress! You're reducing notes AND maintaining accuracy. Next in ${timeUntilNext}.`;
    } else if (sessionAccuracy >= 90 && wordVisibilityPercent >= 70) {
      recommendation = '📖 High accuracy but still reading. Hide at least 10% more words to truly test your memory!';
    } else if (learningVelocity < -5) {
      recommendation = `📉 Performance declining. More frequent practice scheduled (${timeUntilNext}) to get back on track.`;
    } else if (weightedAccuracy >= 60) {
      recommendation = `✅ Solid progress! Keep up the momentum. Practice in ${timeUntilNext}.`;
    } else {
      recommendation = `🔄 Building mastery takes time. Practice scheduled in ${timeUntilNext}.`;
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
        segmentLength: newSegmentLength,
        segmentChanged: newSegmentLength !== currentSegmentLength,
        frequencyMultiplier,
        intervalMinutes: Math.round(adaptiveIntervalMinutes),
        nextReviewDate: nextReviewDate.toISOString(),
        daysUntilDeadline,
        performanceTrend: newTrend,
        consecutiveStruggles,
        sessionCount: sessionCount + 1,
        learningStage: isEarlyStage ? 'early' : 'established',
        learningVelocity: Math.round(learningVelocity * 10) / 10,
        isReducingNotes,
        adaptationFactors: {
          earlyStageBonus: isEarlyStage,
          performanceQuality: weightedAccuracy >= 70 && wordVisibilityPercent <= 40 ? 'excellent' :
                              weightedAccuracy >= 60 ? 'good' :
                              weightedAccuracy >= 50 ? 'moderate' : 'struggling',
          learningVelocity: learningVelocity > 5 ? 'fast' : learningVelocity < -5 ? 'declining' : 'steady',
          notesReduction: isReducingNotes ? 'yes' : 'no',
          strugglePattern: consecutiveStruggles >= 3 ? 'severe' :
                          consecutiveStruggles >= 2 ? 'moderate' :
                          consecutiveStruggles >= 1 ? 'slight' : 'none',
          deadlineUrgency: daysUntilDeadline <= 2 ? 'critical' :
                          daysUntilDeadline <= 5 ? 'high' :
                          daysUntilDeadline <= 10 ? 'moderate' : 'low'
        },
        automationSummary: {
          nextSessionTiming: adaptiveIntervalMinutes < 60 
            ? `${Math.round(adaptiveIntervalMinutes)} minutes`
            : adaptiveIntervalMinutes < 24 * 60
            ? `${Math.round(adaptiveIntervalMinutes / 60)} hours`
            : `${Math.round(adaptiveIntervalMinutes / (24 * 60))} days`,
          nextSegmentSize: newSegmentLength === 100 ? 'Full speech' : `${newSegmentLength}% of speech`,
          nextScriptSupport: `${newVisibility}% words visible`,
          deadlineStatus: daysUntilDeadline <= 3 ? 'FINAL SPRINT - Minimal notes' :
                         daysUntilDeadline <= 7 ? 'Last week - Reducing notes' :
                         daysUntilDeadline <= 14 ? 'Two weeks - Progressive reduction' :
                         'Progressive learning - Notes allowed',
          learningPhase: isEarlyStage ? `Building familiarity (${sessionCount + 1}/5)` : 'Adaptive mastery'
        },
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
