

# Strict Presentation Mode Redesign

## Overview
Simplify the strict mode prep screen by removing inline settings and replacing them with a clean "How it works" section + Start button. Settings move to a gear icon in the corner. Also update the hint timing logic: 2s delay for mid-sentence words, 4s for first word of a new sentence (configurable in settings).

## Changes

### 1. Redesign the Strict Mode Prep Screen (`src/pages/Presentation.tsx`)
- Remove the entire "Settings" block (auto-stop silence slider, font size slider) from the `stage === 'prep'` view
- Keep only:
  - Speech title and word count
  - "How it works" card explaining the mechanic (speak your speech, forgotten words appear after a pause, first words in sentences get extra time)
  - A large "Start Presentation" button
- Add a **Settings gear icon button** in the top-right corner that opens the `PresentationControls` overlay
- Add new state for `hintDelay` (default 2000ms) and `sentenceStartDelay` (default 4000ms) to replace/complement `autoStopSilence`

### 2. Update PresentationControls (`src/components/PresentationControls.tsx`)
- Replace/rename the "Pause Detection" slider to control two values:
  - **Word hint delay**: How long before a forgotten word appears (default 2s, range 1-5s)
  - **Sentence start delay**: Extra time given for first word of a new sentence (default 4s, range 2-8s)
- Keep font size slider
- Keep auto-reveal toggle
- Pass these new settings as props

### 3. Update Hint Timing Logic (`src/components/CompactPresentationView.tsx` and `src/components/StrictPresentationView.tsx`)
- Detect if current word is the first word of a sentence (check if previous word ends with `.`, `!`, `?`, or index is 0)
- Use `sentenceStartDelay` (4s default) for sentence-start words
- Use `hintDelay` (2s default) for mid-sentence words
- The "try to say it" prompt and full word reveal use these adjusted timers
- Pass `hintDelay` and `sentenceStartDelay` as props from `Presentation.tsx`

### 4. Wire It All Together in `Presentation.tsx`
- Add state: `showSettings`, `hintDelay`, `sentenceStartDelay`
- Show settings gear button during `prep` and `live` stages
- Pass timing props down to `CompactPresentationView`

## Technical Details

### Sentence boundary detection
```text
isSentenceStart = (index === 0) || /[.!?]$/.test(words[index - 1])
effectiveDelay = isSentenceStart ? sentenceStartDelay : hintDelay
```

### Prep screen layout (simplified)
```text
+----------------------------------+
| [Back]                    [Gear] |
|                                  |
|    "My Speech Title"             |
|    Strict Mode - 342 words       |
|                                  |
|  +----------------------------+  |
|  | How it works:              |  |
|  | - Speak from memory        |  |
|  | - Forgotten words appear   |  |
|  |   after 2s (4s for new     |  |
|  |   sentences)               |  |
|  | - Get analysis afterward   |  |
|  +----------------------------+  |
|                                  |
|  [====  Start Presentation  ====]|
+----------------------------------+
```

### Ideas for Further Development
- **Speed coaching**: Track words-per-minute and show pacing feedback
- **Confidence score**: Rate overall fluency based on hesitation ratio
- **Streak tracking**: Count consecutive words spoken without prompts
- **Comparison mode**: Side-by-side results from multiple sessions
- **Export results**: Share or download presentation analytics as PDF
