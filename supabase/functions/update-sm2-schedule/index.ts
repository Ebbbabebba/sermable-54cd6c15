import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SM-2 Algorithm Constants
const LEARNING_STEPS = [1, 10]; // minutes
const GRADUATING_INTERVAL = 1440; // 1 day in minutes
const EASY_INTERVAL = 4 * 1440; // 4 days in minutes
const MINIMUM_EASE = 1.3;
const EASY_BONUS = 1.3;
const INTERVAL_MODIFIER = 1.0;
const HARD_INTERVAL_MODIFIER = 1.2;
const NEW_INTERVAL_AFTER_LAPSE = 0.5; // 50% of previous interval

type CardState = 'new' | 'learning' | 'review' | 'relearning';
type UserRating = 'again' | 'hard' | 'good' | 'easy';

interface SM2Result {
  newState: CardState;
  newInterval: number; // in minutes
  newEaseFactor: number;
  newLearningStep: number;
}

function calculateSM2(
  rating: UserRating,
  currentState: CardState,
  currentInterval: number,
  easeFactor: number,
  learningStep: number,
  daysUntilDeadline: number
): SM2Result {
  let newState = currentState;
  let newInterval = currentInterval;
  let newEaseFactor = easeFactor;
  let newLearningStep = learningStep;

  console.log('SM-2 Input:', { rating, currentState, currentInterval, easeFactor, learningStep, daysUntilDeadline });

  // Handle based on current state
  switch (currentState) {
    case 'new':
    case 'learning':
      switch (rating) {
        case 'again':
          // Reset to first learning step
          newState = 'learning';
          newLearningStep = 0;
          newInterval = LEARNING_STEPS[0];
          break;
        
        case 'hard':
          // Stay at current step or go back
          newState = 'learning';
          newInterval = Math.max(LEARNING_STEPS[learningStep] || 1, 6);
          break;
        
        case 'good':
          // Progress to next learning step or graduate
          if (learningStep >= LEARNING_STEPS.length - 1) {
            // Graduate to review
            newState = 'review';
            newInterval = GRADUATING_INTERVAL;
            newLearningStep = 0;
          } else {
            // Move to next step
            newState = 'learning';
            newLearningStep = learningStep + 1;
            newInterval = LEARNING_STEPS[newLearningStep];
          }
          break;
        
        case 'easy':
          // Immediately graduate with easy interval
          newState = 'review';
          newInterval = EASY_INTERVAL;
          newEaseFactor = Math.min(easeFactor + 0.15, 3.0);
          newLearningStep = 0;
          break;
      }
      break;

    case 'review':
      switch (rating) {
        case 'again':
          // Card lapses - move to relearning
          newState = 'relearning';
          newLearningStep = 0;
          newInterval = LEARNING_STEPS[0];
          // Decrease ease factor
          newEaseFactor = Math.max(MINIMUM_EASE, easeFactor - 0.20);
          break;
        
        case 'hard':
          // Hard review - slight interval increase, decrease ease
          newState = 'review';
          newInterval = Math.max(
            currentInterval * HARD_INTERVAL_MODIFIER,
            currentInterval + 1440 // at least 1 day more
          );
          newEaseFactor = Math.max(MINIMUM_EASE, easeFactor - 0.15);
          break;
        
        case 'good':
          // Good review - normal SM-2 interval increase
          newState = 'review';
          newInterval = currentInterval * easeFactor * INTERVAL_MODIFIER;
          break;
        
        case 'easy':
          // Easy review - larger interval, increase ease
          newState = 'review';
          newInterval = currentInterval * easeFactor * EASY_BONUS;
          newEaseFactor = Math.min(easeFactor + 0.15, 3.0);
          break;
      }
      break;

    case 'relearning':
      switch (rating) {
        case 'again':
          // Stay in relearning
          newState = 'relearning';
          newLearningStep = 0;
          newInterval = LEARNING_STEPS[0];
          newEaseFactor = Math.max(MINIMUM_EASE, easeFactor - 0.10);
          break;
        
        case 'hard':
          // Progress slowly
          newState = 'relearning';
          newInterval = 10;
          break;
        
        case 'good':
          // Graduate back to review with reduced interval
          newState = 'review';
          newInterval = Math.max(
            currentInterval * NEW_INTERVAL_AFTER_LAPSE,
            GRADUATING_INTERVAL
          );
          break;
        
        case 'easy':
          // Graduate back with better interval
          newState = 'review';
          newInterval = Math.max(
            currentInterval * NEW_INTERVAL_AFTER_LAPSE * 1.5,
            GRADUATING_INTERVAL * 2
          );
          newEaseFactor = Math.min(easeFactor + 0.10, 3.0);
          break;
      }
      break;
  }

  // Apply deadline pressure caps
  const maxIntervalMinutes = getMaxIntervalForDeadline(daysUntilDeadline);
  newInterval = Math.min(newInterval, maxIntervalMinutes);
  
  // Ensure minimum interval of 1 minute
  newInterval = Math.max(1, Math.round(newInterval));
  
  // Clamp ease factor
  newEaseFactor = Math.max(MINIMUM_EASE, Math.min(3.0, newEaseFactor));

  console.log('SM-2 Output:', { newState, newInterval, newEaseFactor, newLearningStep });
  
  return { newState, newInterval, newEaseFactor, newLearningStep };
}

