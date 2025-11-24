-- Create table to track speech segments and their learning progress
CREATE TABLE IF NOT EXISTS public.speech_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speech_id UUID NOT NULL REFERENCES public.speeches(id) ON DELETE CASCADE,
  segment_order INT NOT NULL,
  start_word_index INT NOT NULL,
  end_word_index INT NOT NULL,
  segment_text TEXT NOT NULL,
  is_mastered BOOLEAN NOT NULL DEFAULT false,
  times_practiced INT NOT NULL DEFAULT 0,
  average_accuracy FLOAT,
  last_practiced_at TIMESTAMP WITH TIME ZONE,
  merged_with_next BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(speech_id, segment_order)
);

-- Enable RLS
ALTER TABLE public.speech_segments ENABLE ROW LEVEL SECURITY;

-- Policies for speech_segments
CREATE POLICY "Users can view their own speech segments"
  ON public.speech_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.speeches
      WHERE speeches.id = speech_segments.speech_id
      AND speeches.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own speech segments"
  ON public.speech_segments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.speeches
      WHERE speeches.id = speech_segments.speech_id
      AND speeches.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own speech segments"
  ON public.speech_segments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.speeches
      WHERE speeches.id = speech_segments.speech_id
      AND speeches.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own speech segments"
  ON public.speech_segments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.speeches
      WHERE speeches.id = speech_segments.speech_id
      AND speeches.user_id = auth.uid()
    )
  );

-- Add index for faster queries
CREATE INDEX idx_speech_segments_speech_id ON public.speech_segments(speech_id);
CREATE INDEX idx_speech_segments_order ON public.speech_segments(speech_id, segment_order);