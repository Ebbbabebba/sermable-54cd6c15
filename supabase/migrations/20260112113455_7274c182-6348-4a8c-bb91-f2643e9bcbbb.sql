-- Revoke public access to system-only functions that expose sensitive user data
-- This function should only be called by edge functions using service_role

REVOKE EXECUTE ON FUNCTION get_users_with_due_reviews() FROM PUBLIC, anon, authenticated;

-- Only service role can execute this function (for edge functions)
GRANT EXECUTE ON FUNCTION get_users_with_due_reviews() TO service_role;