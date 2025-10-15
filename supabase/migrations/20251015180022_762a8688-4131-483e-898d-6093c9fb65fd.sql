-- Fix search_path for database functions
DROP FUNCTION IF EXISTS calculate_next_interval(INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS update_mastery_level(UUID, NUMERIC);

-- Function to calculate next practice interval based on performance
CREATE OR REPLACE FUNCTION calculate_next_interval(
  current_interval INTEGER,
  accuracy NUMERIC
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Spaced repetition algorithm (SM-2 inspired)
  IF accuracy >= 90 THEN
    -- Excellent performance: increase interval significantly
    RETURN LEAST(current_interval * 2, 30);
  ELSIF accuracy >= 70 THEN
    -- Good performance: moderate increase
    RETURN LEAST(current_interval + 2, 20);
  ELSE
    -- Poor performance: reset to short interval
    RETURN 1;
  END IF;
END;
$$;

-- Function to update mastery level
CREATE OR REPLACE FUNCTION update_mastery_level(
  p_speech_id UUID,
  p_accuracy NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_mastery NUMERIC;
  new_mastery NUMERIC;
BEGIN
  -- Get current mastery
  SELECT mastery_level INTO current_mastery
  FROM speeches
  WHERE id = p_speech_id;

  -- Calculate new mastery (weighted average favoring recent performance)
  new_mastery := (current_mastery * 0.7) + (p_accuracy * 0.3);
  
  -- Update speech mastery
  UPDATE speeches
  SET mastery_level = new_mastery
  WHERE id = p_speech_id;
END;
$$;