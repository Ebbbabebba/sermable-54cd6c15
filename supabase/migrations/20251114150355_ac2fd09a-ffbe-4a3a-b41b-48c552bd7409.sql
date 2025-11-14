-- Drop the existing function first
DROP FUNCTION IF EXISTS calculate_word_visibility(uuid, date, numeric, integer);

-- Create enhanced word visibility function with strict deadline-based rules
CREATE OR REPLACE FUNCTION calculate_word_visibility(
  p_speech_id uuid,
  p_goal_date date,
  p_performance_trend numeric,
  p_consecutive_struggles integer,
  p_weighted_accuracy numeric DEFAULT 50
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  days_remaining integer;
  base_visibility numeric;
  performance_adjustment numeric;
  struggle_penalty numeric;
  final_visibility numeric;
BEGIN
  -- Calculate days until deadline
  days_remaining := p_goal_date - CURRENT_DATE;
  
  -- STRICT DEADLINE-BASED RULES for note allowance
  IF days_remaining < 3 THEN
    -- <3 days: NO NOTES AT ALL (max 10% visibility regardless of performance)
    base_visibility := 10;
    
    -- Only allow slight increases if really struggling
    IF p_consecutive_struggles >= 3 THEN
      base_visibility := 20;
    END IF;
    
  ELSIF days_remaining <= 7 THEN
    -- 3-7 days: MINIMAL NOTES (10-30% visibility)
    IF p_weighted_accuracy >= 70 THEN
      base_visibility := 10;
    ELSIF p_weighted_accuracy >= 50 THEN
      base_visibility := 20;
    ELSE
      base_visibility := 30;
    END IF;
    
  ELSE
    -- 7+ days: NOTES ALLOWED - progressive reduction based on performance
    IF p_weighted_accuracy >= 80 THEN
      -- Excellent weighted performance: reduce notes significantly
      base_visibility := 40 - (p_weighted_accuracy - 80) * 1.5;
    ELSIF p_weighted_accuracy >= 60 THEN
      -- Good weighted performance: moderate notes
      base_visibility := 60 - (p_weighted_accuracy - 60);
    ELSIF p_weighted_accuracy >= 40 THEN
      -- Fair weighted performance: more notes
      base_visibility := 80;
    ELSE
      -- Poor weighted performance: full notes
      base_visibility := 100;
    END IF;
  END IF;
  
  -- Adjust based on performance trend (but respect deadline limits)
  performance_adjustment := p_performance_trend * 10;
  
  -- Penalty for consecutive struggles (show more words if struggling)
  struggle_penalty := LEAST(p_consecutive_struggles * 10, 30);
  
  -- Calculate final visibility
  final_visibility := base_visibility - performance_adjustment + struggle_penalty;
  
  -- Apply bounds based on deadline
  IF days_remaining < 3 THEN
    final_visibility := GREATEST(5, LEAST(25, final_visibility));
  ELSIF days_remaining <= 7 THEN
    final_visibility := GREATEST(10, LEAST(40, final_visibility));
  ELSE
    final_visibility := GREATEST(10, LEAST(100, final_visibility));
  END IF;
  
  RETURN final_visibility;
END;
$$;