-- Create presentation_sessions table
CREATE TABLE presentation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID REFERENCES speeches(id) ON DELETE CASCADE NOT NULL,
  transcript TEXT,
  accuracy DECIMAL(5,2),
  hesitations INTEGER DEFAULT 0,
  missed_words TEXT[],
  duration_seconds INTEGER,
  feedback_summary TEXT,
  feedback_advice TEXT,
  feedback_next_step TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE presentation_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own presentation sessions"
ON presentation_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM speeches
    WHERE speeches.id = presentation_sessions.speech_id
    AND speeches.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create own presentation sessions"
ON presentation_sessions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM speeches
    WHERE speeches.id = presentation_sessions.speech_id
    AND speeches.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_presentation_sessions_speech_id ON presentation_sessions(speech_id);
CREATE INDEX idx_presentation_sessions_created_at ON presentation_sessions(created_at DESC);