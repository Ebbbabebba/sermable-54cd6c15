
-- Make the view respect querying user's RLS instead of creator's
ALTER VIEW public.v_next_due SET (security_invoker = true);

-- Replace the function to be SECURITY INVOKER (RLS on speeches/practice_beats handles access)
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
SECURITY INVOKER
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

REVOKE EXECUTE ON FUNCTION public.get_top_due_beats(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_top_due_beats(uuid, integer) TO authenticated;
