-- Add new columns to presentation_sessions for richer analytics
ALTER TABLE public.presentation_sessions 
ADD COLUMN IF NOT EXISTS mode text DEFAULT 'strict',
ADD COLUMN IF NOT EXISTS fluency_timeline jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS avg_time_per_word_ms integer,
ADD COLUMN IF NOT EXISTS longest_pause_ms integer,
ADD COLUMN IF NOT EXISTS pace_consistency numeric,
ADD COLUMN IF NOT EXISTS word_performance_json jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS user_id uuid;

-- Create presentation_word_performance table for detailed per-word tracking
CREATE TABLE IF NOT EXISTS public.presentation_word_performance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.presentation_sessions(id) ON DELETE CASCADE,
  speech_id uuid NOT NULL REFERENCES public.speeches(id) ON DELETE CASCADE,
  word text NOT NULL,
  word_index integer NOT NULL,
  status text NOT NULL DEFAULT 'correct',
  time_to_speak_ms integer,
  was_prompted boolean DEFAULT false,
  wrong_attempts text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT now()
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_word_performance_session ON public.presentation_word_performance(session_id);
CREATE INDEX IF NOT EXISTS idx_word_performance_speech ON public.presentation_word_performance(speech_id);
CREATE INDEX IF NOT EXISTS idx_word_performance_word ON public.presentation_word_performance(word);

-- Enable RLS on the new table
ALTER TABLE public.presentation_word_performance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for presentation_word_performance
CREATE POLICY "Users can view word performance for their speeches"
ON public.presentation_word_performance
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.speeches
  WHERE speeches.id = presentation_word_performance.speech_id
  AND speeches.user_id = auth.uid()
));

CREATE POLICY "Users can insert word performance for their speeches"
ON public.presentation_word_performance
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.speeches
  WHERE speeches.id = presentation_word_performance.speech_id
  AND speeches.user_id = auth.uid()
));

CREATE POLICY "Users can delete word performance for their speeches"
ON public.presentation_word_performance
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.speeches
  WHERE speeches.id = presentation_word_performance.speech_id
  AND speeches.user_id = auth.uid()
));