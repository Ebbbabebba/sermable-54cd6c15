CREATE OR REPLACE FUNCTION public.check_speech_creation_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier subscription_tier;
  v_count integer;
  v_reset_date date;
  v_word_count integer;
  v_word_limit integer;
BEGIN
  SELECT subscription_tier, monthly_speeches_count, monthly_speeches_reset_date
  INTO v_tier, v_count, v_reset_date
  FROM profiles
  WHERE id = NEW.user_id;

  IF v_reset_date < date_trunc('month', CURRENT_DATE)::date THEN
    UPDATE profiles
    SET monthly_speeches_count = 0,
        monthly_speeches_reset_date = date_trunc('month', CURRENT_DATE)::date
    WHERE id = NEW.user_id;
    v_count := 0;
  END IF;

  IF v_tier = 'free' AND v_count >= 1 THEN
    RAISE EXCEPTION 'Monthly speech creation limit reached for free tier';
  END IF;

  v_word_count := array_length(regexp_split_to_array(trim(NEW.text_original), '\s+'), 1);

  IF v_tier = 'free' THEN
    v_word_limit := 250;
  ELSE
    v_word_limit := 5000;
  END IF;

  IF v_word_count > v_word_limit THEN
    RAISE EXCEPTION 'Speech exceeds word limit of % for % tier', v_word_limit, v_tier;
  END IF;

  RETURN NEW;
END;
$function$;