-- Create function to assess if a speech can be memorized by the deadline
CREATE OR REPLACE FUNCTION assess_memorization_feasibility(
  p_speech_id UUID
)
RETURNS TABLE(
  feasible BOOLEAN,
  warning_level TEXT,
  message TEXT,
  recommended_daily_sessions INTEGER,
  estimated_days_needed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_word_count INTEGER;
  v_current_word_count INTEGER;
  v_words_remaining INTEGER;
  v_goal_date DATE;
  v_days_remaining INTEGER;
  v_last_accuracy NUMERIC;
  v_review_count INTEGER;
  v_success_rate NUMERIC;
  v_avg_words_per_day NUMERIC;
  v_estimated_days INTEGER;
  v_recommended_sessions INTEGER;
BEGIN
  -- Get speech data
  SELECT 
    array_length(regexp_split_to_array(trim(text_original), '\s+'), 1),
    array_length(regexp_split_to_array(trim(text_current), '\s+'), 1),
    goal_date,
    GREATEST(0, last_accuracy),
    s.goal_date - CURRENT_DATE
  INTO 
    v_original_word_count,
    v_current_word_count,
    v_goal_date,
    v_last_accuracy,
    v_days_remaining
  FROM speeches s
  WHERE s.id = p_speech_id;
  
  -- Calculate words remaining to memorize
  v_words_remaining := GREATEST(0, v_current_word_count);
  
  -- Get practice history
  SELECT 
    COALESCE(COUNT(*), 0),
    COALESCE(AVG(score), 0)
  INTO v_review_count, v_success_rate
  FROM practice_sessions
  WHERE speech_id = p_speech_id
    AND session_date >= CURRENT_DATE - INTERVAL '7 days';
  
  -- Estimate learning rate based on speech length and performance
  -- Rough estimation: 50-100 words per day for beginners, 100-200 for intermediate, 200-300 for advanced
  -- Adjusted by current success rate
  IF v_last_accuracy >= 85 THEN
    v_avg_words_per_day := 150; -- Good learner
  ELSIF v_last_accuracy >= 70 THEN
    v_avg_words_per_day := 100; -- Average learner
  ELSIF v_last_accuracy >= 50 THEN
    v_avg_words_per_day := 75;  -- Struggling learner
  ELSE
    v_avg_words_per_day := 50;  -- New or very difficult
  END IF;
  
  -- Adjust based on speech difficulty (longer speeches are harder per word)
  IF v_original_word_count > 1000 THEN
    v_avg_words_per_day := v_avg_words_per_day * 0.7;
  ELSIF v_original_word_count > 500 THEN
    v_avg_words_per_day := v_avg_words_per_day * 0.85;
  END IF;
  
  -- Calculate estimated days needed
  v_estimated_days := CEIL(v_words_remaining / v_avg_words_per_day::numeric);
  
  -- Calculate recommended daily sessions based on urgency
  IF v_days_remaining <= 1 THEN
    v_recommended_sessions := 6; -- Intensive final day
  ELSIF v_days_remaining <= 3 THEN
    v_recommended_sessions := 4; -- Very frequent
  ELSIF v_days_remaining <= 7 THEN
    v_recommended_sessions := 3; -- Frequent
  ELSIF v_days_remaining <= 14 THEN
    v_recommended_sessions := 2; -- Moderate
  ELSE
    v_recommended_sessions := 1; -- Normal pace
  END IF;
  
  -- Determine feasibility and warning level
  IF v_days_remaining < 0 THEN
    -- Past deadline
    RETURN QUERY SELECT 
      false,
      'overdue'::TEXT,
      '⏰ Your presentation deadline has passed!'::TEXT,
      1::INTEGER,
      0::INTEGER;
  ELSIF v_estimated_days <= v_days_remaining * 0.5 THEN
    -- Plenty of time
    RETURN QUERY SELECT 
      true,
      'comfortable'::TEXT,
      format('✅ You have plenty of time. Estimated %s days needed, %s days remaining.', v_estimated_days, v_days_remaining)::TEXT,
      v_recommended_sessions,
      v_estimated_days;
  ELSIF v_estimated_days <= v_days_remaining THEN
    -- Tight but feasible
    RETURN QUERY SELECT 
      true,
      'tight'::TEXT,
      format('⚠️ Timeline is tight. Estimated %s days needed, %s days remaining. Stay consistent!', v_estimated_days, v_days_remaining)::TEXT,
      v_recommended_sessions,
      v_estimated_days;
  ELSIF v_days_remaining >= 3 THEN
    -- Challenging but possible with intensive practice
    RETURN QUERY SELECT 
      true,
      'challenging'::TEXT,
      format('🔥 Intensive practice needed! Estimated %s days needed, only %s days remaining. Practice %s times per day.', 
        v_estimated_days, v_days_remaining, v_recommended_sessions)::TEXT,
      v_recommended_sessions,
      v_estimated_days;
  ELSIF v_days_remaining >= 1 THEN
    -- Critical - unlikely to fully memorize but maximize learning
    RETURN QUERY SELECT 
      false,
      'critical'::TEXT,
      format('⚠️ WARNING: Speech length (%s words) may be too long to fully memorize in %s %s. Focus on key points and practice intensively!', 
        v_words_remaining, 
        v_days_remaining,
        CASE WHEN v_days_remaining = 1 THEN 'day' ELSE 'days' END)::TEXT,
      v_recommended_sessions,
      v_estimated_days;
  ELSE
    -- Less than 1 day
    RETURN QUERY SELECT 
      false,
      'emergency'::TEXT,
      format('🚨 URGENT: Presentation in less than 24 hours with %s words remaining. Practice key points repeatedly!', v_words_remaining)::TEXT,
      v_recommended_sessions,
      v_estimated_days;
  END IF;
END;
$$;