-- Add recall scheduling columns to practice_beats for granular spaced repetition
ALTER TABLE practice_beats ADD COLUMN IF NOT EXISTS recall_10min_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE practice_beats ADD COLUMN IF NOT EXISTS recall_evening_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE practice_beats ADD COLUMN IF NOT EXISTS recall_morning_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE practice_beats ADD COLUMN IF NOT EXISTS last_merged_recall_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient notification queries
CREATE INDEX IF NOT EXISTS idx_practice_beats_recall_times 
ON practice_beats (recall_10min_at, recall_evening_at, recall_morning_at) 
WHERE is_mastered = true;