function getMaxIntervalForDeadline(daysUntilDeadline: number): number {
  if (daysUntilDeadline <= 0) return 30; // 30 min max if past deadline
  if (daysUntilDeadline === 1) return 60; // 1 hour
  if (daysUntilDeadline === 2) return 2 * 60; // 2 hours
  if (daysUntilDeadline <= 3) return 4 * 60; // 4 hours
  if (daysUntilDeadline <= 5) return 8 * 60; // 8 hours
  if (daysUntilDeadline <= 7) return 12 * 60; // 12 hours
  if (daysUntilDeadline <= 14) return 24 * 60; // 1 day
  if (daysUntilDeadline <= 30) return 3 * 24 * 60; // 3 days
  return 7 * 24 * 60; // 7 days max
}

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
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { speechId, userRating, sessionAccuracy, wordVisibilityPercent = 100 } = await req.json();
    
    console.log('📚 SM-2 Update for speech:', speechId, 'Rating:', userRating, 'Accuracy:', sessionAccuracy);

    // Verify user owns the speech
    const { data: speech, error: speechError } = await supabase
      .from('speeches')
      .select('user_id, goal_date')
      .eq('id', speechId)
      .single();

    if (speechError || !speech || speech.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized access to speech' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate days until deadline
    const goalDate = new Date(speech.goal_date);
    const today = new Date();
    const daysUntilDeadline = Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Get current schedule state
    const { data: currentSchedule } = await supabase
      .from('schedules')
      .select('*')
      .eq('speech_id', speechId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const currentState = (currentSchedule?.card_state || 'new') as CardState;
    const currentInterval = (currentSchedule?.interval_days || 0) * 1440; // Convert days to minutes
    const currentEaseFactor = currentSchedule?.ease_factor || 2.5;
    const currentLearningStep = currentSchedule?.learning_step || 0;
    const reviewCount = currentSchedule?.review_count || 0;

    // Calculate new schedule using SM-2
    const sm2Result = calculateSM2(
      userRating as UserRating,
      currentState,
      currentInterval,
      currentEaseFactor,
      currentLearningStep,
      daysUntilDeadline
    );

    const nextReviewDate = new Date(Date.now() + sm2Result.newInterval * 60 * 1000);
    const intervalDays = sm2Result.newInterval / 1440;

    // Update schedule
    const { error: scheduleError } = await supabase
      .from('schedules')
      .upsert({
        speech_id: speechId,
        session_date: new Date().toISOString().split('T')[0],
        completed: true,
        next_review_date: nextReviewDate.toISOString(),
        interval_days: Math.max(1, Math.ceil(intervalDays)),
        ease_factor: sm2Result.newEaseFactor,
        learning_step: sm2Result.newLearningStep,
        card_state: sm2Result.newState,
        days_until_deadline: daysUntilDeadline,
        last_reviewed_at: new Date().toISOString(),
        review_count: reviewCount + 1,
        success_rate: sessionAccuracy
      }, {
        onConflict: 'speech_id'
      });

    if (scheduleError) {
      console.error('Error updating schedule:', scheduleError);
      throw scheduleError;
    }

    // Update speech performance data
    await supabase
      .from('speeches')
      .update({
        last_accuracy: sessionAccuracy,
        base_word_visibility_percent: wordVisibilityPercent
      })
      .eq('id', speechId);

    // Format interval for display
    const formatInterval = (minutes: number): string => {
      if (minutes < 60) return `${Math.round(minutes)} minute${Math.round(minutes) !== 1 ? 's' : ''}`;
      if (minutes < 1440) return `${Math.round(minutes / 60)} hour${Math.round(minutes / 60) !== 1 ? 's' : ''}`;
      const days = minutes / 1440;
      if (days < 30) return `${Math.round(days)} day${Math.round(days) !== 1 ? 's' : ''}`;
      return `${(days / 30).toFixed(1)} months`;
    };

    // Generate recommendation based on rating and state
    let recommendation = '';
    const intervalDisplay = formatInterval(sm2Result.newInterval);
    
    if (userRating === 'again') {
      recommendation = `📚 Needs more practice. Review again in ${intervalDisplay}. Try focusing on smaller sections.`;
    } else if (userRating === 'hard') {
      recommendation = `💪 Keep working at it. Next review in ${intervalDisplay}. You're making progress!`;
    } else if (userRating === 'good') {
      if (sm2Result.newState === 'review') {
        recommendation = `✅ Great job! You've mastered this for now. See you in ${intervalDisplay}.`;
      } else {
        recommendation = `👍 Good progress! Next step in ${intervalDisplay}.`;
      }
    } else if (userRating === 'easy') {
      recommendation = `🌟 Excellent recall! Extended interval to ${intervalDisplay}. Keep it up!`;
    }

    console.log('📊 SM-2 update complete:', {
      previousState: currentState,
      newState: sm2Result.newState,
      newInterval: sm2Result.newInterval,
      newEaseFactor: sm2Result.newEaseFactor,
      nextReview: nextReviewDate
    });

    return new Response(
      JSON.stringify({
        success: true,
        rating: userRating,
        previousState: currentState,
        newState: sm2Result.newState,
        intervalMinutes: sm2Result.newInterval,
        intervalDisplay,
        easeFactor: sm2Result.newEaseFactor,
        learningStep: sm2Result.newLearningStep,
        nextReviewDate: nextReviewDate.toISOString(),
        daysUntilDeadline,
        reviewCount: reviewCount + 1,
        recommendation
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-sm2-schedule:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
