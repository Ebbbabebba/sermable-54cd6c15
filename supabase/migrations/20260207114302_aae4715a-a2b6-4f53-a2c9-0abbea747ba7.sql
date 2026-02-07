-- Add structured column data to overview_topics
ALTER TABLE public.overview_topics ADD COLUMN IF NOT EXISTS key_words text[] DEFAULT '{}';
ALTER TABLE public.overview_topics ADD COLUMN IF NOT EXISTS key_numbers text[] DEFAULT '{}';
ALTER TABLE public.overview_topics ADD COLUMN IF NOT EXISTS key_phrases text[] DEFAULT '{}';

-- Add section_scores to overview_sessions
ALTER TABLE public.overview_sessions ADD COLUMN IF NOT EXISTS section_scores jsonb DEFAULT '[]';