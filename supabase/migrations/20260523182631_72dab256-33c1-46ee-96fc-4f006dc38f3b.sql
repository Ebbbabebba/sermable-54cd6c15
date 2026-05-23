-- Enable scheduling extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Per-beat dedupe for instant due-now pushes
ALTER TABLE public.practice_beats
  ADD COLUMN IF NOT EXISTS last_due_notification_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_practice_beats_due_now
  ON public.practice_beats (next_scheduled_recall_at)
  WHERE next_scheduled_recall_at IS NOT NULL;

-- User-level toggle (default ON)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instant_due_notifications BOOLEAN NOT NULL DEFAULT true;