-- Add segment tracking columns to speeches table
ALTER TABLE speeches 
ADD COLUMN IF NOT EXISTS current_segment_length INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS target_segment_length INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS practice_segment_start INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS practice_segment_end INTEGER DEFAULT 100;

-- Add comment explaining the segment system
COMMENT ON COLUMN speeches.current_segment_length IS 'Current practice segment size as percentage of full speech (20-100%)';
COMMENT ON COLUMN speeches.target_segment_length IS 'Target segment length for next practice (adjusts based on performance)';
COMMENT ON COLUMN speeches.practice_segment_start IS 'Word index where current practice segment starts';
COMMENT ON COLUMN speeches.practice_segment_end IS 'Word index where current practice segment ends';

-- Create function to calculate optimal segment length
CREATE OR REPLACE FUNCTION calculate_segment_length(
  p_weighted_accuracy NUMERIC,
  p_consecutive_struggles INTEGER,
  p_days_until_deadline INTEGER,
  p_current_segment_length INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_segment_length INTEGER;
BEGIN
  -- AUTOMATIC SEGMENT LENGTH RULES
  
  -- Rule 1: Close to deadline → Force full speech practice
  IF p_days_until_deadline <= 3 THEN
    RETURN 100; -- Must practice full speech
  ELSIF p_days_until_deadline <= 7 THEN
    -- Last week: At least 80% of speech
    new_segment_length := GREATEST(80, p_current_segment_length);
  ELSE
    -- Rule 2: High weighted performance → Increase segment length
    IF p_weighted_accuracy >= 75 AND p_consecutive_struggles = 0 THEN
      -- Excellent: increase by 20%
      new_segment_length := LEAST(100, p_current_segment_length + 20);
    ELSIF p_weighted_accuracy >= 60 THEN
      -- Good: increase by 10%
      new_segment_length := LEAST(100, p_current_segment_length + 10);
    
    -- Rule 3: Low weighted performance → Decrease segment length
    ELSIF p_weighted_accuracy < 40 THEN
      -- Poor: decrease by 20%
      new_segment_length := GREATEST(20, p_current_segment_length - 20);
    ELSIF p_weighted_accuracy < 50 THEN
      -- Fair: decrease by 10%
      new_segment_length := GREATEST(30, p_current_segment_length - 10);
    
    -- Rule 4: Moderate performance → Keep current length
    ELSE
      new_segment_length := p_current_segment_length;
    END IF;
  END IF;
  
  -- Apply bounds (minimum 20%, maximum 100%)
  new_segment_length := GREATEST(20, LEAST(100, new_segment_length));
  
  RETURN new_segment_length;
END;
$$;