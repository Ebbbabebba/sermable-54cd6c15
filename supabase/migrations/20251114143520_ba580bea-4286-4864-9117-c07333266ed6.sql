-- Phase 1: Add Anki-style spaced repetition columns

-- Add user rating to practice_sessions
ALTER TABLE practice_sessions 
ADD COLUMN user_rating TEXT CHECK (user_rating IN ('again', 'hard', 'good', 'easy'));

-- Add SR fields to schedules table
ALTER TABLE schedules
ADD COLUMN card_state TEXT DEFAULT 'new' CHECK (card_state IN ('new', 'learning', 'review', 'relearning')),
ADD COLUMN ease_factor NUMERIC DEFAULT 2.5 CHECK (ease_factor >= 1.3 AND ease_factor <= 3.0),
ADD COLUMN learning_step INTEGER DEFAULT 0 CHECK (learning_step >= 0);

-- Add learning mode to speeches table
ALTER TABLE speeches
ADD COLUMN learning_mode TEXT DEFAULT 'spaced_repetition' CHECK (learning_mode IN ('spaced_repetition', 'exam_prep')),
ALTER COLUMN goal_date DROP NOT NULL;

-- Create SM-2 interval calculation function
CREATE OR REPLACE FUNCTION calculate_sm2_interval(
  p_card_state TEXT,
  p_learning_step INTEGER,
  p_current_interval INTEGER,
  p_ease_factor NUMERIC,
  p_user_rating TEXT
) RETURNS TABLE(
  new_interval INTEGER,
  new_ease_factor NUMERIC,
  new_card_state TEXT,
  new_learning_step INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
  v_new_interval INTEGER;
  v_new_ease NUMERIC;
  v_new_state TEXT;
  v_new_step INTEGER;
BEGIN
  -- Initialize
  v_new_ease := p_ease_factor;
  v_new_state := p_card_state;
  v_new_step := p_learning_step;
  
  -- Handle based on current state
  IF p_card_state = 'new' OR p_card_state = 'learning' OR p_card_state = 'relearning' THEN
    -- Learning/Relearning Phase
    IF p_user_rating = 'again' THEN
      -- Failed: restart learning
      v_new_interval := 1; -- 1 minute
      v_new_state := 'learning';
      v_new_step := 0;
      v_new_ease := GREATEST(1.3, p_ease_factor - 0.2);
    ELSIF p_user_rating = 'hard' THEN
      -- Hard: repeat step or advance slowly
      IF p_learning_step = 0 THEN
        v_new_interval := 6; -- 6 minutes
        v_new_step := 1;
      ELSIF p_learning_step = 1 THEN
        v_new_interval := 10; -- 10 minutes
        v_new_step := 1;
      ELSE
        v_new_interval := 1440; -- 1 day (graduate to review)
        v_new_state := 'review';
        v_new_step := 0;
      END IF;
      v_new_state := 'learning';
      v_new_ease := GREATEST(1.3, p_ease_factor - 0.15);
    ELSIF p_user_rating = 'good' THEN
      -- Good: advance through learning steps
      IF p_learning_step = 0 THEN
        v_new_interval := 10; -- 10 minutes
        v_new_step := 1;
        v_new_state := 'learning';
      ELSIF p_learning_step = 1 THEN
        v_new_interval := 1440; -- 1 day (graduate)
        v_new_step := 0;
        v_new_state := 'review';
      ELSE
        v_new_interval := 1440;
        v_new_step := 0;
        v_new_state := 'review';
      END IF;
    ELSE -- 'easy'
      -- Easy: skip learning, go straight to review
      v_new_interval := 5760; -- 4 days
      v_new_state := 'review';
      v_new_step := 0;
      v_new_ease := LEAST(3.0, p_ease_factor + 0.15);
    END IF;
  ELSE
    -- Review Phase
    IF p_user_rating = 'again' THEN
      -- Failed review: back to relearning
      v_new_interval := 1; -- 1 minute
      v_new_state := 'relearning';
      v_new_step := 0;
      v_new_ease := GREATEST(1.3, p_ease_factor - 0.2);
    ELSIF p_user_rating = 'hard' THEN
      -- Hard: shorter interval, reduce ease
      v_new_interval := GREATEST(1, FLOOR(p_current_interval * 1.2))::INTEGER;
      v_new_state := 'review';
      v_new_ease := GREATEST(1.3, p_ease_factor - 0.15);
    ELSIF p_user_rating = 'good' THEN
      -- Good: standard SM-2 interval
      v_new_interval := GREATEST(1, FLOOR(p_current_interval * p_ease_factor))::INTEGER;
      v_new_state := 'review';
      -- Ease stays the same
    ELSE -- 'easy'
      -- Easy: longer interval, increase ease
      v_new_interval := GREATEST(1, FLOOR(p_current_interval * p_ease_factor * 1.3))::INTEGER;
      v_new_state := 'review';
      v_new_ease := LEAST(3.0, p_ease_factor + 0.15);
    END IF;
  END IF;
  
  -- Cap intervals at reasonable maximum (1 year = 525600 minutes)
  v_new_interval := LEAST(v_new_interval, 525600);
  
  RETURN QUERY SELECT v_new_interval, v_new_ease, v_new_state, v_new_step;
END;
$$;

-- Update the schedule update function to use SM-2
CREATE OR REPLACE FUNCTION update_sm2_schedule(
  p_speech_id UUID,
  p_user_rating TEXT,
  p_session_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_schedule RECORD;
  v_speech_mode TEXT;
  v_sm2_result RECORD;
  v_next_review TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get speech learning mode
  SELECT learning_mode INTO v_speech_mode
  FROM speeches WHERE id = p_speech_id;
  
  -- If in exam_prep mode, use old adaptive system
  IF v_speech_mode = 'exam_prep' THEN
    PERFORM update_personalized_schedule(p_speech_id, 
      CASE p_user_rating
        WHEN 'again' THEN 0
        WHEN 'hard' THEN 60
        WHEN 'good' THEN 80
        WHEN 'easy' THEN 95
      END,
      p_session_date
    );
    RETURN;
  END IF;
  
  -- Get current schedule (SR mode)
  SELECT * INTO v_schedule
  FROM schedules
  WHERE speech_id = p_speech_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Create schedule if doesn't exist
  IF v_schedule.id IS NULL THEN
    INSERT INTO schedules (
      speech_id, 
      session_date, 
      card_state,
      ease_factor,
      learning_step,
      interval_days
    ) VALUES (
      p_speech_id,
      p_session_date::DATE,
      'new',
      2.5,
      0,
      0
    )
    RETURNING * INTO v_schedule;
  END IF;
  
  -- Calculate new SM-2 values
  SELECT * INTO v_sm2_result
  FROM calculate_sm2_interval(
    v_schedule.card_state,
    COALESCE(v_schedule.learning_step, 0),
    COALESCE(v_schedule.interval_days, 0),
    COALESCE(v_schedule.ease_factor, 2.5),
    p_user_rating
  );
  
  -- Calculate next review date (intervals are in minutes)
  v_next_review := p_session_date + (v_sm2_result.new_interval || ' minutes')::INTERVAL;
  
  -- Update schedule with SM-2 values
  UPDATE schedules
  SET
    last_reviewed_at = p_session_date,
    review_count = COALESCE(review_count, 0) + 1,
    card_state = v_sm2_result.new_card_state,
    ease_factor = v_sm2_result.new_ease_factor,
    learning_step = v_sm2_result.new_learning_step,
    interval_days = v_sm2_result.new_interval,
    next_review_date = v_next_review,
    success_rate = CASE 
      WHEN p_user_rating IN ('good', 'easy') THEN 
        (COALESCE(success_rate, 0) * COALESCE(review_count, 0) + 100) / (COALESCE(review_count, 0) + 1)
      ELSE 
        (COALESCE(success_rate, 0) * COALESCE(review_count, 0)) / (COALESCE(review_count, 0) + 1)
    END
  WHERE id = v_schedule.id;
END;
$$;