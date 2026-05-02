# Fix Presentation & Listen Mode tracking issues

Two bugs reported on the `/presentation/...` route:

1. **Presentation (Whole Speech) mode**: the script jumps ahead before you've actually said the word, and an entire wrong sentence is accepted as "correct."
2. **Listen Mode**: when you pause, only the first hint appears — after that, hints stop showing even on long silences.

## What's wrong (root cause)

### Presentation — too eager to advance
In `src/components/CompactPresentationView.tsx`:

- **Lookahead window is 8 words** (line 404). Any spoken token that fuzzy-matches a word up to 8 positions ahead jumps the cursor, silently marking everything in between as "skipped" while the UI advances as if you were correct.
- **Similarity threshold = 0.5** combined with a lenient `getWordSimilarity` (returns 0.85 for any 70 %-prefix match, otherwise counts character-position overlaps even for unrelated words). Common short words easily clear 0.5 against unrelated targets.
- **Interim transcripts are processed immediately** and the matcher reprocesses the last 3 interim words on every revision — so the cursor can race forward on half-formed speech before you finish the real word.

### Listen Mode — hint only fires once
In `src/components/ListenMode.tsx`:

- Inside `rec.onresult`, `lastSpeechAtRef.current = Date.now()` is set on **every** result event (including continuous interim chatter). The 2 s silence threshold therefore rarely fires a second time.
- `hintShown` is only cleared inside `processSpoken` when a word actually matches. If the user speaks without matching, the hint stays in "shown" state forever and the silence detector's `setHintShown(true)` is a no-op for the next stuck word.
- The hint always shows the same 4 words from `currentIndex`, so even when it does re-fire it doesn't feel like new help.

## Fix plan

### A. `CompactPresentationView.tsx` — stricter, slower matching

1. **Tighten similarity threshold** from `0.5` → `0.72` for normal matches. Keep `0.5` only for hard-to-recognize words (numbers/acronyms via `isHardToRecognizeWord`).
2. **Shrink lookahead window** from 8 → 2 words, and require the lookahead match to clear a **higher** bar (`0.78`). This prevents a stray token from leapfrogging a whole phrase.
3. **Stop processing interim revisions aggressively.** Only process the *new tail* of the interim transcript (drop the "reprocess last 3 words" branch). Final transcripts still go through the matcher, so corrections are not lost.
4. **Add a per-word minimum dwell time** of ~250 ms between successful matches to stop a single burst of recognized speech from chain-advancing several words instantly.
5. **When >2 wrong attempts accumulate**, briefly flash the current word red instead of silently skipping ahead, so wrong-sentence runs are visible rather than mis-credited.

### B. `ListenMode.tsx` — keep hints repeating

1. **Only update `lastSpeechAtRef` on real progress or on `onspeechstart`**, not on every `onresult` tick. This lets the 2 s silence timer fire reliably whenever the user actually pauses.
2. **Clear `hintShown` automatically** once the silence timer detects fresh speech (i.e. when `Date.now() - lastSpeechAtRef < 500 ms`), so the next stuck word can re-trigger the hint.
3. **Escalate the hint** the longer silence persists:
   - 2 s pause → show next 3 words
   - 4 s pause → show next sentence (up to ~10 words)
   - 6 s pause → also show the word after that ("…then `<word>`") as an extra cue
4. **Reset `hintShown` whenever `currentIndex` changes**, so even partial progress resets the hint state cleanly.
5. Keep the existing "lookahead skipping" but apply the same tighter thresholds as the presentation fix (0.72 / 2-word window) so listen mode also stops mis-advancing on wrong sentences.

### C. Shared cleanup

- Extract the matching constants (`SIMILARITY_THRESHOLD`, `LOOKAHEAD_WORDS`, `LOOKAHEAD_THRESHOLD`, `MIN_WORD_DWELL_MS`) into a small shared helper at the top of each file with comments explaining why they're tuned this way, so future tweaks don't drift between modes.

## Files to change

- `src/components/CompactPresentationView.tsx` — matcher thresholds, lookahead, interim handling, dwell time, wrong-attempt feedback.
- `src/components/ListenMode.tsx` — silence timestamp logic, hint state reset, escalating hint stages, tighter matcher.

No backend, schema, or i18n changes required. New hint stages reuse existing `listenMode.nextWords` translation key.

## Expected result

- In **Whole Speech / Presentation mode**, the cursor only advances when you actually say the right word, and reading a wrong sentence will visibly stall and flash instead of jumping to the end.
- In **Listen Mode**, every time you pause for 2 s the next words appear, and longer pauses reveal progressively more help — for as long as the session lasts, not just the first time.
