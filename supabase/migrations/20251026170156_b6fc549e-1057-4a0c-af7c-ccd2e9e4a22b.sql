-- Add skill level to profiles for personalization
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skill_level TEXT DEFAULT 'beginner' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced'));

-- Add difficulty score to practice sessions
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS difficulty_score NUMERIC;
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS connector_words JSONB;

-- Update scheduling function to use deadline and skill level
CREATE OR REPLACE FUNCTION public.calculate_personalized_interval(
  p_current_interval INTEGER,
  p_accuracy NUMERIC,
  p_difficulty_level TEXT,
  p_skill_level TEXT,
  p_days_until_deadline INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_multiplier NUMERIC;
  difficulty_modifier NUMERIC;
  skill_modifier NUMERIC;
  deadline_modifier NUMERIC;
BEGIN
  -- Base multiplier based on accuracy
  IF p_accuracy >= 90 THEN
    base_multiplier := 2.0;
  ELSIF p_accuracy >= 80 THEN
    base_multiplier := 1.5;
  ELSIF p_accuracy >= 70 THEN
    base_multiplier := 1.2;
  ELSIF p_accuracy >= 60 THEN
    base_multiplier := 1.0;
  ELSE
    RETURN 1; -- Reset to 1 day if poor performance
  END IF;

  -- Difficulty modifier
  difficulty_modifier := CASE p_difficulty_level
    WHEN 'easy' THEN 1.2
    WHEN 'hard' THEN 0.8
    ELSE 1.0
  END;

  -- Skill level modifier (advanced users progress faster)
  skill_modifier := CASE p_skill_level
    WHEN 'advanced' THEN 1.3
    WHEN 'intermediate' THEN 1.1
    ELSE 0.9 -- Beginners go slower
  END;

  -- Deadline pressure modifier (closer deadline = more frequent reviews)
  IF p_days_until_deadline <= 3 THEN
    deadline_modifier := 0.5; -- Review every 0.5x interval
  ELSIF p_days_until_deadline <= 7 THEN
    deadline_modifier := 0.7;
  ELSIF p_days_until_deadline <= 14 THEN
    deadline_modifier := 0.9;
  ELSE
    deadline_modifier := 1.0;
  END IF;

  -- Calculate final interval
  RETURN LEAST(
    GREATEST(1, FLOOR(
      p_current_interval * 
      base_multiplier * 
      difficulty_modifier * 
      skill_modifier * 
      deadline_modifier
    )),
    CASE 
      WHEN p_days_until_deadline <= 7 THEN 2 -- Max 2 days if deadline is close
      WHEN p_days_until_deadline <= 14 THEN 5 -- Max 5 days if deadline is approaching
      ELSE 30 -- Max 30 days otherwise
    END
  )::INTEGER;
END;
$$;

-- Update the schedule update function to use personalized intervals
CREATE OR REPLACE FUNCTION public.update_personalized_schedule(
  p_speech_id UUID,
  p_accuracy NUMERIC,
  p_session_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS VOID
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
  v_skill_level TEXT;
  v_goal_date DATE;
  v_days_until_deadline INTEGER;
  v_user_id UUID;
  v_new_interval INTEGER;
  v_new_success_rate NUMERIC;
  v_next_review_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get speech info and user skill level
  SELECT s.user_id, s.goal_date, p.skill_level
  INTO v_user_id, v_goal_date, v_skill_level
  FROM speeches s
  JOIN profiles p ON s.user_id = p.id
  WHERE s.id = p_speech_id;

  -- Calculate days until deadline
  v_days_until_deadline := v_goal_date - p_session_date::DATE;

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

  -- Calculate new interval with personalization
  v_new_interval := calculate_personalized_interval(
    v_current_interval,
    p_accuracy,
    v_difficulty_level,
    v_skill_level,
    v_days_until_deadline
  );
  
  -- Calculate new success rate
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

  -- Update speech mastery level
  PERFORM update_mastery_level(p_speech_id, p_accuracy);
END;
$$;

-- Update trigger to use new personalized function
DROP TRIGGER IF EXISTS update_schedule_after_practice ON practice_sessions;
CREATE TRIGGER update_schedule_after_practice
  AFTER INSERT ON practice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_schedule_after_practice();

CREATE OR REPLACE FUNCTION public.trigger_update_schedule_after_practice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use personalized scheduling
  PERFORM update_personalized_schedule(
    NEW.speech_id,
    COALESCE(NEW.score, 0),
    NEW.session_date
  );
  
  RETURN NEW;
END;
$$;