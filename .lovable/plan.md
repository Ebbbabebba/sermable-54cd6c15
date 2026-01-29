
# Beat Preview and Full Speech View Implementation

## Overview

This plan implements two features to improve the memorization experience for long speeches:

1. **Beat-by-Beat Preview**: Before practicing each new beat, show the upcoming beat text for a quick read-through
2. **"Show Whole Speech" Button**: A button that opens a modal/sheet showing the complete speech text on demand

---

## Current Flow Analysis

The practice flow currently works as follows:
1. User enters Practice page
2. BeatPracticeView loads with beats from database
3. Recall mode: User recalls previously mastered beats
4. Learn mode: User learns the new beat directly (sentence by sentence, then combined)

The gap: Users jump directly into beat practice without any context about what they're about to learn.

---

## Implementation Details

### 1. Beat Preview Phase

**New Session Mode**: Add a `beat_preview` mode that shows before learning a new beat.

**Flow**:
```text
[Recall mastered beats] -> [Beat Preview] -> [Learn new beat]
                              |
                           "Read through this beat"
                           "Continue when ready"
```

**UI Design**:
- Clean, centered card showing the full beat text (all 3 sentences)
- Header: "Coming up..." or "Next Beat Preview"
- Large, readable text (no hiding, no tracking)
- Single button: "I'm Ready" to proceed to learning
- Skip option to go straight to practice if familiar

### 2. "Show Whole Speech" Button

**Location**: Header area of BeatPracticeView (near the exit button)

**Behavior**:
- Opens a Sheet/Dialog with the complete speech text
- Read-only view with ScrollArea for long content
- Shows current beat highlighted (optional enhancement)
- Close button returns to practice

---

## Technical Implementation

### Changes to BeatPracticeView.tsx

**1. New Props**:
```typescript
interface BeatPracticeViewProps {
  speechId: string;
  subscriptionTier?: 'free' | 'student' | 'regular' | 'enterprise';
  fullSpeechText?: string; // New: Full speech text for "Show Whole Speech"
  onComplete?: () => void;
  onExit?: () => void;
  onSessionLimitReached?: () => void;
}
```

**2. New Session Mode**:
```typescript
type SessionMode = 'recall' | 'learn' | 'beat_rest' | 'pre_beat_recall' | 'beat_preview' | 'session_complete';
```

**3. New State**:
```typescript
const [showFullSpeechModal, setShowFullSpeechModal] = useState(false);
```

**4. Beat Preview Screen**:
- Displayed when `sessionMode === 'beat_preview'`
- Shows the upcoming beat text (all sentences joined)
- "I'm Ready" button transitions to `learn` mode
- Triggered after recall completes, before learning new beat

**5. Full Speech Modal**:
- Sheet or Dialog component
- Receives `fullSpeechText` prop from Practice.tsx
- Scrollable area with full text
- Optional: Highlight current beat's position in the full text

### Changes to Practice.tsx

**1. Pass Full Speech Text**:
```typescript
<BeatPracticeView
  speechId={id}
  subscriptionTier={subscriptionTier}
  fullSpeechText={speech?.text_original}  // New prop
  onComplete={handleBeatPracticeComplete}
  onExit={() => setIsPracticing(false)}
/>
```

---

## UI Mockups

### Beat Preview Screen
```text
+------------------------------------------+
|  [X]                           📚 Beat 2 |
+------------------------------------------+
|                                          |
|            Coming up...                  |
|                                          |
|   +----------------------------------+   |
|   |                                  |   |
|   |  "First sentence of the beat.   |   |
|   |   Second sentence continues.    |   |
|   |   Third sentence ends here."    |   |
|   |                                  |   |
|   +----------------------------------+   |
|                                          |
|         Read through once, then:         |
|                                          |
|         [ I'm Ready to Practice ]        |
|                                          |
+------------------------------------------+
```

### Full Speech Button Location
```text
+------------------------------------------+
|  [X]  [Skip]    ████████░░░   📚 Beat 2  |
|               +--------+                  |
|               |📖 Full |  <-- New button  |
|               | Speech |                  |
|               +--------+                  |
+------------------------------------------+
```

### Full Speech Modal
```text
+------------------------------------------+
|  Full Speech                       [X]   |
+------------------------------------------+
|                                          |
|  Paragraph 1 of the speech text goes     |
|  here with normal formatting...          |
|                                          |
|  Paragraph 2 continues the speech...     |
|                                          |
|  [Currently practicing: highlighted]     |
|                                          |
|  More text continues below...            |
|                                          |
+------------------------------------------+
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/BeatPracticeView.tsx` | Add `beat_preview` mode, full speech modal, new props |
| `src/pages/Practice.tsx` | Pass `fullSpeechText` prop to BeatPracticeView |

---

## Flow Changes Summary

**Before**:
```text
Start -> Recall Mode -> Learn Mode -> Rest -> Next Beat
```

**After**:
```text
Start -> Recall Mode -> Beat Preview -> Learn Mode -> Rest -> Next Beat
                            ^
                            |
              (can tap "📖 Full Speech" anytime)
```

---

## Edge Cases

1. **First beat (no recall)**: Skip directly to beat preview for the first unmastered beat
2. **Very short speeches (1 beat)**: Still show preview for consistency
3. **Already familiar users**: "Skip preview" option to go directly to practice
4. **Long speeches**: Full speech modal uses ScrollArea for smooth scrolling
5. **Speech language**: Text displayed in original language (no translation needed)

---

## Estimated Scope

- BeatPracticeView.tsx: ~150 lines of new code
- Practice.tsx: ~5 lines (prop passing)
- New imports: Sheet or Dialog components (already available in UI library)

