-- Add spaced repetition tracking to speeches table
ALTER TABLE public.speeches 
ADD COLUMN IF NOT EXISTS next_review_date timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS review_interval integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS ease_factor numeric DEFAULT 2.5;

-- Create index for efficient review date queries
CREATE INDEX IF NOT EXISTS idx_speeches_next_review_date ON public.speeches(next_review_date);

-- Add function to calculate next review date based on performance
CREATE OR REPLACE FUNCTION calculate_next_review(
  current_interval integer,
  current_ease numeric,
  performance_quality integer  -- 0-5 scale (0=fail, 3=good, 5=perfect)
) RETURNS TABLE(new_interval integer, new_ease numeric) AS $$
DECLARE
  v_new_ease numeric;
  v_new_interval integer;
BEGIN
  -- Anki-style SM-2 algorithm
  v_new_ease := current_ease + (0.1 - (5 - performance_quality) * (0.08 + (5 - performance_quality) * 0.02));
  
  -- Ease factor should be at least 1.3
  IF v_new_ease < 1.3 THEN
    v_new_ease := 1.3;
  END IF;
  
  -- Calculate new interval
  IF performance_quality < 3 THEN
    -- Failed review, reset to 1 day
    v_new_interval := 1;
  ELSE
    IF current_interval = 1 THEN
      v_new_interval := 6;  -- First successful review: 6 days
    ELSE
      v_new_interval := ROUND(current_interval * v_new_ease)::integer;
    END IF;
  END IF;
  
  RETURN QUERY SELECT v_new_interval, v_new_ease;
END;
$$ LANGUAGE plpgsql;