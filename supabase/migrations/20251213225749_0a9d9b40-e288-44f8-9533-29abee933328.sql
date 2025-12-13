-- Create user_word_mastery table for cross-speech learning
CREATE TABLE public.user_word_mastery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  word TEXT NOT NULL,
  total_correct INTEGER DEFAULT 0,
  total_missed INTEGER DEFAULT 0,
  total_hesitated INTEGER DEFAULT 0,
  mastery_level NUMERIC DEFAULT 0,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, word)
);

-- Enable RLS
ALTER TABLE public.user_word_mastery ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own word mastery"
ON public.user_word_mastery
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own word mastery"
ON public.user_word_mastery
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own word mastery"
ON public.user_word_mastery
FOR UPDATE
USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_user_word_mastery_user_word ON public.user_word_mastery(user_id, word);
CREATE INDEX idx_user_word_mastery_mastery ON public.user_word_mastery(user_id, mastery_level DESC);