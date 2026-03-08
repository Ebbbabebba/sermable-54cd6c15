

# Redesign Strict Presentation Mode: Sentence Context View

## Current behavior
Right now, strict mode shows a blank screen with a microphone icon. When you hesitate, a hint strip appears at the bottom showing one word. There's no context of where you are in the speech.

## Proposed new behavior

Replace the blank screen with a **sentence-based teleprompter** that shows the current sentence with context, and words fade out as you speak them successfully.

### How it works

1. **Show the full current sentence** on screen, centered, with comfortable reading size
2. **The current expected word** is rendered extra large and bold (black/foreground), making it clear where you are
3. **Upcoming words** in the sentence are shown in a lighter muted color at normal size -- giving you a preview of what's coming
4. **Previous words** (already spoken) fade out smoothly as the AI hears you say them -- they shrink and become transparent over ~400ms
5. **Sentence transitions**: When you finish a sentence, the next sentence slides in smoothly
6. A small **progress indicator** shows which sentence you're on (e.g., "3/12")

### Visual layout

```text
┌─────────────────────────────────────────────┐
│  ✕ Exit                    Recording ● 2/12 │
│                                             │
│                                             │
│     ░░░░░░░░░░░░░░░░░░░░  (progress bar)   │
│                                             │
│                                             │
│       the congregation                      │  ← already spoken (fading out)
│                                             │
│            TODAY                             │  ← current word (extra large, bold)
│                                             │
│    we gather to celebrate                   │  ← upcoming words (muted, normal size)
│    the union of two souls                   │
│                                             │
│                                             │
│              ⏺ / ⏹                          │  ← record button
└─────────────────────────────────────────────┘
```

### Fade-out behavior
- When speech recognition matches a word, it doesn't just disappear -- it **fades and shrinks** over 400ms using Framer Motion
- Multiple words spoken quickly fade out in a staggered sequence (matching the existing word-queue pattern from practice mode)
- This creates the feeling of "the speech dissolving as you speak it"

### Hesitation hints
- Keep the existing hint timing logic (60% delay = "try" prompt, full delay = word reveal)
- But instead of a separate hint strip, the **current word pulses/glows** when hesitating
- If the full hint triggers, the current word transitions from muted to fully visible with a spring animation

## Technical changes

### `src/components/CompactPresentationView.tsx`
- Split the speech text into sentences (by `.!?`)
- Track `currentSentenceIndex` alongside `currentWordIndex`
- Replace the microphone-orb UI (lines 476-526) with the sentence display:
  - Map over words in the current sentence
  - Apply different styles based on word state: spoken (fading), current (large/bold), upcoming (muted)
  - Use `motion.span` with `AnimatePresence` for fade-out of spoken words
- Replace the hint strip (lines 528-549) with inline word glow/pulse on the current word
- Keep all existing speech recognition, silence detection, and performance tracking logic unchanged
- Show previous sentence (faded) and next sentence (preview) for additional context

### No other files need changes
- The prep screen, settings, and results flow remain the same
- All speech recognition and word matching logic stays identical

