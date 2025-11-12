-- Add presentation mode support to speeches table
ALTER TABLE speeches ADD COLUMN IF NOT EXISTS presentation_mode TEXT DEFAULT 'strict' CHECK (presentation_mode IN ('strict', 'freestyle'));

-- Create table for freestyle segments
CREATE TABLE IF NOT EXISTS freestyle_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID NOT NULL REFERENCES speeches(id) ON DELETE CASCADE,
  segment_order INT NOT NULL,
  content TEXT NOT NULL,
  importance_level TEXT NOT NULL CHECK (importance_level IN ('high', 'medium', 'low')),
  cue_words TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for freestyle session tracking
CREATE TABLE IF NOT EXISTS freestyle_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID NOT NULL REFERENCES speeches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  covered_segments INT[] DEFAULT '{}',
  mentioned_cue_words TEXT[] DEFAULT '{}',
  missed_cue_words TEXT[] DEFAULT '{}',
  improvisation_count INT DEFAULT 0,
  pause_count INT DEFAULT 0,
  duration_seconds INT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE freestyle_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE freestyle_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for freestyle_segments
CREATE POLICY "Users can view segments for their speeches"
ON freestyle_segments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM speeches
    WHERE speeches.id = freestyle_segments.speech_id
    AND speeches.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert segments for their speeches"
ON freestyle_segments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM speeches
    WHERE speeches.id = freestyle_segments.speech_id
    AND speeches.user_id = auth.uid()
  )
);

-- RLS Policies for freestyle_sessions
CREATE POLICY "Users can view their own freestyle sessions"
ON freestyle_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own freestyle sessions"
ON freestyle_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own freestyle sessions"
ON freestyle_sessions FOR UPDATE
USING (auth.uid() = user_id);