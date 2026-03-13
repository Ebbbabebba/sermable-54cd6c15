

# Improve Word-Marking Sync with Speaking Pace

## Problem
Word marking can feel out of sync with speech because:
1. **Polling-based processing** (every 150ms) adds latency — words batch up between polls
2. **Only final transcripts** are used — interim results are ignored, adding 300-800ms delay from speech recognition
3. **No stagger queue** — when multiple words arrive at once (fast speech), they all mark simultaneously instead of sequentially
4. **Adaptive tempo hook exists but isn't connected** — hesitation thresholds are hardcoded (1s/3s) instead of adapting to your pace

## Plan

### 1. Wire up `useAdaptiveTempo` into `EnhancedWordTracker`
- Import and initialize `useAdaptiveTempo` in the component
- Call `recordWordTiming()` each time a word is matched, passing the interval since the last word, word length, and whether it follows a sentence ending
- Replace hardcoded hesitation thresholds (1000ms / 3000ms) with `getAdaptiveThreshold()` calls — so the system learns your natural pace and only flags true hesitations

### 2. Add a stagger queue for visual word marking
- Instead of marking all matched words in a single render, push them into a queue
- Process the queue one word at a time with adaptive delay (based on `medianInterval` from the tempo hook, scaled to ~60-80% of natural pace)
- This creates smooth sequential marking that mirrors actual speaking speed instead of chunked updates

### 3. Reduce polling interval with guard
- Reduce the `setInterval` from 150ms to 100ms for faster pickup of new transcript data
- Add a "minimum time since last word" guard (based on adaptive tempo) to prevent marking words faster than physically possible to speak — this is the key protection against premature marking

### 4. Use interim transcripts for current-word highlighting only
- Process interim transcripts to update the "current word" indicator (the pulsing highlight) without actually marking words as spoken
- This gives immediate visual feedback that the system is hearing you, while final transcripts still control the actual word progression

## Files to modify
- **`src/components/EnhancedWordTracker.tsx`** — all four changes above
- **`src/hooks/useAdaptiveTempo.ts`** — no changes needed, already complete

