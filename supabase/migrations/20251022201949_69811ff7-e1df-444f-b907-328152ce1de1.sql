-- Create subscription tier enum
CREATE TYPE public.subscription_tier AS ENUM ('free', 'student', 'regular', 'enterprise');

-- Add subscription fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN subscription_tier public.subscription_tier NOT NULL DEFAULT 'free',
ADD COLUMN monthly_speeches_count integer NOT NULL DEFAULT 0,
ADD COLUMN monthly_speeches_reset_date date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
ADD COLUMN subscription_status text NOT NULL DEFAULT 'active';

-- Create function to check if user can create speech
CREATE OR REPLACE FUNCTION public.can_create_speech(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    RETURN v_count < 2;
  ELSE
    -- Premium tiers have unlimited speeches
    RETURN true;
  END IF;
END;
$$;

-- Create function to increment speech count
CREATE OR REPLACE FUNCTION public.increment_speech_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Increment the monthly speech count
  UPDATE profiles
  SET monthly_speeches_count = monthly_speeches_count + 1
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to increment count when speech is created
CREATE TRIGGER increment_speech_count_trigger
AFTER INSERT ON speeches
FOR EACH ROW
EXECUTE FUNCTION increment_speech_count();

-- Create function to get word count limit
CREATE OR REPLACE FUNCTION public.get_word_limit(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier subscription_tier;
BEGIN
  SELECT subscription_tier INTO v_tier
  FROM profiles
  WHERE id = p_user_id;

  IF v_tier = 'free' THEN
    RETURN 500;
  ELSE
    RETURN 5000;
  END IF;
END;
$$;