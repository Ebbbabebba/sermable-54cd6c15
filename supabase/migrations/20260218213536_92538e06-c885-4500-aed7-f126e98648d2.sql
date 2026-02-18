
-- Add share_token column to speeches
ALTER TABLE public.speeches ADD COLUMN share_token TEXT UNIQUE;

-- Create index for fast lookup
CREATE INDEX idx_speeches_share_token ON public.speeches (share_token) WHERE share_token IS NOT NULL;
