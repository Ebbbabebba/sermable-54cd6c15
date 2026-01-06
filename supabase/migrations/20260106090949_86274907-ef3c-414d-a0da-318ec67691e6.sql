-- Create freestyle_topics table for ordered topic sections
CREATE TABLE public.freestyle_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID NOT NULL REFERENCES public.speeches(id) ON DELETE CASCADE,
  topic_order INTEGER NOT NULL,
  topic_name TEXT NOT NULL,
  summary_hint TEXT,
  original_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.freestyle_topics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view topics for their speeches"
  ON public.freestyle_topics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM speeches WHERE speeches.id = freestyle_topics.speech_id 
    AND speeches.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert topics for their speeches"
  ON public.freestyle_topics FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM speeches WHERE speeches.id = freestyle_topics.speech_id 
    AND speeches.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete topics for their speeches"
  ON public.freestyle_topics FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM speeches WHERE speeches.id = freestyle_topics.speech_id 
    AND speeches.user_id = auth.uid()
  ));

-- Add keyword_type column to freestyle_keywords
ALTER TABLE public.freestyle_keywords 
ADD COLUMN keyword_type TEXT DEFAULT 'concept' 
CHECK (keyword_type IN ('number', 'date', 'concept', 'name', 'action'));

-- Add topic_id foreign key to freestyle_keywords
ALTER TABLE public.freestyle_keywords 
ADD COLUMN topic_id UUID REFERENCES public.freestyle_topics(id) ON DELETE CASCADE;