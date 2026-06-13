-- 1. Remove profiles from realtime publication (stops leaking email/push_token)
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;

-- 2. freestyle_segments: UPDATE + DELETE scoped to speech ownership
CREATE POLICY "Users can update segments for their speeches"
  ON public.freestyle_segments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.speeches WHERE speeches.id = freestyle_segments.speech_id AND speeches.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.speeches WHERE speeches.id = freestyle_segments.speech_id AND speeches.user_id = auth.uid()));

CREATE POLICY "Users can delete segments for their speeches"
  ON public.freestyle_segments FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.speeches WHERE speeches.id = freestyle_segments.speech_id AND speeches.user_id = auth.uid()));

-- 3. freestyle_sessions: DELETE
CREATE POLICY "Users can delete their own freestyle sessions"
  ON public.freestyle_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- 4. freestyle_topics: UPDATE
CREATE POLICY "Users can update topics for their speeches"
  ON public.freestyle_topics FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.speeches WHERE speeches.id = freestyle_topics.speech_id AND speeches.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.speeches WHERE speeches.id = freestyle_topics.speech_id AND speeches.user_id = auth.uid()));

-- 5. mastered_words: DELETE
CREATE POLICY "Users can delete mastered words for own speeches"
  ON public.mastered_words FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.speeches WHERE speeches.id = mastered_words.speech_id AND speeches.user_id = auth.uid()));

-- 6. mastery_events: UPDATE + DELETE
CREATE POLICY "Users can update their own mastery events"
  ON public.mastery_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mastery events"
  ON public.mastery_events FOR DELETE
  USING (auth.uid() = user_id);

-- 7. practice_sessions: UPDATE + DELETE scoped to speech ownership
CREATE POLICY "Users can update own practice sessions"
  ON public.practice_sessions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.speeches WHERE speeches.id = practice_sessions.speech_id AND speeches.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.speeches WHERE speeches.id = practice_sessions.speech_id AND speeches.user_id = auth.uid()));

CREATE POLICY "Users can delete own practice sessions"
  ON public.practice_sessions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.speeches WHERE speeches.id = practice_sessions.speech_id AND speeches.user_id = auth.uid()));

-- 8. script_beats: UPDATE
CREATE POLICY "Users can update beats for their speeches"
  ON public.script_beats FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.speeches WHERE speeches.id = script_beats.speech_id AND speeches.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.speeches WHERE speeches.id = script_beats.speech_id AND speeches.user_id = auth.uid()));

-- 9. script_sessions: UPDATE + DELETE
CREATE POLICY "Users can update their own script sessions"
  ON public.script_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own script sessions"
  ON public.script_sessions FOR DELETE
  USING (auth.uid() = user_id);