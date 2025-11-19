-- Add unique constraint to mastered_words to support upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS mastered_words_speech_word_idx 
ON mastered_words(speech_id, word);

-- Update mastered_words table to track performance more accurately
ALTER TABLE mastered_words 
ADD COLUMN IF NOT EXISTS missed_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hesitated_count INTEGER DEFAULT 0;

COMMENT ON COLUMN mastered_words.missed_count IS 'Number of times this word was missed';
COMMENT ON COLUMN mastered_words.hesitated_count IS 'Number of times user hesitated on this word';