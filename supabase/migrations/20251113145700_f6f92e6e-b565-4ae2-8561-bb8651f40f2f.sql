-- Add performance tracking fields to speeches table
ALTER TABLE public.speeches 
ADD COLUMN IF NOT EXISTS performance_trend numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS consecutive_struggles integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_accuracy numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_word_visibility_percent numeric DEFAULT 100;

-- Add deadline-aware scheduling fields to schedules table
ALTER TABLE public.schedules
ADD COLUMN IF NOT EXISTS adaptive_frequency_multiplier numeric DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS days_until_deadline integer DEFAULT 30;

-- Create function to calculate deadline-based word visibility
CREATE OR REPLACE FUNCTION calculate_word_visibility(
  p_speech_id uuid,
  p_goal_date date,
  p_performance_trend numeric,
  p_consecutive_struggles integer
) RETURNS numeric AS $$
DECLARE
  days_remaining integer;
  base_visibility numeric;
  performance_adjustment numeric;
  struggle_penalty numeric;
  final_visibility numeric;
BEGIN
  -- Calculate days until deadline
  days_remaining := p_goal_date - CURRENT_DATE;
  
  -- Base visibility decreases as deadline approaches
  -- 30+ days: 100%, 20 days: 80%, 10 days: 50%, 5 days: 30%, 1 day: 10%
  IF days_remaining >= 30 THEN
    base_visibility := 100;
  ELSIF days_remaining >= 20 THEN
    base_visibility := 80 + ((days_remaining - 20) * 2);  -- 80-100%
  ELSIF days_remaining >= 10 THEN
    base_visibility := 50 + ((days_remaining - 10) * 3);  -- 50-80%
  ELSIF days_remaining >= 5 THEN
    base_visibility := 30 + ((days_remaining - 5) * 4);   -- 30-50%
  ELSIF days_remaining >= 1 THEN
    base_visibility := 10 + ((days_remaining - 1) * 5);   -- 10-30%
  ELSE
    base_visibility := 10;  -- Day of presentation
  END IF;
  
  -- Adjust based on performance trend (-1 to 1, where positive = improving)
  performance_adjustment := p_performance_trend * 15;  -- ±15% adjustment
  
  -- Penalty for consecutive struggles (show more words if struggling)
  struggle_penalty := LEAST(p_consecutive_struggles * 10, 40);  -- Up to +40% visibility
  
  -- Calculate final visibility with safety bounds
  final_visibility := base_visibility - performance_adjustment + struggle_penalty;
  final_visibility := GREATEST(10, LEAST(100, final_visibility));  -- Keep between 10-100%
  
  RETURN final_visibility;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate adaptive practice frequency
CREATE OR REPLACE FUNCTION calculate_practice_frequency(
  p_days_until_deadline integer,
  p_performance_trend numeric,
  p_last_accuracy numeric,
  p_consecutive_struggles integer
) RETURNS numeric AS $$
DECLARE
  base_multiplier numeric;
  performance_multiplier numeric;
  urgency_multiplier numeric;
  final_multiplier numeric;
BEGIN
  -- Base frequency increases as deadline approaches
  IF p_days_until_deadline >= 30 THEN
    base_multiplier := 1.0;      -- Normal frequency
  ELSIF p_days_until_deadline >= 14 THEN
    base_multiplier := 1.3;      -- 30% more frequent
  ELSIF p_days_until_deadline >= 7 THEN
    base_multiplier := 1.7;      -- 70% more frequent
  ELSIF p_days_until_deadline >= 3 THEN
    base_multiplier := 2.5;      -- 2.5x more frequent
  ELSE
    base_multiplier := 4.0;      -- 4x more frequent in final days
  END IF;
  
  -- Increase frequency if struggling (low accuracy or negative trend)
  IF p_last_accuracy < 60 OR p_consecutive_struggles >= 2 THEN
    performance_multiplier := 1.5;   -- 50% more frequent when struggling
  ELSIF p_last_accuracy < 75 OR p_performance_trend < -0.3 THEN
    performance_multiplier := 1.3;   -- 30% more frequent
  ELSIF p_last_accuracy >= 90 AND p_performance_trend > 0.5 THEN
    performance_multiplier := 0.8;   -- Can reduce frequency if doing well
  ELSE
    performance_multiplier := 1.0;
  END IF;
  
  -- Final multiplier combines all factors
  final_multiplier := base_multiplier * performance_multiplier;
  
  -- Ensure reasonable bounds (0.5x to 5x normal frequency)
  final_multiplier := GREATEST(0.5, LEAST(5.0, final_multiplier));
  
  RETURN final_multiplier;
END;
$$ LANGUAGE plpgsql;

-- Create index for deadline-based queries
CREATE INDEX IF NOT EXISTS idx_speeches_goal_date ON public.speeches(goal_date);
CREATE INDEX IF NOT EXISTS idx_speeches_performance_trend ON public.speeches(performance_trend);