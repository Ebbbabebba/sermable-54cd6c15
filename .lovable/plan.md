## Plan

1. **Stop transcript tail replay after hidden-word timeout**
   - Remove the `replayRecentTranscriptTail()` call that runs right after a hidden word auto-advances.
   - This is the most likely cause of cascading skips: one timeout advances one word, then old transcript gets replayed against the next word/sentence and can immediately complete the rest.

2. **Make timeouts strictly one-word only**
   - Keep the helpful clue behavior, but after a timeout advances one hidden word, reset/clear the buffered transcript so the next word waits for fresh speech.
   - Add a short guard window after timeout advancement so stale recognition results cannot instantly advance the next sentence.

3. **Protect sentence starts from auto-skip**
   - For the first word of a sentence, show the clue quickly, but do not auto-advance it unless the user actually says a matching word.
   - This prevents “I don’t even get to start before it jumps to the next sentence.”

4. **Tighten lookahead at sentence boundaries**
   - Keep the smoother word flow inside a sentence.
   - Block 1–2 word lookahead from crossing from the end of one sentence into the next sentence, so recognition noise or stale words cannot complete one sentence and start another.

5. **Validate with targeted logic checks**
   - Confirm hidden words still reveal as clues quickly.
   - Confirm a timeout advances at most one word.
   - Confirm no buffered transcript can complete a sentence/beat without new speech.