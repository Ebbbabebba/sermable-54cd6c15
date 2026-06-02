## Bug

When moving from sentence 1 → sentence 2 (or any phase change) in `BeatPracticeView`, the blue pulse stays stuck on the first word for several seconds and the recognizer ignores what the user says.

## Root cause

On iOS the Capacitor native speech plugin (and Web Speech on Safari) returns a **cumulative** transcript for the current recognition session. When `transitionToPhase()` runs we currently only:

- clear our local mirrors (`nativeFinalsRef`, `lastNativeInterim`, `transcriptWordsRef`)
- set `ignoreResultsUntilRef` to drop events for ~350 ms
- set `staleReplayGuardUntilRef` to drop any first event containing >2 words for ~250 ms

We intentionally do **not** abort the underlying recognizer (to avoid the iOS mic "ding"). The problem: the very next `partialResults` event from iOS still contains the entire sentence-1 transcription inside `matches[0]`. After the 250 ms stale-replay window expires the matcher sees `["sentence", "one", "old", "words", "...", "new"]` against sentence-2's word 0, the tokens don't line up, nothing advances, and the pulse appears frozen until the user keeps talking long enough for the new word to finally land in a matchable position.

Clearing `nativeFinalsRef` does not help — the cumulative content lives inside iOS's recognition session, not in our buffer.

## Fix

On phase transitions, fully restart the recognizer so the new session starts with a truly empty transcript. The mic "ding" concern that motivated the no-abort behaviour does not apply on the native iOS path (Capacitor plugin is silent on stop/start), and for Web Speech a single chime at a sentence boundary is acceptable compared to losing the first word.

### Changes (all in `src/components/BeatPracticeView.tsx`)

1. Add a helper `hardRestartRecognition()` that:
   - For the native path: calls `NativeSpeech.stop()` — the existing `listeningState === "stopped"` handler already auto-restarts a fresh session after 50 ms, which is what we want.
   - For the Web Speech path: calls `recognitionRef.current.abort()` — the existing `onend` handler restarts it, gated by `recognitionRestartAtRef`.
   - Clears `nativeFinalsRef`, resets `lastNativeInterim` via the exposed `clearBuffer()`, and bumps `ignoreResultsBeforeIndexRef` to the current result count.

2. Call `hardRestartRecognition()` from inside `transitionToPhase()` (after the existing ref resets, before `pauseSpeechRecognition(350)`).

3. Shorten `ignoreResultsUntilRef` window in `transitionToPhase` from 350 ms back down to ~150 ms once the hard restart is in place — the restart itself, not a timed mute, is now what protects us from replay. This is the user-visible win: the first word of sentence 2 becomes responsive again.

4. Remove (or relax) the `staleReplayGuardUntilRef` check at lines 1607–1615 for the case where the recognizer was hard-restarted — it was a workaround for the cumulative-buffer issue and is what currently swallows the first real utterance on sentence 2. Keep the guard for the `resetForNextRep` path inside the same phase (where we still don't restart).

### Out of scope

- No change to matcher leniency, hesitation timing, or hidden-word logic.
- No change to `resetForNextRep` (mid-phase reps still keep the recognizer alive — only phase boundaries get the hard restart).
- No backend / business-logic changes.

## Verification

- Practise a beat with 3 sentences; confirm the blue pulse moves to sentence-2 word 0 immediately and reacts on the first spoken word.
- Confirm sentence-1 ending words do not retroactively mark sentence-2 words as spoken.
- Confirm no regression in single-sentence reps (no extra chime, no stale-replay regressions inside the same phase).
