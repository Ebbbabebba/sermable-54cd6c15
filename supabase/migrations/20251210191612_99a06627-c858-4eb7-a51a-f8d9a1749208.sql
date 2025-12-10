-- Add hidden word failure tracking to mastered_words
ALTER TABLE public.mastered_words 
ADD COLUMN IF NOT EXISTS hidden_miss_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS hidden_hesitate_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_anchor_keyword boolean DEFAULT false;

-- Add segment-based visibility and scheduling to speech_segments
ALTER TABLE public.speech_segments
ADD COLUMN IF NOT EXISTS visibility_percent numeric DEFAULT 100,
ADD COLUMN IF NOT EXISTS anchor_keywords integer[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS next_review_at timestamp with time zone DEFAULT now();

-- Create speech_phrases table for phrase chunk tracking
CREATE TABLE IF NOT EXISTS public.speech_phrases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speech_id uuid NOT NULL REFERENCES public.speeches(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES public.speech_segments(id) ON DELETE CASCADE,
  phrase_text text NOT NULL,
  start_word_index integer NOT NULL,
  end_word_index integer NOT NULL,
  times_correct integer DEFAULT 0,
  times_missed integer DEFAULT 0,
  is_hidden boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on speech_phrases
ALTER TABLE public.speech_phrases ENABLE ROW LEVEL SECURITY;

-- RLS policies for speech_phrases
CREATE POLICY "Users can view phrases for their speeches" 
ON public.speech_phrases 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM speeches 
  WHERE speeches.id = speech_phrases.speech_id 
  AND speeches.user_id = auth.uid()
));

CREATE POLICY "Users can insert phrases for their speeches" 
ON public.speech_phrases 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM speeches 
  WHERE speeches.id = speech_phrases.speech_id 
  AND speeches.user_id = auth.uid()
));

CREATE POLICY "Users can update phrases for their speeches" 
ON public.speech_phrases 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM speeches 
  WHERE speeches.id = speech_phrases.speech_id 
  AND speeches.user_id = auth.uid()
));

CREATE POLICY "Users can delete phrases for their speeches" 
ON public.speech_phrases 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM speeches 
  WHERE speeches.id = speech_phrases.speech_id 
  AND speeches.user_id = auth.uid()
));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_speech_phrases_speech_id ON public.speech_phrases(speech_id);
CREATE INDEX IF NOT EXISTS idx_speech_phrases_segment_id ON public.speech_phrases(segment_id);
CREATE INDEX IF NOT EXISTS idx_mastered_words_anchor ON public.mastered_words(speech_id, is_anchor_keyword) WHERE is_anchor_keyword = true;