-- Fix: Add search_path to functions with mutable search_path
-- This prevents potential privilege escalation attacks

-- Fix calculate_next_review
CREATE OR REPLACE FUNCTION public.calculate_next_review(
  current_ease numeric,
  current_interval integer,
  performance_quality integer
)
RETURNS TABLE(new_ease numeric, new_interval integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ease_factor numeric;
  interval_days integer;
BEGIN
  ease_factor := GREATEST(1.3, current_ease + (0.1 - (5 - performance_quality) * (0.08 + (5 - performance_quality) * 0.02)));
  
  IF performance_quality < 3 THEN
    interval_days := 1;
  ELSIF current_interval = 0 THEN
    interval_days := 1;
  ELSIF current_interval = 1 THEN
    interval_days := 6;
  ELSE
    interval_days := ROUND(current_interval * ease_factor)::integer;
  END IF;
  
  RETURN QUERY SELECT ease_factor AS new_ease, interval_days AS new_interval;
END;
$$;

-- Fix calculate_practice_frequency (3 overloads)
CREATE OR REPLACE FUNCTION public.calculate_practice_frequency(
  p_consecutive_struggles integer,
  p_days_until_deadline integer,
  p_last_accuracy numeric,
  p_performance_trend numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_frequency numeric := 1.0;
  urgency_factor numeric;
  struggle_factor numeric;
  accuracy_factor numeric;
BEGIN
  urgency_factor := CASE 
    WHEN p_days_until_deadline <= 3 THEN 2.0
    WHEN p_days_until_deadline <= 7 THEN 1.5
    WHEN p_days_until_deadline <= 14 THEN 1.2
    ELSE 1.0
  END;
  
  struggle_factor := 1.0 + (p_consecutive_struggles * 0.25);
  accuracy_factor := CASE 
    WHEN p_last_accuracy < 0.6 THEN 1.5
    WHEN p_last_accuracy < 0.8 THEN 1.2
    ELSE 1.0
  END;
  
  RETURN base_frequency * urgency_factor * struggle_factor * accuracy_factor;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_practice_frequency(
  p_consecutive_struggles integer,
  p_days_until_deadline integer,
  p_last_accuracy numeric,
  p_performance_trend numeric,
  p_word_count integer DEFAULT 0
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_frequency numeric := 1.0;
  urgency_factor numeric;
  struggle_factor numeric;
  accuracy_factor numeric;
  word_factor numeric;
BEGIN
  urgency_factor := CASE 
    WHEN p_days_until_deadline <= 3 THEN 2.0
    WHEN p_days_until_deadline <= 7 THEN 1.5
    WHEN p_days_until_deadline <= 14 THEN 1.2
    ELSE 1.0
  END;
  
  struggle_factor := 1.0 + (p_consecutive_struggles * 0.25);
  accuracy_factor := CASE 
    WHEN p_last_accuracy < 0.6 THEN 1.5
    WHEN p_last_accuracy < 0.8 THEN 1.2
    ELSE 1.0
  END;
  
  word_factor := CASE 
    WHEN p_word_count > 500 THEN 1.3
    WHEN p_word_count > 200 THEN 1.1
    ELSE 1.0
  END;
  
  RETURN base_frequency * urgency_factor * struggle_factor * accuracy_factor * word_factor;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_practice_frequency(
  p_consecutive_struggles integer,
  p_days_until_deadline integer,
  p_last_accuracy numeric,
  p_performance_trend numeric,
  p_word_count integer DEFAULT 0,
  p_word_visibility numeric DEFAULT 100
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_frequency numeric := 1.0;
  urgency_factor numeric;
  struggle_factor numeric;
  accuracy_factor numeric;
  word_factor numeric;
  visibility_factor numeric;
BEGIN
  urgency_factor := CASE 
    WHEN p_days_until_deadline <= 3 THEN 2.0
    WHEN p_days_until_deadline <= 7 THEN 1.5
    WHEN p_days_until_deadline <= 14 THEN 1.2
    ELSE 1.0
  END;
  
  struggle_factor := 1.0 + (p_consecutive_struggles * 0.25);
  accuracy_factor := CASE 
    WHEN p_last_accuracy < 0.6 THEN 1.5
    WHEN p_last_accuracy < 0.8 THEN 1.2
    ELSE 1.0
  END;
  
  word_factor := CASE 
    WHEN p_word_count > 500 THEN 1.3
    WHEN p_word_count > 200 THEN 1.1
    ELSE 1.0
  END;
  
  visibility_factor := CASE 
    WHEN p_word_visibility < 30 THEN 0.8
    WHEN p_word_visibility > 70 THEN 1.2
    ELSE 1.0
  END;
  
  RETURN base_frequency * urgency_factor * struggle_factor * accuracy_factor * word_factor * visibility_factor;
END;
$$;

-- Fix calculate_segment_length
CREATE OR REPLACE FUNCTION public.calculate_segment_length(
  p_consecutive_struggles integer,
  p_current_segment_length integer,
  p_days_until_deadline integer,
  p_weighted_accuracy numeric
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_length integer;
BEGIN
  IF p_weighted_accuracy >= 0.9 AND p_consecutive_struggles = 0 THEN
    new_length := LEAST(p_current_segment_length + 5, 50);
  ELSIF p_weighted_accuracy < 0.6 OR p_consecutive_struggles >= 2 THEN
    new_length := GREATEST(p_current_segment_length - 5, 10);
  ELSE
    new_length := p_current_segment_length;
  END IF;
  
  RETURN new_length;
END;
$$;

-- Fix calculate_sm2_interval
CREATE OR REPLACE FUNCTION public.calculate_sm2_interval(
  p_card_state text,
  p_current_interval integer,
  p_ease_factor numeric,
  p_learning_step integer,
  p_user_rating text
)
RETURNS TABLE(new_card_state text, new_ease_factor numeric, new_interval integer, new_learning_step integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ease numeric;
  interval_days integer;
  step integer;
  state text;
BEGIN
  ease := p_ease_factor;
  interval_days := p_current_interval;
  step := p_learning_step;
  state := p_card_state;
  
  IF p_user_rating = 'again' THEN
    ease := GREATEST(1.3, ease - 0.2);
    interval_days := 1;
    step := 0;
    state := 'learning';
  ELSIF p_user_rating = 'hard' THEN
    ease := GREATEST(1.3, ease - 0.15);
    interval_days := GREATEST(1, ROUND(interval_days * 1.2)::integer);
  ELSIF p_user_rating = 'good' THEN
    IF state = 'learning' THEN
      step := step + 1;
      IF step >= 2 THEN
        state := 'review';
        interval_days := 1;
      END IF;
    ELSE
      interval_days := ROUND(interval_days * ease)::integer;
    END IF;
  ELSIF p_user_rating = 'easy' THEN
    ease := ease + 0.15;
    interval_days := ROUND(interval_days * ease * 1.3)::integer;
    state := 'review';
  END IF;
  
  RETURN QUERY SELECT state AS new_card_state, ease AS new_ease_factor, interval_days AS new_interval, step AS new_learning_step;
END;
$$;

-- Fix calculate_word_visibility
CREATE OR REPLACE FUNCTION public.calculate_word_visibility(
  p_consecutive_struggles integer,
  p_goal_date date,
  p_performance_trend numeric,
  p_speech_id uuid,
  p_weighted_accuracy numeric DEFAULT 0.8
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_visibility numeric := 80;
  current_visibility numeric;
  days_until_deadline integer;
BEGIN
  days_until_deadline := GREATEST(0, p_goal_date - CURRENT_DATE);
  
  SELECT COALESCE(base_word_visibility_percent, 80)
  INTO current_visibility
  FROM public.speeches
  WHERE id = p_speech_id;
  
  IF p_weighted_accuracy >= 0.95 AND p_consecutive_struggles = 0 THEN
    current_visibility := GREATEST(0, current_visibility - 10);
  ELSIF p_weighted_accuracy < 0.6 OR p_consecutive_struggles >= 2 THEN
    current_visibility := LEAST(100, current_visibility + 15);
  ELSIF p_weighted_accuracy < 0.8 THEN
    current_visibility := LEAST(100, current_visibility + 5);
  ELSE
    current_visibility := GREATEST(0, current_visibility - 5);
  END IF;
  
  RETURN current_visibility;
END;
$$;

-- Add DELETE policy for profiles table (GDPR compliance)
CREATE POLICY "Users can delete own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);