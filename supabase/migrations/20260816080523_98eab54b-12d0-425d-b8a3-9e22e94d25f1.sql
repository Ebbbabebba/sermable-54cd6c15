CREATE OR REPLACE FUNCTION public.can_create_speech(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  -- Payments disabled: everyone can create speeches without limits.
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_word_limit(p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  -- Payments disabled: full word limit for everyone.
  RETURN 5000;
END;
$function$;