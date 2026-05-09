ALTER TABLE public.speeches
  ADD COLUMN IF NOT EXISTS practice_strictness text NOT NULL DEFAULT 'strict';

-- Validate values without using a CHECK constraint with non-immutable expressions.
CREATE OR REPLACE FUNCTION public.validate_speech_practice_strictness()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.practice_strictness IS NULL OR NEW.practice_strictness NOT IN ('strict','flow') THEN
    RAISE EXCEPTION 'practice_strictness must be either ''strict'' or ''flow''';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_practice_strictness ON public.speeches;
CREATE TRIGGER validate_practice_strictness
BEFORE INSERT OR UPDATE OF practice_strictness ON public.speeches
FOR EACH ROW EXECUTE FUNCTION public.validate_speech_practice_strictness();