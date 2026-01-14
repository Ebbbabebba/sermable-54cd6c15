-- Add checkpoint column to track which sentence the user was on when they exited
ALTER TABLE public.practice_beats 
ADD COLUMN checkpoint_sentence integer DEFAULT NULL;

-- Also add a checkpoint_phase to remember exact phase
ALTER TABLE public.practice_beats 
ADD COLUMN checkpoint_phase text DEFAULT NULL;

-- Add checkpoint for hidden word indices so we restore exact progress
ALTER TABLE public.practice_beats 
ADD COLUMN checkpoint_hidden_indices jsonb DEFAULT NULL;

COMMENT ON COLUMN public.practice_beats.checkpoint_sentence IS 'Sentence number (1, 2, or 3) where user was when they exited mid-session';
COMMENT ON COLUMN public.practice_beats.checkpoint_phase IS 'Exact phase when user exited (e.g., sentence_2_fading)';
COMMENT ON COLUMN public.practice_beats.checkpoint_hidden_indices IS 'Array of word indices that were hidden when user exited';