-- Update calculate_practice_frequency to include word count and allow much higher multipliers
CREATE OR REPLACE FUNCTION calculate_practice_frequency(
  p_days_until_deadline INTEGER,
  p_performance_trend NUMERIC,
  p_last_accuracy NUMERIC,
  p_consecutive_struggles INTEGER,
  p_word_count INTEGER DEFAULT 0
) RETURNS NUMERIC AS $$
DECLARE
  frequency_multiplier NUMERIC := 1.0;
  urgency_factor NUMERIC := 1.0;
  performance_factor NUMERIC := 1.0;
  length_factor NUMERIC := 1.0;
BEGIN
  -- Urgency factor: exponentially increase frequency as deadline approaches
  -- From 0.5x (30+ days away) to 1440x (less than 1 day, needs practice every minute)
  IF p_days_until_deadline <= 0 THEN
    urgency_factor := 1440.0; -- Every minute if deadline passed
  ELSIF p_days_until_deadline = 1 THEN
    urgency_factor := 144.0; -- Every 10 minutes on deadline day
  ELSIF p_days_until_deadline = 2 THEN
    urgency_factor := 48.0; -- Every 30 minutes
  ELSIF p_days_until_deadline <= 3 THEN
    urgency_factor := 24.0; -- Every hour
  ELSIF p_days_until_deadline <= 7 THEN
    urgency_factor := 6.0; -- Every 4 hours
  ELSIF p_days_until_deadline <= 14 THEN
    urgency_factor := 2.0; -- Every 12 hours
  ELSIF p_days_until_deadline <= 30 THEN
    urgency_factor := 1.0; -- Once per day
  ELSE
    urgency_factor := 0.5; -- Every 2 days
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
  ELSIF p_last_accuracy >= 90 THEN
    performance_factor := 0.7; -- Reduce frequency if doing very well
  END IF;

  -- Adjust for performance trend
  IF p_performance_trend < -0.3 THEN
    performance_factor := performance_factor * 1.5; -- Declining performance
  ELSIF p_performance_trend > 0.3 THEN
    performance_factor := performance_factor * 0.8; -- Improving performance
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

  -- Combine all factors
  frequency_multiplier := urgency_factor * performance_factor * length_factor;

  -- Cap at reasonable limits (0.5x to 1440x)
  frequency_multiplier := GREATEST(0.5, LEAST(1440.0, frequency_multiplier));

  RETURN frequency_multiplier;
END;
$$ LANGUAGE plpgsql;