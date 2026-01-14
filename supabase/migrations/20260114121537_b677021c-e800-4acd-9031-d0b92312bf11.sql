-- Add DELETE policy for user_learning_analytics table
CREATE POLICY "Users can delete their own learning analytics"
ON public.user_learning_analytics
FOR DELETE
USING (auth.uid() = user_id);