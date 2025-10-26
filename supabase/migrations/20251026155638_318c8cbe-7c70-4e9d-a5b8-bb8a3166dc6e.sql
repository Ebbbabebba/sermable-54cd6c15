-- Add push notification token to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_platform TEXT CHECK (push_platform IN ('ios', 'android', 'web'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;

-- Create index for efficient token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token) WHERE push_token IS NOT NULL;

-- Create a function to get users with speeches due for review
CREATE OR REPLACE FUNCTION get_users_with_due_reviews()
RETURNS TABLE(
  user_id UUID,
  push_token TEXT,
  push_platform TEXT,
  due_count BIGINT,
  speech_titles TEXT[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.push_token,
    p.push_platform,
    COUNT(s.id) as due_count,
    ARRAY_AGG(s.title) as speech_titles
  FROM profiles p
  INNER JOIN speeches s ON s.user_id = p.id
  INNER JOIN schedules sch ON sch.speech_id = s.id
  WHERE 
    p.push_token IS NOT NULL 
    AND p.notifications_enabled = true
    AND sch.next_review_date <= NOW()
    AND sch.completed = false
  GROUP BY p.id, p.push_token, p.push_platform
  HAVING COUNT(s.id) > 0;
END;
$$;