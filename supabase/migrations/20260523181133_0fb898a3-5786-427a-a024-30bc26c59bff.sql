
-- 1. Mastery events: append-only log of all practice/recall outcomes
CREATE TABLE IF NOT EXISTS public.mastery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  speech_id uuid NOT NULL,
  beat_id uuid,
  segment_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('practice','recall','test','presentation','blank_run')),
  raw_accuracy numeric,
  visibility_percent numeric,
  hesitations integer DEFAULT 0,
  lapses integer DEFAULT 0,
  missed_word_count integer DEFAULT 0,
  duration_seconds integer,
  was_overdue boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mastery_events_user_created ON public.mastery_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mastery_events_beat ON public.mastery_events(beat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mastery_events_speech ON public.mastery_events(speech_id, created_at DESC);

ALTER TABLE public.mastery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mastery events"
  ON public.mastery_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mastery events"
  ON public.mastery_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 2. Add FSRS-ready fields to practice_beats (used in Fas 2)
ALTER TABLE public.practice_beats
  ADD COLUMN IF NOT EXISTS fsrs_stability numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS fsrs_difficulty numeric DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS fsrs_reps integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fsrs_lapses integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fsrs_last_review timestamptz;

-- 3. Add predicted accuracy field for Fas 5 observability
ALTER TABLE public.presentation_sessions
  ADD COLUMN IF NOT EXISTS predicted_accuracy numeric;

-- 4. Unified "next due" view: single source of truth for what to practice
-- Priority = urgency(deadline) * (1 - mastery) * overdueness
CREATE OR REPLACE VIEW public.v_next_due AS
SELECT
  s.user_id,
  s.id AS speech_id,
  s.title AS speech_title,
  s.goal_date,
  pb.id AS beat_id,
  pb.beat_order,
  pb.is_mastered,
  pb.next_scheduled_recall_at,
  COALESCE(pb.next_scheduled_recall_at, pb.stage_started_at, pb.created_at) AS due_at,
  -- Urgency: 1.0 if deadline within 3 days, decays to 0.2 at 30+ days, 0.1 if no deadline
  CASE
    WHEN s.goal_date IS NULL THEN 0.1
    WHEN s.goal_date <= CURRENT_DATE + INTERVAL '3 days' THEN 1.0
    WHEN s.goal_date <= CURRENT_DATE + INTERVAL '7 days' THEN 0.8
    WHEN s.goal_date <= CURRENT_DATE + INTERVAL '14 days' THEN 0.5
    WHEN s.goal_date <= CURRENT_DATE + INTERVAL '30 days' THEN 0.3
    ELSE 0.2
  END AS urgency_score,
  -- Mastery gap: how much is left to learn (1 - normalized mastery)
  CASE
    WHEN pb.is_mastered THEN 0.1
    WHEN pb.consecutive_perfect_recalls >= 3 THEN 0.3
    WHEN pb.consecutive_perfect_recalls >= 1 THEN 0.6
    ELSE 1.0
  END AS mastery_gap,
  -- Overdueness: how many hours past due (capped at 72h)
  GREATEST(0, LEAST(72,
    EXTRACT(EPOCH FROM (now() - COALESCE(pb.next_scheduled_recall_at, pb.created_at))) / 3600
  )) / 72.0 AS overdueness_score,
  -- Combined priority (0..1)
  (
    CASE
      WHEN s.goal_date IS NULL THEN 0.1
      WHEN s.goal_date <= CURRENT_DATE + INTERVAL '3 days' THEN 1.0
      WHEN s.goal_date <= CURRENT_DATE + INTERVAL '7 days' THEN 0.8
      WHEN s.goal_date <= CURRENT_DATE + INTERVAL '14 days' THEN 0.5
      WHEN s.goal_date <= CURRENT_DATE + INTERVAL '30 days' THEN 0.3
      ELSE 0.2
    END
    *
    CASE
      WHEN pb.is_mastered THEN 0.1
      WHEN pb.consecutive_perfect_recalls >= 3 THEN 0.3
      WHEN pb.consecutive_perfect_recalls >= 1 THEN 0.6
      ELSE 1.0
    END
    *
    (1.0 + GREATEST(0, LEAST(72,
      EXTRACT(EPOCH FROM (now() - COALESCE(pb.next_scheduled_recall_at, pb.created_at))) / 3600
    )) / 72.0)
  ) AS priority_score
FROM public.speeches s
JOIN public.practice_beats pb ON pb.speech_id = s.id
WHERE
  (s.goal_date IS NULL OR s.goal_date >= CURRENT_DATE)
  AND (pb.cooldown_until IS NULL OR pb.cooldown_until <= now());

-- 5. Helper RPC: get top-N due beats for a user (interleaved across speeches)
CREATE OR REPLACE FUNCTION public.get_top_due_beats(p_user_id uuid, p_limit integer DEFAULT 5)
RETURNS TABLE (
  speech_id uuid,
  speech_title text,
  beat_id uuid,
  beat_order integer,
  due_at timestamptz,
  priority_score numeric,
  goal_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    speech_id,
    speech_title,
    beat_id,
    beat_order,
    due_at,
    priority_score,
    goal_date
  FROM public.v_next_due
  WHERE user_id = p_user_id
    AND is_mastered = false
  ORDER BY priority_score DESC, due_at ASC
  LIMIT p_limit;
$$;
