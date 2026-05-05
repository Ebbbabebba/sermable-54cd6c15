ALTER TABLE public.practice_beats
  ADD COLUMN IF NOT EXISTS passed_in_full_speech boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recent_failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cooldown_until timestamp with time zone,
  ADD COLUMN IF NOT EXISTS total_successful_recalls integer NOT NULL DEFAULT 0;