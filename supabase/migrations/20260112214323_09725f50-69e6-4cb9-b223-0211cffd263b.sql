-- Update can_create_speech function to limit free users to 1 speech per month
CREATE OR REPLACE FUNCTION public.can_create_speech(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier subscription_tier;
  v_count integer;
  v_reset_date date;
BEGIN
  -- Get user's subscription info
  SELECT subscription_tier, monthly_speeches_count, monthly_speeches_reset_date
  INTO v_tier, v_count, v_reset_date
  FROM profiles
  WHERE id = p_user_id;

  -- Reset counter if we're in a new month
  IF v_reset_date < date_trunc('month', CURRENT_DATE)::date THEN
    UPDATE profiles
    SET monthly_speeches_count = 0,
        monthly_speeches_reset_date = date_trunc('month', CURRENT_DATE)::date
    WHERE id = p_user_id;
    v_count := 0;
  END IF;

  -- Check limits based on tier
  IF v_tier = 'free' THEN
    -- Free users can only create 1 speech per month
    RETURN v_count < 1;
  ELSE
    -- Premium tiers have unlimited speeches
    RETURN true;
  END IF;
END;
$function$;