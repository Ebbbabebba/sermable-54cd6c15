-- Update calculate_practice_frequency to consider word visibility
-- High visibility (many words still visible) means user is just reading, not memorizing
-- Low visibility (few words visible) means true memorization is being tested
CREATE OR REPLACE FUNCTION public.calculate_practice_frequency(
  p_days_until_deadline integer,
  p_performance_trend numeric,
  p_last_accuracy numeric,
  p_consecutive_struggles integer,
  p_word_count integer DEFAULT 0,
  p_word_visibility numeric DEFAULT 100
)
RETURNS numeric
LANGUAGE plpgsql
AS $function$
DECLARE
  frequency_multiplier NUMERIC := 1.0;
  urgency_factor NUMERIC := 1.0;
  performance_factor NUMERIC := 1.0;
  length_factor NUMERIC := 1.0;
  visibility_factor NUMERIC := 1.0;
BEGIN
  -- Urgency factor: exponentially increase frequency as deadline approaches
  IF p_days_until_deadline <= 0 THEN
    urgency_factor := 1440.0;
  ELSIF p_days_until_deadline = 1 THEN
    urgency_factor := 144.0;
  ELSIF p_days_until_deadline = 2 THEN
    urgency_factor := 48.0;
  ELSIF p_days_until_deadline <= 3 THEN
    urgency_factor := 24.0;
  ELSIF p_days_until_deadline <= 7 THEN
    urgency_factor := 6.0;
  ELSIF p_days_until_deadline <= 14 THEN
    urgency_factor := 2.0;
  ELSIF p_days_until_deadline <= 30 THEN
    urgency_factor := 1.0;
  ELSE
    urgency_factor := 0.5;
  END IF;

  -- Visibility factor: maintain high frequency when most words are still visible
  -- This accounts for "false positive" high accuracy when just reading the script
  IF p_word_visibility >= 80 THEN
    visibility_factor := 2.0;
  ELSIF p_word_visibility >= 60 THEN
    visibility_factor := 1.5;
  ELSIF p_word_visibility >= 40 THEN
    visibility_factor := 1.2;
  ELSIF p_word_visibility >= 20 THEN
    visibility_factor := 1.0;
  ELSE
    visibility_factor := 0.9;
  END IF;

  -- Performance factor: increase frequency if struggling
  IF p_consecutive_struggles >= 3 THEN
    performance_factor := 3.0;
  ELSIF p_consecutive_struggles >= 2 THEN
    performance_factor := 2.0;
  ELSIF p_last_accuracy < 60 THEN
    performance_factor := 2.5;
  ELSIF p_last_accuracy < 70 THEN
    performance_factor := 1.8;
  ELSIF p_last_accuracy < 80 THEN
    performance_factor := 1.3;
  ELSIF p_last_accuracy >= 90 AND p_word_visibility < 50 THEN
    performance_factor := 0.7;
  END IF;

  -- Adjust for performance trend
  IF p_performance_trend < -0.3 THEN
    performance_factor := performance_factor * 1.5;
  ELSIF p_performance_trend > 0.3 AND p_word_visibility < 50 THEN
    performance_factor := performance_factor * 0.8;
  END IF;

  -- Length factor: longer speeches need more frequent practice
  IF p_word_count > 0 THEN
    IF p_word_count > 1000 THEN
      length_factor := 1.8;
    ELSIF p_word_count > 500 THEN
      length_factor := 1.4;
    ELSIF p_word_count > 250 THEN
      length_factor := 1.2;
    ELSIF p_word_count < 100 THEN
      length_factor := 0.8;
    END IF;
  END IF;

  -- Combine all factors, with visibility being a key modifier
  frequency_multiplier := urgency_factor * performance_factor * length_factor * visibility_factor;

  -- Cap at reasonable limits
  frequency_multiplier := GREATEST(0.5, LEAST(1440.0, frequency_multiplier));

  RETURN frequency_multiplier;
END;
$function$;