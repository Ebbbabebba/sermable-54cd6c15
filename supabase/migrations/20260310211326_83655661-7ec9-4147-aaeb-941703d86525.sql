
-- Create script_beats table to cache AI-extracted beats per speech
CREATE TABLE public.script_beats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id uuid NOT NULL REFERENCES public.speeches(id) ON DELETE CASCADE,
  beat_index integer NOT NULL,
  text text NOT NULL,
  reference_word text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create script_sessions table to store per-beat session results
CREATE TABLE public.script_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id uuid NOT NULL REFERENCES public.speeches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  beat_start integer NOT NULL,
  beat_end integer NOT NULL,
  score integer,
  content_coverage integer,
  order_accuracy integer,
  transcript text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.script_beats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_sessions ENABLE ROW LEVEL SECURITY;

-- RLS for script_beats (via speech ownership)
CREATE POLICY "Users can view beats for their speeches" ON public.script_beats
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM speeches WHERE speeches.id = script_beats.speech_id AND speeches.user_id = auth.uid()));

CREATE POLICY "Users can insert beats for their speeches" ON public.script_beats
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM speeches WHERE speeches.id = script_beats.speech_id AND speeches.user_id = auth.uid()));

CREATE POLICY "Users can delete beats for their speeches" ON public.script_beats
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM speeches WHERE speeches.id = script_beats.speech_id AND speeches.user_id = auth.uid()));

-- RLS for script_sessions (via user_id)
CREATE POLICY "Users can view their own script sessions" ON public.script_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own script sessions" ON public.script_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
