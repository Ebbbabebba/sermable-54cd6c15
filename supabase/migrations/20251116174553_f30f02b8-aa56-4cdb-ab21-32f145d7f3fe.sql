-- Create table to track mastered words per speech
CREATE TABLE IF NOT EXISTS public.mastered_words (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speech_id UUID NOT NULL REFERENCES public.speeches(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  times_spoken_correctly INTEGER NOT NULL DEFAULT 1,
  last_spoken_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(speech_id, word)
);

-- Enable RLS
ALTER TABLE public.mastered_words ENABLE ROW LEVEL SECURITY;

-- Users can view mastered words for their own speeches
CREATE POLICY "Users can view mastered words for own speeches"
ON public.mastered_words
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.speeches
    WHERE speeches.id = mastered_words.speech_id
    AND speeches.user_id = auth.uid()
  )
);

-- Users can insert mastered words for their own speeches
CREATE POLICY "Users can insert mastered words for own speeches"
ON public.mastered_words
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.speeches
    WHERE speeches.id = mastered_words.speech_id
    AND speeches.user_id = auth.uid()
  )
);

-- Users can update mastered words for their own speeches
CREATE POLICY "Users can update mastered words for own speeches"
ON public.mastered_words
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.speeches
    WHERE speeches.id = mastered_words.speech_id
    AND speeches.user_id = auth.uid()
  )
);

-- Index for faster lookups
CREATE INDEX idx_mastered_words_speech_id ON public.mastered_words(speech_id);
CREATE INDEX idx_mastered_words_word ON public.mastered_words(word);