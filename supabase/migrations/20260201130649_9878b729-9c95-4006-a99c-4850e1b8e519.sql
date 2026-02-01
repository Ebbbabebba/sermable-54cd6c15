-- Add speech_type column to speeches table for audience environment theming
ALTER TABLE public.speeches 
ADD COLUMN IF NOT EXISTS speech_type text DEFAULT 'general';

-- Add comment for clarity
COMMENT ON COLUMN public.speeches.speech_type IS 'Type of speech context: office_meeting, school_presentation, conference, wedding, interview, general';