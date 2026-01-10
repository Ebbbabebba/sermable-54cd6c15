-- Add mastered_at timestamp to track when a beat was mastered (for morning recall)
-- Add needs_recall to flag beats that need quick review before learning new ones
ALTER TABLE public.practice_beats 
ADD COLUMN IF NOT EXISTS mastered_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_recall_at timestamp with time zone DEFAULT NULL;

-- Add session tracking to know when user last practiced (for determining if this is a "new session")
ALTER TABLE public.speeches
ADD COLUMN IF NOT EXISTS last_practice_session_at timestamp with time zone DEFAULT NULL;