CREATE OR REPLACE FUNCTION public.check_speech_creation_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Payments disabled: no monthly cap, no word cap.
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_speech_update_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Payments disabled: no word cap on edits.
  RETURN NEW;
END;
$function$;