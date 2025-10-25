-- Add INSERT policy on profiles table
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Add validation constraints on speeches table
ALTER TABLE public.speeches 
ADD CONSTRAINT speeches_title_length CHECK (char_length(title) > 0 AND char_length(title) <= 200),
ADD CONSTRAINT speeches_text_length CHECK (char_length(text_original) > 0 AND char_length(text_original) <= 50000);

-- Create trigger function to enforce subscription limits before insert
CREATE OR REPLACE FUNCTION public.check_speech_creation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tier subscription_tier;
  v_count integer;
  v_reset_date date;
  v_word_count integer;
  v_word_limit integer;
BEGIN
  -- Get user's subscription info
  SELECT subscription_tier, monthly_speeches_count, monthly_speeches_reset_date
  INTO v_tier, v_count, v_reset_date
  FROM profiles
  WHERE id = NEW.user_id;

  -- Reset counter if we're in a new month
  IF v_reset_date < date_trunc('month', CURRENT_DATE)::date THEN
    UPDATE profiles
    SET monthly_speeches_count = 0,
        monthly_speeches_reset_date = date_trunc('month', CURRENT_DATE)::date
    WHERE id = NEW.user_id;
    v_count := 0;
  END IF;

  -- Check speech creation limits based on tier
  IF v_tier = 'free' AND v_count >= 2 THEN
    RAISE EXCEPTION 'Monthly speech creation limit reached for free tier';
  END IF;

  -- Check word count limits
  v_word_count := array_length(regexp_split_to_array(trim(NEW.text_original), '\s+'), 1);
  
  IF v_tier = 'free' THEN
    v_word_limit := 500;
  ELSE
    v_word_limit := 5000;
  END IF;

  IF v_word_count > v_word_limit THEN
    RAISE EXCEPTION 'Speech exceeds word limit of % for % tier', v_word_limit, v_tier;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to run before speech insert
CREATE TRIGGER enforce_speech_creation_limit
BEFORE INSERT ON public.speeches
FOR EACH ROW
EXECUTE FUNCTION public.check_speech_creation_limit();

-- Add validation trigger for speech updates to prevent expanding text beyond limits
CREATE OR REPLACE FUNCTION public.check_speech_update_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tier subscription_tier;
  v_word_count integer;
  v_word_limit integer;
BEGIN
  -- Only check if text_original is being updated
  IF NEW.text_original IS DISTINCT FROM OLD.text_original THEN
    -- Get user's subscription tier
    SELECT subscription_tier INTO v_tier
    FROM profiles
    WHERE id = NEW.user_id;

    -- Check word count limits
    v_word_count := array_length(regexp_split_to_array(trim(NEW.text_original), '\s+'), 1);
    
    IF v_tier = 'free' THEN
      v_word_limit := 500;
    ELSE
      v_word_limit := 5000;
    END IF;

    IF v_word_count > v_word_limit THEN
      RAISE EXCEPTION 'Speech exceeds word limit of % for % tier', v_word_limit, v_tier;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_speech_update_limit
BEFORE UPDATE ON public.speeches
FOR EACH ROW
EXECUTE FUNCTION public.check_speech_update_limit();