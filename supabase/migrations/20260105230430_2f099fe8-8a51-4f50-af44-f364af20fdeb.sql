-- Create freestyle_keywords table for the simplified keyword-based freestyle mode
CREATE TABLE public.freestyle_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID NOT NULL REFERENCES public.speeches(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  keyword TEXT NOT NULL,
  importance TEXT NOT NULL DEFAULT 'medium' CHECK (importance IN ('high', 'medium', 'low')),
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.freestyle_keywords ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view keywords for their speeches"
  ON public.freestyle_keywords FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM speeches 
    WHERE speeches.id = freestyle_keywords.speech_id 
    AND speeches.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert keywords for their speeches"
  ON public.freestyle_keywords FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM speeches 
    WHERE speeches.id = freestyle_keywords.speech_id 
    AND speeches.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete keywords for their speeches"
  ON public.freestyle_keywords FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM speeches 
    WHERE speeches.id = freestyle_keywords.speech_id 
    AND speeches.user_id = auth.uid()
  ));