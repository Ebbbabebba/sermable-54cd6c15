## Problem

Two related issues during beat practice:

1. **The blue pulse jumps over words.** While the user is mid-sentence, the cursor leaps past one or more visible words it hasn't heard yet.
2. **Words start hiding before the sentence has actually been finished.** Fading begins even though the user hasn't said the full sentence cleanly yet.

Both bugs trace to three places in `src/components/BeatPracticeView.tsx`:

- The matcher's visible 2-word lookahead in `processTranscription` (lines ~1742–1764) can mark two visible words as "spoken" on a single recognized token.
- The hesitation auto-advance loop (lines ~3190–3232) flips hidden words to "spoken" on a 2 s timeout and, combined with the lookahead, can race the cursor to the end of the sentence.
- `requiredLearningReps = 1` (line 403), so as soon as `checkCompletion` sees every word marked spoken — even via lookahead + hesitation auto-advance — fading starts. There is no "you've actually read this whole sentence" gate.

## Fix

### 1. Stop the pulse from skipping (matcher)

In `processTranscription`:

- Remove the 2-word visible-lookahead branch entirely (the `else if (canSkipCurrent && advancedTo + 2 < words.length)` block). Keep only the 1-word lookahead so a single recognized token can never advance the cursor by more than two positions in one pass.
- Cap auto-advance per processing pass: at most one "skipped visible word" per call. If the matcher already consumed a lookahead skip in this pass, force subsequent tokens to match `advancedTo` exactly.
- In `SentenceDisplay.tsx`, the pulse already follows `currentWordIndex` directly — leave it. But add an internal clamp so the rendered pulse can advance by at most 1 position per React commit (track previous `pulseIndex` in a ref and step toward target). This kills any residual visual leap when state batches multiple advances.

### 2. Require a real read-through before fading starts

In `checkCompletion` / state setup:

- Bump `requiredLearningReps` from `1` to `2` for the **first** time a sentence is seen (`sentence_*_learning`), so the user reads it fully twice before words begin to fade. Keep `1` for `beat_learning` / combining phases where the user has already practiced the parts.
- Add a "fresh-speech word count" counter `freshMatchesThisRepRef`. Increment it every time `processTranscription` records a match that was driven by `matchedFreshSpeech` (not by hesitation auto-advance or lookahead skip-fills).
- In `checkCompletion`, reject completion if `freshMatchesThisRepRef.current < Math.ceil(words.length * 0.6)`. If rejected, log it, do NOT advance phase, just reset for the next rep so the user can finish saying the sentence. This is the hard gate against "fading kicked in before I finished speaking."

### 3. Tame hesitation auto-advance during learning

In the hesitation interval (lines 3190–3232):

- During any `*_learning` phase, do not auto-complete the sentence from a hesitation tick. If `nextIdx >= wordsLengthRef.current` and the phase is learning, skip the `checkCompletion(...)` call — let the user finish naturally. (Auto-advance through individual hidden gap words mid-sentence is still fine.)
- Increase the hesitation threshold by ~500 ms for the **last word** of a sentence so the user gets a moment to land the final word before it's marked yellow and skipped.

### 4. Verification

- Speak slowly through a fresh sentence with deliberate pauses: confirm the pulse stops on the current word until that word is actually spoken, never jumping two positions on a single utterance.
- Read a brand-new sentence once: confirm fading does NOT start ("let's start hiding" banner does not appear). Read it a second time cleanly: fading starts.
- Pause halfway through a sentence: confirm `checkCompletion` does not trigger fading until the user actually finishes the remaining words.

## Files touched

- `src/components/BeatPracticeView.tsx` — matcher lookahead trimmed; fresh-match counter + completion gate; `requiredLearningReps` per-phase logic; hesitation tick learning-phase guard.
- `src/components/SentenceDisplay.tsx` — pulse step-clamp so cursor visually advances at most one position per render.

No backend, schema, API, or copy changes.