-- Create overview_topics table for storing AI-extracted topics from speeches
CREATE TABLE public.overview_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speech_id UUID NOT NULL REFERENCES public.speeches(id) ON DELETE CASCADE,
  topic_order INTEGER NOT NULL,
  topic_title TEXT NOT NULL,
  key_points TEXT[] NOT NULL DEFAULT '{}',
  original_section TEXT,
  is_mastered BOOLEAN DEFAULT false,
  practice_count INTEGER DEFAULT 0,
  last_coverage_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create overview_sessions table for storing practice session results
CREATE TABLE public.overview_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speech_id UUID NOT NULL REFERENCES public.speeches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  topics_covered UUID[] DEFAULT '{}',
  topics_partially_covered UUID[] DEFAULT '{}',
  topics_missed UUID[] DEFAULT '{}',
  overall_score NUMERIC,
  transcription TEXT,
  ai_feedback TEXT,
  suggestions TEXT,
  hint_level INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.overview_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overview_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for overview_topics (access through speech ownership)
CREATE POLICY "Users can view topics for their speeches"
  ON public.overview_topics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM speeches 
    WHERE speeches.id = overview_topics.speech_id 
    AND speeches.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert topics for their speeches"
  ON public.overview_topics FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM speeches 
    WHERE speeches.id = overview_topics.speech_id 
    AND speeches.user_id = auth.uid()
  ));

CREATE POLICY "Users can update topics for their speeches"
  ON public.overview_topics FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM speeches 
    WHERE speeches.id = overview_topics.speech_id 
    AND speeches.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete topics for their speeches"
  ON public.overview_topics FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM speeches 
    WHERE speeches.id = overview_topics.speech_id 
    AND speeches.user_id = auth.uid()
  ));

-- RLS policies for overview_sessions (user owns their sessions)
CREATE POLICY "Users can view their own overview sessions"
  ON public.overview_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own overview sessions"
  ON public.overview_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own overview sessions"
  ON public.overview_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own overview sessions"
  ON public.overview_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX idx_overview_topics_speech_id ON public.overview_topics(speech_id);
CREATE INDEX idx_overview_sessions_speech_id ON public.overview_sessions(speech_id);
CREATE INDEX idx_overview_sessions_user_id ON public.overview_sessions(user_id);