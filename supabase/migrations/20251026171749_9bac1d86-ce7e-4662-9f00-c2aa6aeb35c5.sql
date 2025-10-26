-- Fix familiarity_level constraint to match UI options
ALTER TABLE speeches DROP CONSTRAINT IF EXISTS speeches_familiarity_level_check;

ALTER TABLE speeches ADD CONSTRAINT speeches_familiarity_level_check 
  CHECK (familiarity_level IN ('beginner', 'intermediate', 'confident'));

-- Update default value
ALTER TABLE speeches ALTER COLUMN familiarity_level SET DEFAULT 'beginner';