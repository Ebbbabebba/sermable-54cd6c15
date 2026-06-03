## Problem

While practicing a beat, three issues stack on top of each other:

1. **The blue cursor jumps ahead before you've spoken the current word** — feels like the system is racing past you.
2. **The first 1–2 seconds of a new sentence/round freeze** — recognition isn't listening yet, so the cursor sits stuck until you repeat yourself.
3. **The "start hiding" / "let's start fading" banner can fire several times for the same sentence, and previously-hidden words suddenly become fully visible mid-round** — instead of words disappearing smoothly one chunk at a time.

All three live in `BeatPracticeView.tsx` (matching loop, phase transitions, fading completion) and `SentenceDisplay.tsx` (pulse positioning).

## Fixes

### 1. Stop the pulse from jumping ahead (`SentenceDisplay.tsx` + matcher)

- In `SentenceDisplay`, `pulseIndex` currently walks past any word marked `hesitated` or `missed`. Combined with the matcher's 2-word lookahead, when a hidden gap word gets auto-marked the pulse skips two positions at once. Tighten it:
  - Only advance `pulseIndex` past *missed* words (red), not *hesitated* (yellow) ones, so the user always sees the cursor on the word they're actively trying to say.
  - Cap the skip at 1 position max per render.
- In `processTranscription` (BeatPracticeView), the 2-word lookahead currently allows skipping over a *hidden gap word + another word* in the same matching pass. Restrict the 2-word lookahead to **visible** intermediate words only (keep the 1-word gap-skip, drop the 2-word gap-skip). This kills the "I said one word and it jumped two ahead" feel.
- Remove the implicit fast-start gap-word lookahead of up to 4 words (`maxGapLookahead`). Replace with max 2 consecutive gap-word skips, only when the matched word is visible.

### 2. Eliminate the start-of-sentence freeze

Currently the celebration is 1500 ms but `pauseSpeechRecognition(1700)` is fired before it — so the mic is still muted ~200 ms into the new sentence, and `resetForNextRep` then sets another 80 ms stale-replay guard plus a 40 ms ignore window. On native (iOS) the plugin restart adds another ~200 ms. Net effect: ~400–600 ms of silence at every sentence start.

- Shorten the post-completion mic pause from `1700` to `900` ms and align the celebration duration so the mic is live the moment the celebration banner fades.
- In `transitionToPhase`, drop `pauseSpeechRecognition(200)` (it duplicates the pause already issued by `checkCompletion`) and call `resetForNextRep` immediately so the recognizer is armed before the phase render.
- In `resetForNextRep`, only set `staleReplayGuardUntilRef` when the recognizer was actively producing results in the last 300 ms — otherwise leave it at 0 so the user's first word lands instantly.
- Make sure native (`SpeechRecognition.start`) is re-invoked on phase transition rather than waiting for the next `onend` cycle.

### 3. Stop "start hiding" from firing twice and stop hidden words from reappearing in bulk

- Add a guard in `checkCompletion`: bail out if `phase` has already changed since the rep started (compare against `phaseEpochRef.current` captured at the top of the function). Today, a stale buffered transcript can re-enter `checkCompletion` after the phase already moved to fading, retriggering the "great_start_fading" celebration and re-running the learning→fading transition.
- In `handleFadingCompletion`, when `hadErrors` is true:
  - Do **not** un-hide every failed word at once. Instead, reveal only the *first* failed hidden word in the round (the one the user actually got stuck on) and mark the rest as protected (they'll just stay hidden and bubble up later). This stops the "all words suddenly visible again" flash.
  - Don't reset `fadingSuccessCount` to 0 on a single miss — decrement by 1 (min 0) so progress doesn't collapse.
- Debounce `showCelebration` so two rapid completions can't stack: ignore any new celebration request while one is already in flight.

### 4. Verification

- After edits, exercise: start a fresh beat → speak sentence 1 once → confirm exactly one "start hiding" banner → speak the fading rounds → confirm chunks of 3→4→5 words disappear progressively without prior hidden words reappearing.
- Speak slowly with deliberate pauses to confirm the pulse stops on the current word until that word is actually spoken (or hesitation timeout fires).
- Restart a sentence (phase transition) and confirm the first word is accepted with no perceptible mic-dead window.

## Files touched

- `src/components/BeatPracticeView.tsx` — matcher lookahead rules, `checkCompletion` epoch guard, `handleFadingCompletion` reveal/decrement logic, `transitionToPhase`/`resetForNextRep` timing, celebration debounce.
- `src/components/SentenceDisplay.tsx` — `pulseIndex` rule (skip missed only, max 1).

No backend, schema, or API changes.
