-- Enhanced Spaced Repetition System

-- Add columns to track spaced repetition metrics
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS success_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'normal' CHECK (difficulty_level IN ('easy', 'normal', 'hard'));

-- Update the calculate_next_interval function to use SM-2 inspired algorithm
CREATE OR REPLACE FUNCTION public.calculate_next_interval(
  current_interval INTEGER,
  accuracy NUMERIC,
  difficulty_level TEXT DEFAULT 'normal'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_multiplier NUMERIC;
  difficulty_modifier NUMERIC;
BEGIN
  -- Set difficulty modifier
  difficulty_modifier := CASE difficulty_level
    WHEN 'easy' THEN 1.2
    WHEN 'hard' THEN 0.8
    ELSE 1.0
  END;

  -- Exponential interval based on performance
  IF accuracy >= 90 THEN
    -- Excellent: double the interval (max 30 days)
    base_multiplier := 2.0;
  ELSIF accuracy >= 80 THEN
    -- Good: 1.5x interval (max 21 days)
    base_multiplier := 1.5;
  ELSIF accuracy >= 70 THEN
    -- Fair: 1.2x interval (max 14 days)
    base_multiplier := 1.2;
  ELSIF accuracy >= 60 THEN
    -- Poor: keep same interval (max 7 days)
    base_multiplier := 1.0;
  ELSE
    -- Failed: reset to 1 day
    RETURN 1;
  END IF;

  -- Apply difficulty modifier and cap at reasonable maximums
  RETURN LEAST(
    GREATEST(1, FLOOR(current_interval * base_multiplier * difficulty_modifier)),
    30 -- Max 30 days
  )::INTEGER;
END;
$$;

-- Function to update schedule after practice session
CREATE OR REPLACE FUNCTION public.update_schedule_after_practice(
  p_speech_id UUID,
  p_accuracy NUMERIC,
  p_session_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_schedule_id UUID;
  v_current_interval INTEGER;
  v_current_success_rate NUMERIC;
  v_review_count INTEGER;
  v_difficulty_level TEXT;
  v_new_interval INTEGER;
  v_new_success_rate NUMERIC;
  v_next_review_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get or create schedule record
  SELECT id, interval_days, success_rate, review_count, difficulty_level
  INTO v_schedule_id, v_current_interval, v_current_success_rate, v_review_count, v_difficulty_level
  FROM schedules
  WHERE speech_id = p_speech_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no schedule exists, create one
  IF v_schedule_id IS NULL THEN
    v_current_interval := 1;
    v_current_success_rate := 0;
    v_review_count := 0;
    v_difficulty_level := 'normal';
    
    INSERT INTO schedules (speech_id, session_date, interval_days, next_review_date)
    VALUES (
      p_speech_id,
      p_session_date::DATE,
      1,
      (p_session_date + INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE
    )
    RETURNING id INTO v_schedule_id;
  END IF;

  -- Calculate new interval
  v_new_interval := calculate_next_interval(v_current_interval, p_accuracy, v_difficulty_level);
  
  -- Calculate new success rate (weighted average favoring recent performance)
  v_new_success_rate := (v_current_success_rate * v_review_count + p_accuracy) / (v_review_count + 1);
  
  -- Adjust difficulty based on success rate
  IF v_new_success_rate >= 95 AND v_review_count >= 3 THEN
    v_difficulty_level := 'easy';
  ELSIF v_new_success_rate < 70 AND v_review_count >= 2 THEN
    v_difficulty_level := 'hard';
  ELSE
    v_difficulty_level := 'normal';
  END IF;

  -- Calculate next review date
  v_next_review_date := p_session_date + (v_new_interval || ' days')::INTERVAL;

  -- Update schedule
  UPDATE schedules
  SET
    last_reviewed_at = p_session_date,
    success_rate = v_new_success_rate,
    review_count = v_review_count + 1,
    interval_days = v_new_interval,
    next_review_date = v_next_review_date,
    difficulty_level = v_difficulty_level,
    mastery_score = v_new_success_rate,
    completed = (v_new_success_rate >= 95 AND v_review_count >= 5)
  WHERE id = v_schedule_id;

  -- Also update speech mastery level
  PERFORM update_mastery_level(p_speech_id, p_accuracy);
END;
$$;

-- Trigger to auto-update schedule when practice session is created
CREATE OR REPLACE FUNCTION public.trigger_update_schedule_after_practice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update schedule based on practice session performance
  PERFORM update_schedule_after_practice(
    NEW.speech_id,
    COALESCE(NEW.score, 0),
    NEW.session_date
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger on practice_sessions
DROP TRIGGER IF EXISTS on_practice_session_created ON practice_sessions;
CREATE TRIGGER on_practice_session_created
  AFTER INSERT ON practice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_schedule_after_practice();

-- Function to get speeches due for review today
CREATE OR REPLACE FUNCTION public.get_speeches_due_for_review(p_user_id UUID)
RETURNS TABLE (
  speech_id UUID,
  speech_title TEXT,
  next_review_date TIMESTAMP WITH TIME ZONE,
  interval_days INTEGER,
  success_rate NUMERIC,
  review_count INTEGER,
  difficulty_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.title,
    sch.next_review_date,
    sch.interval_days,
    sch.success_rate,
    sch.review_count,
    sch.difficulty_level
  FROM speeches s
  INNER JOIN schedules sch ON s.id = sch.speech_id
  WHERE s.user_id = p_user_id
    AND sch.next_review_date <= NOW()
    AND sch.completed = false
  ORDER BY sch.next_review_date ASC;
END;
$$;