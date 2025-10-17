-- Add familiarity_level column to speeches table
ALTER TABLE speeches ADD COLUMN familiarity_level TEXT DEFAULT 'new' CHECK (familiarity_level IN ('new', 'familiar', 'well_known'));

COMMENT ON COLUMN speeches.familiarity_level IS 'User''s familiarity with the speech: new, familiar, or well_known';