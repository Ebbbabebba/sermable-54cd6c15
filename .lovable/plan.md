# Quiet down the per-word sound — only buzz on beat completion

The presentation view currently fires a haptic/sound on every successful word match, every 10th word, every wrong attempt, every silence-warning, and on session complete. That's why it feels noisy.

## Fix

In `src/components/CompactPresentationView.tsx`, remove the per-word and per-attempt buzzes. Only trigger haptics when a **beat** is completed — i.e. when the word that was just matched ends a sentence (`.`, `!`, `?`), and once on session complete.

Specifically:

- **Line 404 (`haptics.trigger('success')` on every word)** → only fire if the matched word ends in `.`, `!` or `?`.
- **Lines 408-410 (`haptics.trigger('progress')` every 10 words)** → remove.
- **Line 339 (`haptics.trigger('warning')` on silence)** → remove (visual hint is enough).
- **Line 281 & 458 (`haptics.trigger('error')` on wrong word)** → remove.
- **Line 486 (`haptics.trigger('complete')` on session end)** → keep.
- **Line 508 (`haptics.trigger('tap')` on start/stop button)** → keep (standard button feedback).

Result: silent during the speech, a single subtle pulse at the end of each sentence, and one completion buzz at the end. No other files affected.
