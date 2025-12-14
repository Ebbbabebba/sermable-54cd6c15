-- Add consecutive_sessions_correct column to mastered_words for "2x tested = stable" rule
ALTER TABLE public.mastered_words 
ADD COLUMN IF NOT EXISTS consecutive_sessions_correct integer DEFAULT 0;

-- Add comment explaining the column
COMMENT ON COLUMN public.mastered_words.consecutive_sessions_correct IS 'Tracks consecutive sessions where word was spoken correctly. Word only permanently hidden after 2 consecutive correct sessions.';