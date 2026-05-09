## Plan

1. **Stop hiding risky first words too early**
   - Update the word-hiding priority so the first word of the line/sentence is not selected until later.
   - Keep the learning flow progressive, but avoid making the first spoken token the most fragile hidden token.

2. **Make hidden-word matching more tolerant without making practice meaningless**
   - Replace the current strict hidden-word comparison with the same proven fuzzy matching style used elsewhere: normalized word comparison, first-letter/length guard, and small edit-distance tolerance.
   - Keep stricter behavior for important hidden words than for visible words, but stop punishing normal speech-recognition variants.

3. **Do not mark hidden words yellow while the user is actively speaking**
   - Reset the hesitation clock on every incoming transcript token, not only on matched words.
   - This prevents hidden words from turning yellow just because recognition heard speech but did not map it perfectly yet.

4. **Recover immediately when a hidden word is missed but the next visible word is spoken**
   - Keep the “fail open” behavior for sentence-start/lenient hidden words.
   - Extend recovery so if the next visible word matches, the hidden word is skipped/revealed as failed and the visible word colors immediately.

5. **Tighten transcript replay state**
   - Ensure skipped hidden words count as cursor progress, so replay does not repeatedly re-process the same failed hidden word and cause a short stall loop.

## Expected result

Hidden words should still test recall, but they should no longer feel like they “do not listen.” If recognition misses a hidden word, the app will keep following your speech, color visible words quickly, and only mark a hidden word yellow when you actually pause/stall.