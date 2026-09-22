CREATE TABLE IF NOT EXISTS public.user_activity_days (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

GRANT SELECT, INSERT ON public.user_activity_days TO authenticated;
GRANT ALL ON public.user_activity_days TO service_role;

ALTER TABLE public.user_activity_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity days"
ON public.user_activity_days FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity days"
ON public.user_activity_days FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);