-- Add missing UPDATE policy for presentation_sessions
CREATE POLICY "Users can update own presentation sessions"
  ON public.presentation_sessions
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM speeches
    WHERE speeches.id = presentation_sessions.speech_id
    AND speeches.user_id = auth.uid()
  ));

-- Add missing DELETE policy for presentation_sessions
CREATE POLICY "Users can delete own presentation sessions"
  ON public.presentation_sessions
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM speeches
    WHERE speeches.id = presentation_sessions.speech_id
    AND speeches.user_id = auth.uid()
  ));