# Silence the per-word/per-sentence buzz

User reports the haptic still fires too often during practice/presentation. They want a buzz only when an entire beat is completed.

## Fix

In `src/components/CompactPresentationView.tsx`:
- Remove the sentence-ending `haptics.trigger('success')` (line ~404). It fired on every `.`, `!`, or `?` and felt continuous within a multi-sentence beat.
- Keep `haptics.trigger('complete')` (final beat done) and `haptics.trigger('tap')` on the start/stop button.

Result: total silence during the speech, one buzz when the beat is finished.
