-- Create user learning analytics table for personalization
CREATE TABLE public.user_learning_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Practice timing patterns
  preferred_practice_hours INTEGER[] DEFAULT '{}',
  practice_hour_performance JSONB DEFAULT '{}',
  
  -- Retention patterns
  avg_words_retained_per_session NUMERIC DEFAULT 0,
  retention_decay_rate NUMERIC DEFAULT 0.5,
  optimal_review_interval_minutes INTEGER DEFAULT 1440,
  
  -- Speed and hesitation patterns
  avg_words_per_minute NUMERIC DEFAULT 0,
  avg_hesitation_rate NUMERIC DEFAULT 0,
  avg_response_delay_ms INTEGER DEFAULT 0,
  
  -- Learning style metrics
  optimal_segment_length INTEGER DEFAULT 50,
  preferred_visibility_reduction_rate NUMERIC DEFAULT 10,
  struggle_recovery_sessions INTEGER DEFAULT 2,
  
  -- Aggregated stats
  total_sessions_completed INTEGER DEFAULT 0,
  total_words_practiced INTEGER DEFAULT 0,
  overall_mastery_velocity NUMERIC DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_learning_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own learning analytics"
ON public.user_learning_analytics FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning analytics"
ON public.user_learning_analytics FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning analytics"
ON public.user_learning_analytics FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_learning_analytics_updated_at
BEFORE UPDATE ON public.user_learning_analytics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();