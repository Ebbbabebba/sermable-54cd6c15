ALTER TABLE practice_beats 
  ADD COLUMN recall_session_number integer DEFAULT 0,
  ADD COLUMN next_scheduled_recall_at timestamptz DEFAULT NULL;