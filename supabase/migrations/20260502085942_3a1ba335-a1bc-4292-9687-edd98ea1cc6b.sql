-- Calendar events per speech, generated from goal_date and SR algorithm
CREATE TABLE public.speech_calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  speech_id UUID NOT NULL,
  user_id UUID NOT NULL,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('practice', 'recall', 'test', 'presentation')),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  session_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_speech_calendar_events_speech_date
  ON public.speech_calendar_events (speech_id, event_date);

CREATE INDEX idx_speech_calendar_events_user_date
  ON public.speech_calendar_events (user_id, event_date);

ALTER TABLE public.speech_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar events"
  ON public.speech_calendar_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar events"
  ON public.speech_calendar_events
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.speeches s
      WHERE s.id = speech_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own calendar events"
  ON public.speech_calendar_events
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events"
  ON public.speech_calendar_events
  FOR DELETE
  USING (auth.uid() = user_id);

-- Reuse existing public.update_updated_at_column() if present, otherwise create
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_speech_calendar_events_updated_at
  BEFORE UPDATE ON public.speech_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();