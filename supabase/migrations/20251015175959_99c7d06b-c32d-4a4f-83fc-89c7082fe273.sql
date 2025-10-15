-- Add language support and mastery tracking to speeches table
ALTER TABLE speeches 
ADD COLUMN speech_language TEXT DEFAULT 'en',
ADD COLUMN mastery_level NUMERIC DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100);

-- Add user's preferred feedback language to profiles
ALTER TABLE profiles
ADD COLUMN feedback_language TEXT DEFAULT 'sv';

-- Add mastery tracking and spaced repetition fields to practice_sessions
ALTER TABLE practice_sessions
ADD COLUMN filler_words JSONB,
ADD COLUMN tone_feedback TEXT,
ADD COLUMN analysis TEXT,
ADD COLUMN cue_text TEXT,
ADD COLUMN transcription TEXT;

-- Update schedules table for spaced repetition
ALTER TABLE schedules
ADD COLUMN mastery_score NUMERIC,
ADD COLUMN interval_days INTEGER DEFAULT 1,
ADD COLUMN next_review_date TIMESTAMP WITH TIME ZONE;

-- Function to calculate next practice interval based on performance
CREATE OR REPLACE FUNCTION calculate_next_interval(
  current_interval INTEGER,
  accuracy NUMERIC
) RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql;

-- Function to update mastery level
CREATE OR REPLACE FUNCTION update_mastery_level(
  p_speech_id UUID,
  p_accuracy NUMERIC
) RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql;