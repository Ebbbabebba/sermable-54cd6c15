-- Add practice hours preferences to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS practice_start_hour INTEGER DEFAULT 8;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS practice_end_hour INTEGER DEFAULT 22;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Add check constraints for valid hours
ALTER TABLE public.profiles ADD CONSTRAINT practice_start_hour_valid CHECK (practice_start_hour >= 0 AND practice_start_hour <= 23);
ALTER TABLE public.profiles ADD CONSTRAINT practice_end_hour_valid CHECK (practice_end_hour >= 0 AND practice_end_hour <= 23);