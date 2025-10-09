-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create speeches table
CREATE TABLE public.speeches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  text_original TEXT NOT NULL,
  text_current TEXT NOT NULL,
  goal_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.speeches ENABLE ROW LEVEL SECURITY;

-- Speeches policies
CREATE POLICY "Users can view own speeches"
  ON public.speeches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own speeches"
  ON public.speeches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own speeches"
  ON public.speeches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own speeches"
  ON public.speeches FOR DELETE
  USING (auth.uid() = user_id);

-- Create practice_sessions table
CREATE TABLE public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID REFERENCES public.speeches(id) ON DELETE CASCADE NOT NULL,
  session_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  score DECIMAL(5,2),
  missed_words TEXT[],
  delayed_words TEXT[],
  duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

-- Practice sessions policies
CREATE POLICY "Users can view own practice sessions"
  ON public.practice_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.speeches
      WHERE speeches.id = practice_sessions.speech_id
      AND speeches.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own practice sessions"
  ON public.practice_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.speeches
      WHERE speeches.id = practice_sessions.speech_id
      AND speeches.user_id = auth.uid()
    )
  );

-- Create schedules table
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID REFERENCES public.speeches(id) ON DELETE CASCADE NOT NULL,
  session_date DATE NOT NULL,
  completed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Schedules policies
CREATE POLICY "Users can view own schedules"
  ON public.schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.speeches
      WHERE speeches.id = schedules.speech_id
      AND speeches.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own schedules"
  ON public.schedules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.speeches
      WHERE speeches.id = schedules.speech_id
      AND speeches.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own schedules"
  ON public.schedules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.speeches
      WHERE speeches.id = schedules.speech_id
      AND speeches.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for speeches
CREATE TRIGGER update_speeches_updated_at
  BEFORE UPDATE ON public.speeches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();