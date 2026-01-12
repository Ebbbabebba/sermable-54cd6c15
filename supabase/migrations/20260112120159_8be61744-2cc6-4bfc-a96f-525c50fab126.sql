-- Add missing DELETE policy on schedules table
-- This allows users to delete schedules for speeches they own

CREATE POLICY "Users can delete own schedules"
  ON public.schedules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.speeches
      WHERE speeches.id = schedules.speech_id
      AND speeches.user_id = auth.uid()
    )
  );