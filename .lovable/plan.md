# Goal

Make the practice screen feel "instant" — pulse advances the moment a word is matched, no perceptible blackout between reps/phases, no hidden swallowing of the first spoken word.

# Findings

After auditing `BeatPracticeView.tsx` and `SentenceDisplay.tsx`, the lag the user perceives comes from three overlapping sources:

1. **Speech-result filtering that silently drops the user's next first word**
   - `transitionToPhase` (line 2606) still sets `ignoreResultsBeforeIndexRef.current = latestSpeechResultCountRef.current`. On Web Speech the recognizer is continuous, so the next interim result reuses the previous slot and gets skipped — exactly the "stuck on first word" pattern, just at phase boundaries.
   - Multiple `ignoreResultsUntilRef` extensions stack: `resetForNextRep` (+75ms) + `transitionToPhase` (+150ms) + `pauseSpeechRecognition(350)` ⇒ up to ~350ms of mic-deafness right when the user starts the new rep.

2. **Unnecessary "speech ready" delays**
   - Web Speech `onstart` waits 250ms before `setIsSpeechReady(true)`.
   - Native path schedules a redundant 450ms `speechReadyTimeoutRef` even though `isSpeechReady` is already set true on `startNativeSession` resolve.
   - Result: the pulse/UI briefly looks idle even though recognition is live.

3. **Animation timings on `SentenceDisplay` that visibly trail the matcher**
   - Current-word pulse uses `duration: 1.2s` / `1.5s` — feels sluggish.
   - `displayedIndex` is mirrored from `currentWordIndex` via `useState` + `useEffect`, adding one render tick before the pulse moves.
   - `layout` and `opacity` transitions run at 0.2–0.25s; can be tightened to ~0.15s without looking jumpy.

# Plan

## 1. Fix phase-transition first-word swallow (`BeatPracticeView.tsx`)

- Line 2606: replace `ignoreResultsBeforeIndexRef.current = latestSpeechResultCountRef.current` with `ignoreResultsBeforeIndexRef.current = 0`. The native plugin already gets `clearBuffer()`, and Web Speech's `onend → onstart` cycle resets `event.results` indices to 0, so a 0 cutoff is correct in both engines.
- Reduce stacked blackout in `transitionToPhase`: drop the `+150ms` extension on `ignoreResultsUntilRef` (the `pauseSpeechRecognition(350)` already covers debounce) and trim `pauseSpeechRecognition(350)` → `pauseSpeechRecognition(200)`.
- In `resetForNextRep`, lower the `+75ms` ignore window to `+40ms`.

## 2. Remove "speech ready" delays

- `recognition.onstart`: set `isSpeechReady` synchronously (drop the 250ms timeout).
- Native path: remove the 450ms `speechReadyTimeoutRef` (it's already set true immediately after `startNativeSession`).

## 3. Snappier pulse on `SentenceDisplay.tsx`

- Delete the `displayedIndex` `useState`/`useEffect` indirection and use `currentWordIndex` directly when computing `pulseIndex`. Saves one render frame.
- Pulse animation: change `scale: { duration: 1.2, repeat: Infinity }` → `0.8s` for current-word and hidden-dot variants; change the indicator dot's `duration: 1.5` → `0.9`.
- Reduce `smoothTransition` from `0.25` → `0.18`, and `layout`/`opacity` transitions from `0.2` → `0.15`.

## 4. Verify

- Run typecheck.
- Confirm in the preview that:
  - Starting a fresh rep, the very first spoken word turns gray immediately.
  - The blue pulse moves to the next word with no visible lag.
  - Phase transitions (sentence_1 → sentence_2, beat merges) do not swallow the first word of the new phase.

# Out of scope

- Matching logic, hesitation thresholds, hidden-word selection, scoring, and AI calls are not touched.
- No color/theme changes — only timing constants and the one filter-index bug.
