-- Add practice_stage to practice_beats to track progressive learning stages
-- Stage progression: day1_sentences → day2_beats → day3_fullspeech → day4_adaptive

ALTER TABLE public.practice_beats 
ADD COLUMN IF NOT EXISTS practice_stage text DEFAULT 'day1_sentences';

-- Add words_hidden_per_round to control how many words hide per successful recitation
-- Day 1: 1-2 words, Day 2: 1-2 words, Day 3: 3-4 words
ALTER TABLE public.practice_beats 
ADD COLUMN IF NOT EXISTS words_hidden_per_round integer DEFAULT 1;

-- Add stage_started_at to track when user entered current stage
ALTER TABLE public.practice_beats 
ADD COLUMN IF NOT EXISTS stage_started_at timestamp with time zone DEFAULT now();

-- Add consecutive_perfect_recalls to track when to advance stages
-- Need 2 perfect recalls (no hints/errors) to advance to next stage
ALTER TABLE public.practice_beats 
ADD COLUMN IF NOT EXISTS consecutive_perfect_recalls integer DEFAULT 0;

-- Comment for stage values:
-- 'day1_sentences' - Learning individual sentences, then combining (current BeatPracticeView behavior)
-- 'day2_beats' - Beat starts fully visible, hide 1-2 words per round until memorized
-- 'day3_fullspeech' - Full speech visible, hide 3-4 words per round
-- 'day4_adaptive' - Full speech hidden, only adaptive cues appear on hesitation