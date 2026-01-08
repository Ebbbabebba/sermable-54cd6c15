-- Create practice_beats table to store 3-sentence beats
CREATE TABLE public.practice_beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID NOT NULL REFERENCES public.speeches(id) ON DELETE CASCADE,
  beat_order INTEGER NOT NULL,
  sentence_1_text TEXT NOT NULL,
  sentence_2_text TEXT NOT NULL,
  sentence_3_text TEXT NOT NULL,
  is_mastered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create beat_progress table to track learning progress
CREATE TABLE public.beat_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id UUID NOT NULL REFERENCES public.practice_beats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  current_phase TEXT DEFAULT 'sentence_1_learning',
  repetition_count INTEGER DEFAULT 0,
  visible_word_indices JSONB DEFAULT '[]',
  failed_word_indices JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX idx_practice_beats_speech_id ON public.practice_beats(speech_id);
CREATE INDEX idx_practice_beats_order ON public.practice_beats(speech_id, beat_order);
CREATE INDEX idx_beat_progress_beat_id ON public.beat_progress(beat_id);
CREATE INDEX idx_beat_progress_user_id ON public.beat_progress(user_id);

-- Enable RLS
ALTER TABLE public.practice_beats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beat_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for practice_beats (via speech ownership)
CREATE POLICY "Users can view beats for their speeches"
ON public.practice_beats FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.speeches
  WHERE speeches.id = practice_beats.speech_id
  AND speeches.user_id = auth.uid()
));

CREATE POLICY "Users can insert beats for their speeches"
ON public.practice_beats FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.speeches
  WHERE speeches.id = practice_beats.speech_id
  AND speeches.user_id = auth.uid()
));

CREATE POLICY "Users can update beats for their speeches"
ON public.practice_beats FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.speeches
  WHERE speeches.id = practice_beats.speech_id
  AND speeches.user_id = auth.uid()
));

CREATE POLICY "Users can delete beats for their speeches"
ON public.practice_beats FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.speeches
  WHERE speeches.id = practice_beats.speech_id
  AND speeches.user_id = auth.uid()
));

-- RLS policies for beat_progress (via user_id)
CREATE POLICY "Users can view their own beat progress"
ON public.beat_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own beat progress"
ON public.beat_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own beat progress"
ON public.beat_progress FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own beat progress"
ON public.beat_progress FOR DELETE
USING (auth.uid() = user_id);