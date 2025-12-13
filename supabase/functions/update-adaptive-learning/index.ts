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
    // CRITICAL: Use RAW accuracy for struggle detection - don't penalize users for high visibility
    let consecutiveStruggles = speech.consecutive_struggles || 0;
    
    if (sessionAccuracy >= 95) {
      // Near-perfect or perfect raw delivery - reset struggles completely
      consecutiveStruggles = 0;
    } else if (sessionAccuracy >= 85) {
      // Good raw delivery - reduce struggles significantly
      consecutiveStruggles = Math.max(0, consecutiveStruggles - 2);
    } else if (sessionAccuracy >= 70) {
      // Decent raw delivery - reduce struggles
      consecutiveStruggles = Math.max(0, consecutiveStruggles - 1);
    } else if (sessionAccuracy < 60) {
      // Actually struggling with words - increment
      consecutiveStruggles += (sessionAccuracy < 40 ? 2 : 1);
    }
    // Between 60-70%: no change to consecutive struggles
    
    // Calculate days until deadline
    const goalDate = new Date(speech.goal_date);
    const today = new Date();
    const daysUntilDeadline = Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate visibility improvement rate
    const previousVisibility = speech.base_word_visibility_percent || 100;
    const visibilityDelta = previousVisibility - wordVisibilityPercent;
    const isReducingNotes = visibilityDelta > 5; // Reduced visibility by 5%+
    
    // VISIBILITY GUIDANCE: Log suggestion but don't block the user
    // The system automatically hides words based on performance - this is informational only
    const shouldSuggestHidingWords = sessionCount > 0 && sessionCount % 3 === 0 && wordVisibilityPercent > 80;
    
    if (shouldSuggestHidingWords && daysUntilDeadline > 7) {
      console.log('💡 Suggestion: User could benefit from practicing with fewer visible words');
      // Continue processing - don't block the user
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
    // ENHANCED SPACED REPETITION ALGORITHM v2
    // ============================================================
    // Core principle: Lock duration reflects TRUE memorization quality
    //
    // SHORT LOCKS (1 min - 2 hours): 
    //   - Poor performance OR high script visibility OR struggling
    //   - Near deadline emergency
    //
    // MEDIUM LOCKS (2-12 hours):
    //   - Decent performance with moderate visibility
    //   - Early learning stage
    //   - Moderate deadline pressure
    //
    // LONG LOCKS (12-48 hours):
    //   - Good weighted performance with low visibility
    //   - Consistent improvement trend
    //   - No deadline pressure
    //
    // VERY LONG LOCKS (2-7 days):
    //   - Excellent performance with minimal/no notes
    //   - Proven mastery over multiple sessions
    //   - Distant deadline
    // ============================================================
    
    let adaptiveIntervalMinutes: number;
    
    // ============================================================
    // PERSONALIZATION: Fetch user learning analytics
    // ============================================================
    const { data: userAnalytics } = await supabase
      .from('user_learning_analytics')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    // Personalization modifiers based on historical learning patterns
    let personalizationModifier = 1.0;
    let personalOptimalSegmentLength = 50;
    let personalVisibilityReductionRate = 10;
    
    if (userAnalytics && userAnalytics.total_sessions_completed >= 3) {
      console.log('📊 Applying personalization from', userAnalytics.total_sessions_completed, 'sessions');
      
      // Check if practicing during preferred hours (performance boost)
      const currentHour = new Date().getHours();
      const preferredHours = userAnalytics.preferred_practice_hours || [];
      const isPeakHour = preferredHours.includes(currentHour);
      
      if (isPeakHour) {
        personalizationModifier *= 1.15; // 15% longer intervals during peak performance hours
        console.log('⭐ Practicing during peak performance hour');
      }
      
      // Adjust based on user's overall mastery velocity
      const masteryVelocity = userAnalytics.overall_mastery_velocity || 0;
      if (masteryVelocity > 10) {
        personalizationModifier *= 1.25; // Fast learner - longer intervals
      } else if (masteryVelocity > 5) {
        personalizationModifier *= 1.1;
      } else if (masteryVelocity < -5) {
        personalizationModifier *= 0.85; // Needs more frequent practice
      } else if (masteryVelocity < -10) {
        personalizationModifier *= 0.7;
      }
      
      // Use personalized optimal segment length
      personalOptimalSegmentLength = userAnalytics.optimal_segment_length || 50;
      personalVisibilityReductionRate = userAnalytics.preferred_visibility_reduction_rate || 10;
      
      // Adjust for retention decay pattern
      const decayRate = userAnalytics.retention_decay_rate || 0.5;
      if (decayRate > 0.6) {
        personalizationModifier *= 0.85; // Faster forgetting - shorter intervals
      } else if (decayRate < 0.3) {
        personalizationModifier *= 1.15; // Slower forgetting - longer intervals
      }
      
      console.log('Personalization applied:', {
        isPeakHour,
        masteryVelocity: masteryVelocity.toFixed(2),
        decayRate: decayRate.toFixed(2),
        modifier: personalizationModifier.toFixed(2),
        optimalSegment: personalOptimalSegmentLength,
        visibilityRate: personalVisibilityReductionRate
      });
    }
    
    // Calculate "memorization ease" - how quickly user learns THIS speech
    // Based on: improvement rate, consistency, struggle patterns
    let memorizationEaseScore = 50; // 0-100 scale, 50 = average
    
    // Factor 1: Learning velocity (how fast improving)
    if (learningVelocity > 10) memorizationEaseScore += 20;
    else if (learningVelocity > 5) memorizationEaseScore += 10;
    else if (learningVelocity < -10) memorizationEaseScore -= 20;
    else if (learningVelocity < -5) memorizationEaseScore -= 10;
    
    // Factor 2: Consistency (fewer struggles = easier)
    memorizationEaseScore -= consecutiveStruggles * 8;
    
    // Factor 3: Current performance vs visibility (true recall ability)
    const trueRecallScore = weightedAccuracy * (1 - wordVisibilityPercent / 100);
    memorizationEaseScore += (trueRecallScore - 50) * 0.5;
    
    // Factor 4: Session count progress (more sessions = more data = adjust)
    if (sessionCount >= 5 && weightedAccuracy >= 70) memorizationEaseScore += 5;
    if (sessionCount >= 10 && weightedAccuracy >= 75) memorizationEaseScore += 10;
    
    // Factor 5: Personalization bonus for experienced users
    if (userAnalytics && userAnalytics.total_sessions_completed >= 10) {
      const avgRetained = userAnalytics.avg_words_retained_per_session || 0;
      if (avgRetained > wordCount * 0.8) {
        memorizationEaseScore += 10; // High retention history
      }
    }
    
    // Clamp to valid range
    memorizationEaseScore = Math.max(0, Math.min(100, memorizationEaseScore));
    
    console.log('Memorization ease calculation:', {
      baseScore: 50,
      velocityAdjust: learningVelocity > 10 ? '+20' : learningVelocity > 5 ? '+10' : learningVelocity < -10 ? '-20' : learningVelocity < -5 ? '-10' : '0',
      strugglePenalty: -consecutiveStruggles * 8,
      trueRecallBonus: ((trueRecallScore - 50) * 0.5).toFixed(1),
      finalScore: memorizationEaseScore.toFixed(1) + '/100'
    });
    
    // Calculate "deadline pressure" as continuous factor (0-10 scale)
    // 0 = no pressure, 10 = maximum urgency
    let deadlinePressure = 0;
    if (daysUntilDeadline <= 0) {
      deadlinePressure = 10; // Past deadline - maximum urgency
    } else if (daysUntilDeadline === 1) {
      deadlinePressure = 9;
    } else if (daysUntilDeadline === 2) {
      deadlinePressure = 8;
    } else if (daysUntilDeadline <= 3) {
      deadlinePressure = 7;
    } else if (daysUntilDeadline <= 5) {
      deadlinePressure = 6;
    } else if (daysUntilDeadline <= 7) {
      deadlinePressure = 5;
    } else if (daysUntilDeadline <= 10) {
      deadlinePressure = 4;
    } else if (daysUntilDeadline <= 14) {
      deadlinePressure = 3;
    } else if (daysUntilDeadline <= 21) {
      deadlinePressure = 2;
    } else if (daysUntilDeadline <= 30) {
      deadlinePressure = 1;
    } else {
      deadlinePressure = 0;
    }
    
    // STAGE 1: EARLY LEARNING (Sessions 1-10)
    // Force frequent practice to build foundation
    if (isEarlyStage) {
      console.log('🎯 EARLY STAGE: Building foundation');
      
      // Base interval scales with session count
      const sessionProgress = sessionCount / 10; // 0 to 1
      const baseMinutes = 60 + (sessionProgress * 300); // 1 hour to 6 hours
      
      // Adjust for performance (but keep frequent)
      let performanceMultiplier = 1.0;
      if (weightedAccuracy >= 85 && wordVisibilityPercent < 50) {
        performanceMultiplier = 1.8; // Reward true memorization early
      } else if (weightedAccuracy >= 75) {
        performanceMultiplier = 1.4;
      } else if (weightedAccuracy >= 65) {
        performanceMultiplier = 1.2;
      } else if (weightedAccuracy < 50) {
        performanceMultiplier = 0.5; // Struggling - practice sooner
      } else if (weightedAccuracy < 60) {
        performanceMultiplier = 0.7;
      }
      
      // Adjust for memorization ease
      const easeMultiplier = 0.7 + (memorizationEaseScore / 100) * 0.6; // 0.7 to 1.3
      
      // Deadline pressure override for early stage
      const pressureMultiplier = Math.max(0.3, 1 - (deadlinePressure * 0.07));
      
      // Apply personalization if available (even in early stage)
      adaptiveIntervalMinutes = baseMinutes * performanceMultiplier * easeMultiplier * pressureMultiplier * personalizationModifier;
      
      // Cap early stage: 30 min to 8 hours
      adaptiveIntervalMinutes = Math.max(30, Math.min(8 * 60, adaptiveIntervalMinutes));
      
      console.log(`Early stage interval: ${Math.round(adaptiveIntervalMinutes)} min (session ${sessionCount + 1}/10)`, {
        base: Math.round(baseMinutes) + 'min',
        performanceMultiplier: performanceMultiplier.toFixed(2),
        easeMultiplier: easeMultiplier.toFixed(2),
        pressureMultiplier: pressureMultiplier.toFixed(2),
        personalization: personalizationModifier.toFixed(2)
      });
    }
    // STAGE 2: ESTABLISHED LEARNING - Full adaptive algorithm
    else {
      console.log('📈 ESTABLISHED STAGE: Full adaptive scheduling');
      
      // ========== PERFORMANCE-BASED INTERVAL MATRIX ==========
      // Maps weighted accuracy + visibility to base interval
      
      let baseIntervalHours: number;
      
      // HIGH VISIBILITY (80-100%): User is mostly reading
      // Cap intervals regardless of "accuracy" since it's not true memorization
      if (wordVisibilityPercent >= 80) {
        if (weightedAccuracy >= 90) baseIntervalHours = 3;
        else if (weightedAccuracy >= 80) baseIntervalHours = 2;
        else if (weightedAccuracy >= 70) baseIntervalHours = 1.5;
        else if (weightedAccuracy >= 60) baseIntervalHours = 1;
        else baseIntervalHours = 0.5;
        console.log('📖 High visibility mode - capped intervals');
      }
      // MODERATE VISIBILITY (50-79%): Mixed reading/recall
      else if (wordVisibilityPercent >= 50) {
        if (weightedAccuracy >= 85) baseIntervalHours = 8;
        else if (weightedAccuracy >= 75) baseIntervalHours = 6;
        else if (weightedAccuracy >= 65) baseIntervalHours = 4;
        else if (weightedAccuracy >= 55) baseIntervalHours = 2;
        else baseIntervalHours = 1;
        console.log('📝 Moderate visibility - balanced intervals');
      }
      // LOW VISIBILITY (20-49%): Real memorization happening
      else if (wordVisibilityPercent >= 20) {
        if (weightedAccuracy >= 90) baseIntervalHours = 36;
        else if (weightedAccuracy >= 80) baseIntervalHours = 24;
        else if (weightedAccuracy >= 70) baseIntervalHours = 16;
        else if (weightedAccuracy >= 60) baseIntervalHours = 10;
        else if (weightedAccuracy >= 50) baseIntervalHours = 6;
        else baseIntervalHours = 3;
        console.log('🧠 Low visibility - rewarding true recall');
      }
      // MINIMAL/NO VISIBILITY (0-19%): True mastery test
      else {
        if (weightedAccuracy >= 95) baseIntervalHours = 168; // 7 days
        else if (weightedAccuracy >= 90) baseIntervalHours = 96; // 4 days
        else if (weightedAccuracy >= 85) baseIntervalHours = 72; // 3 days
        else if (weightedAccuracy >= 80) baseIntervalHours = 48; // 2 days
        else if (weightedAccuracy >= 70) baseIntervalHours = 24; // 1 day
        else if (weightedAccuracy >= 60) baseIntervalHours = 12;
        else if (weightedAccuracy >= 50) baseIntervalHours = 6;
        else baseIntervalHours = 2;
        console.log('🌟 Minimal visibility - true mastery intervals');
      }
      
      adaptiveIntervalMinutes = baseIntervalHours * 60;
      
      // ========== MODIFIERS ==========
      
      // Modifier 1: Memorization ease (0.6x to 1.4x)
      const easeModifier = 0.6 + (memorizationEaseScore / 100) * 0.8;
      
      // Modifier 2: Learning velocity bonus/penalty
      let velocityModifier = 1.0;
      if (learningVelocity > 10) velocityModifier = 1.25;
      else if (learningVelocity > 5) velocityModifier = 1.15;
      else if (learningVelocity < -10) velocityModifier = 0.6;
      else if (learningVelocity < -5) velocityModifier = 0.75;
      
      // Modifier 3: Visibility reduction bonus (rewarding progress)
      const visibilityBonus = isReducingNotes && weightedAccuracy >= 60 ? 1.2 : 1.0;
      
      // Modifier 4: Consecutive struggles penalty
      let struggleModifier = 1.0;
      if (consecutiveStruggles >= 4) struggleModifier = 0.3;
      else if (consecutiveStruggles >= 3) struggleModifier = 0.5;
      else if (consecutiveStruggles >= 2) struggleModifier = 0.7;
      else if (consecutiveStruggles >= 1) struggleModifier = 0.85;
      
      // Modifier 5: Deadline pressure (strongest modifier)
      const pressureModifier = Math.max(0.1, 1 - (deadlinePressure * 0.09));
      
      // Apply all modifiers including personalization
      adaptiveIntervalMinutes = adaptiveIntervalMinutes * easeModifier * velocityModifier * visibilityBonus * struggleModifier * pressureModifier * personalizationModifier;
      
      console.log('Interval calculation:', {
        baseHours: baseIntervalHours,
        visibility: wordVisibilityPercent + '%',
        weightedAccuracy: weightedAccuracy.toFixed(1),
        modifiers: {
          ease: easeModifier.toFixed(2) + 'x',
          velocity: velocityModifier.toFixed(2) + 'x',
          visibilityBonus: visibilityBonus.toFixed(2) + 'x',
          struggle: struggleModifier.toFixed(2) + 'x',
          pressure: pressureModifier.toFixed(2) + 'x',
          personalization: personalizationModifier.toFixed(2) + 'x'
        },
        resultMinutes: Math.round(adaptiveIntervalMinutes)
      });
    }
    
    // ========== HARD DEADLINE CAPS ==========
    // These override everything - can't risk missing deadline
    const originalInterval = adaptiveIntervalMinutes;
    
    if (daysUntilDeadline <= 0) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 30); // Max 30 min if past deadline
    } else if (daysUntilDeadline === 1) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 60); // Max 1 hour
    } else if (daysUntilDeadline === 2) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 2 * 60); // Max 2 hours
    } else if (daysUntilDeadline <= 3) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 4 * 60); // Max 4 hours
    } else if (daysUntilDeadline <= 5) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 8 * 60); // Max 8 hours
    } else if (daysUntilDeadline <= 7) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 12 * 60); // Max 12 hours
    } else if (daysUntilDeadline <= 14) {
      adaptiveIntervalMinutes = Math.min(adaptiveIntervalMinutes, 24 * 60); // Max 1 day
    }
    
    if (originalInterval !== adaptiveIntervalMinutes) {
      console.log(`⚠️ Deadline cap: ${Math.round(originalInterval / 60)}h → ${Math.round(adaptiveIntervalMinutes / 60)}h (${daysUntilDeadline} days left)`);
    }
    
    // Absolute bounds: 1 minute to 7 days
    adaptiveIntervalMinutes = Math.max(1, Math.min(7 * 24 * 60, adaptiveIntervalMinutes));
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

    // ============================================================
    // USER LEARNING ANALYTICS - Personalization Data Collection
    // ============================================================
    const currentHour = new Date().getHours();
    
    // Get existing analytics or create new
    const { data: existingAnalytics } = await supabase
      .from('user_learning_analytics')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    // Calculate session metrics
    const wordsInSession = wordCount;
    const hesitationRate = 1 - (sessionAccuracy / 100); // Simplified hesitation estimation
    
    // Calculate words per minute from session history
    const { data: recentSession } = await supabase
      .from('practice_sessions')
      .select('duration, speech_id')
      .eq('speech_id', speechId)
      .order('session_date', { ascending: false })
      .limit(1)
      .single();
    
    const sessionDurationMinutes = (recentSession?.duration || 120) / 60;
    const wordsPerMinute = wordsInSession / Math.max(1, sessionDurationMinutes);
    
    if (existingAnalytics) {
      // Update existing analytics with rolling averages
      const totalSessions = existingAnalytics.total_sessions_completed + 1;
      
      // Update practice hour performance (track performance by hour)
      const hourPerformance = existingAnalytics.practice_hour_performance || {};
      const hourKey = currentHour.toString();
      const hourData = hourPerformance[hourKey] || { sessions: 0, avgAccuracy: 0 };
      hourData.avgAccuracy = ((hourData.avgAccuracy * hourData.sessions) + weightedAccuracy) / (hourData.sessions + 1);
      hourData.sessions += 1;
      hourPerformance[hourKey] = hourData;
      
      // Find preferred practice hours (top 3 hours with best performance)
      const hourEntries = Object.entries(hourPerformance)
        .filter(([_, data]: [string, any]) => data.sessions >= 2)
        .sort((a: any, b: any) => b[1].avgAccuracy - a[1].avgAccuracy)
        .slice(0, 3)
        .map(([hour]) => parseInt(hour));
      
      // Calculate rolling averages
      const newAvgWordsPerMinute = ((existingAnalytics.avg_words_per_minute * existingAnalytics.total_sessions_completed) + wordsPerMinute) / totalSessions;
      const newAvgHesitationRate = ((existingAnalytics.avg_hesitation_rate * existingAnalytics.total_sessions_completed) + hesitationRate) / totalSessions;
      const newAvgWordsRetained = ((existingAnalytics.avg_words_retained_per_session * existingAnalytics.total_sessions_completed) + (wordsInSession * (sessionAccuracy / 100))) / totalSessions;
      
      // Calculate retention decay rate based on performance over sessions
      let decayRate = existingAnalytics.retention_decay_rate;
      if (learningVelocity > 0) {
        decayRate = Math.max(0.1, decayRate - 0.02); // Slower decay if improving
      } else if (learningVelocity < -5) {
        decayRate = Math.min(0.9, decayRate + 0.03); // Faster decay if declining
      }
      
      // Calculate optimal segment length based on success patterns
      let optimalSegment = existingAnalytics.optimal_segment_length;
      if (weightedAccuracy >= 80 && currentSegmentLength <= 60) {
        optimalSegment = Math.min(100, optimalSegment + 5); // Can handle larger segments
      } else if (weightedAccuracy < 60 && currentSegmentLength >= 50) {
        optimalSegment = Math.max(20, optimalSegment - 5); // Needs smaller segments
      }
      
      // Calculate visibility reduction rate preference
      let visibilityRate = existingAnalytics.preferred_visibility_reduction_rate;
      if (isReducingNotes && weightedAccuracy >= 75) {
        visibilityRate = Math.min(20, visibilityRate + 1); // Can handle faster reduction
      } else if (!isReducingNotes && consecutiveStruggles >= 2) {
        visibilityRate = Math.max(3, visibilityRate - 1); // Needs slower reduction
      }
      
      // Calculate struggle recovery pattern
      let recoveryTime = existingAnalytics.struggle_recovery_sessions;
      if (consecutiveStruggles === 0 && existingAnalytics.total_sessions_completed > 5) {
        recoveryTime = Math.max(1, recoveryTime - 0.1); // Recovers quickly
      } else if (consecutiveStruggles >= 3) {
        recoveryTime = Math.min(5, recoveryTime + 0.2); // Takes longer to recover
      }
      
      // Calculate mastery velocity (how fast user reaches mastery)
      const masteryVelocity = learningVelocity > 0 
        ? (existingAnalytics.overall_mastery_velocity + learningVelocity) / 2
        : existingAnalytics.overall_mastery_velocity * 0.95;
      
      // Update analytics
      const { error: analyticsError } = await supabase
        .from('user_learning_analytics')
        .update({
          preferred_practice_hours: hourEntries.length > 0 ? hourEntries : existingAnalytics.preferred_practice_hours,
          practice_hour_performance: hourPerformance,
          avg_words_per_minute: newAvgWordsPerMinute,
          avg_hesitation_rate: newAvgHesitationRate,
          avg_words_retained_per_session: newAvgWordsRetained,
          retention_decay_rate: decayRate,
          optimal_segment_length: optimalSegment,
          preferred_visibility_reduction_rate: visibilityRate,
          struggle_recovery_sessions: recoveryTime,
          total_sessions_completed: totalSessions,
          total_words_practiced: existingAnalytics.total_words_practiced + wordsInSession,
          overall_mastery_velocity: masteryVelocity,
          optimal_review_interval_minutes: Math.round(adaptiveIntervalMinutes)
        })
        .eq('user_id', user.id);
      
      if (analyticsError) {
        console.error('Error updating learning analytics:', analyticsError);
      } else {
        console.log('📊 Learning analytics updated:', {
          totalSessions,
          preferredHours: hourEntries,
          avgWPM: newAvgWordsPerMinute.toFixed(1),
          optimalSegment,
          masteryVelocity: masteryVelocity.toFixed(2)
        });
      }
    } else {
      // Create new analytics record
      const { error: insertError } = await supabase
        .from('user_learning_analytics')
        .insert({
          user_id: user.id,
          preferred_practice_hours: [currentHour],
          practice_hour_performance: { [currentHour]: { sessions: 1, avgAccuracy: weightedAccuracy } },
          avg_words_per_minute: wordsPerMinute,
          avg_hesitation_rate: hesitationRate,
          avg_words_retained_per_session: wordsInSession * (sessionAccuracy / 100),
          total_sessions_completed: 1,
          total_words_practiced: wordsInSession,
          overall_mastery_velocity: learningVelocity
        });
      
      if (insertError) {
        console.error('Error creating learning analytics:', insertError);
      } else {
        console.log('📊 Learning analytics created for user');
      }
    }

    // Generate enhanced recommendation based on learning stage and performance
    let recommendation = '';
    const timeUntilNext = adaptiveIntervalMinutes < 60 
      ? `${Math.round(adaptiveIntervalMinutes)} minute${Math.round(adaptiveIntervalMinutes) !== 1 ? 's' : ''}`
      : adaptiveIntervalMinutes < 24 * 60
      ? `${Math.round(adaptiveIntervalMinutes / 60)} hour${Math.round(adaptiveIntervalMinutes / 60) !== 1 ? 's' : ''}`
      : `${(adaptiveIntervalDays).toFixed(1)} day${adaptiveIntervalDays >= 2 ? 's' : ''}`;
    
    // Priority-based recommendation system
    if (daysUntilDeadline <= 0) {
      recommendation = '🚨 Past deadline! Practice intensively - every rep counts now.';
    } else if (daysUntilDeadline === 1) {
      recommendation = '🚨 Tomorrow is the day! Focus on confidence and flow, not perfection.';
    } else if (daysUntilDeadline <= 3) {
      recommendation = `⚠️ ${daysUntilDeadline} days left! Complete run-throughs with minimal notes. Practice in ${timeUntilNext}.`;
    } else if (isEarlyStage) {
      if (weightedAccuracy >= 80 && wordVisibilityPercent < 50) {
        recommendation = `🌟 Impressive early performance! You're memorizing faster than average. Next in ${timeUntilNext}.`;
      } else if (weightedAccuracy < 50) {
        recommendation = `💪 Early learning phase (${sessionCount + 1}/10). Don't worry about mistakes - focus on familiarity. Practice in ${timeUntilNext}.`;
      } else {
        recommendation = `🎯 Building foundation (${sessionCount + 1}/10). Consistency is key right now. Next in ${timeUntilNext}.`;
      }
    } else if (consecutiveStruggles >= 3) {
      recommendation = `💪 Having trouble with this speech. Try practicing smaller sections with more visible words. Next in ${timeUntilNext}.`;
    } else if (weightedAccuracy >= 85 && wordVisibilityPercent <= 20) {
      recommendation = `🌟 True mastery! ${weightedAccuracy.toFixed(0)}% accuracy with minimal notes. You've earned a ${timeUntilNext} break.`;
    } else if (weightedAccuracy >= 80 && wordVisibilityPercent <= 40) {
      recommendation = `🎯 Excellent recall! Keep reducing visible words to strengthen memory further. Next in ${timeUntilNext}.`;
    } else if (sessionAccuracy >= 85 && wordVisibilityPercent >= 70) {
      recommendation = `📖 Great reading, but hide more words to test real memory! You'll unlock longer breaks. Next in ${timeUntilNext}.`;
    } else if (learningVelocity > 10) {
      recommendation = `🚀 You're improving fast! Keep this momentum going. Next in ${timeUntilNext}.`;
    } else if (learningVelocity < -10) {
      recommendation = `📉 Performance declining - scheduling more frequent practice (${timeUntilNext}) to help you recover.`;
    } else if (memorizationEaseScore >= 70) {
      recommendation = `✨ This speech comes naturally to you! ${timeUntilNext} until next session.`;
    } else if (memorizationEaseScore <= 30) {
      recommendation = `🔄 This is a challenging one. More frequent practice (${timeUntilNext}) will help build mastery.`;
    } else if (weightedAccuracy >= 70) {
      recommendation = `✅ Good progress! Practice in ${timeUntilNext}.`;
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
        memorizationEaseScore: Math.round(memorizationEaseScore),
        deadlinePressure,
        adaptationFactors: {
          earlyStageBonus: isEarlyStage,
          memorizationEase: memorizationEaseScore >= 70 ? 'easy' :
                           memorizationEaseScore >= 50 ? 'average' :
                           memorizationEaseScore >= 30 ? 'challenging' : 'difficult',
          performanceQuality: weightedAccuracy >= 80 && wordVisibilityPercent <= 30 ? 'mastery' :
                              weightedAccuracy >= 70 && wordVisibilityPercent <= 50 ? 'excellent' :
                              weightedAccuracy >= 60 ? 'good' :
                              weightedAccuracy >= 50 ? 'moderate' : 'struggling',
          learningVelocity: learningVelocity > 10 ? 'rapid' : 
                            learningVelocity > 5 ? 'fast' : 
                            learningVelocity < -10 ? 'declining_fast' :
                            learningVelocity < -5 ? 'declining' : 'steady',
          notesReduction: isReducingNotes ? 'yes' : 'no',
          strugglePattern: consecutiveStruggles >= 4 ? 'severe' :
                          consecutiveStruggles >= 3 ? 'high' :
                          consecutiveStruggles >= 2 ? 'moderate' :
                          consecutiveStruggles >= 1 ? 'slight' : 'none',
          deadlineUrgency: deadlinePressure >= 8 ? 'critical' :
                          deadlinePressure >= 6 ? 'high' :
                          deadlinePressure >= 4 ? 'moderate' :
                          deadlinePressure >= 2 ? 'low' : 'none',
          personalizationActive: personalizationModifier !== 1.0,
          personalizationModifier: personalizationModifier
        },
        personalization: userAnalytics ? {
          totalSessionsAnalyzed: userAnalytics.total_sessions_completed,
          preferredPracticeHours: userAnalytics.preferred_practice_hours,
          avgWordsPerMinute: Math.round(userAnalytics.avg_words_per_minute * 10) / 10,
          avgHesitationRate: Math.round((userAnalytics.avg_hesitation_rate || 0) * 100),
          retentionDecayRate: Math.round((userAnalytics.retention_decay_rate || 0.5) * 100),
          optimalSegmentLength: userAnalytics.optimal_segment_length,
          masteryVelocity: Math.round((userAnalytics.overall_mastery_velocity || 0) * 10) / 10
        } : null,
        automationSummary: {
          nextSessionTiming: adaptiveIntervalMinutes < 60 
            ? `${Math.round(adaptiveIntervalMinutes)} minutes`
            : adaptiveIntervalMinutes < 24 * 60
            ? `${(adaptiveIntervalMinutes / 60).toFixed(1)} hours`
            : `${(adaptiveIntervalMinutes / (24 * 60)).toFixed(1)} days`,
          nextSegmentSize: newSegmentLength === 100 ? 'Full speech' : `${newSegmentLength}% of speech`,
          nextScriptSupport: `${newVisibility}% words visible`,
          deadlineStatus: daysUntilDeadline <= 1 ? 'FINAL DAY' :
                         daysUntilDeadline <= 3 ? 'FINAL SPRINT' :
                         daysUntilDeadline <= 7 ? 'Last week' :
                         daysUntilDeadline <= 14 ? 'Two weeks out' :
                         'Comfortable timeline',
          learningPhase: isEarlyStage ? `Foundation building (${sessionCount + 1}/10)` : 'Adaptive mastery',
          personalized: userAnalytics ? true : false
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
