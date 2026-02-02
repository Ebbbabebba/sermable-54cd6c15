
# Practice Engagement Enhancement Plan

## Overview
This plan addresses multiple user experience concerns during practice sessions:
1. Maintaining user engagement through animations and loading facts
2. Optimizing learning speed for merged beats
3. Implementing true spaced repetition with one beat per day
4. Fixing the "0 learned" display bug
5. Fixing missing translation placeholders (showing as `{}`)

---

## Technical Changes

### 1. Enhanced Loading Overlay with Memory Facts

**File:** `src/components/LoadingOverlay.tsx`

Transform the basic loading spinner into an engaging experience:
- Add rotating "Did you know?" memory science facts
- Facts cycle every 3 seconds during loading
- Example facts:
  - "Sleep consolidates 40% more memories than staying awake"
  - "Spaced repetition can improve retention by 200%"
  - "Your brain rehearses learned material during REM sleep"
  - "Testing yourself is more effective than re-reading"
  - "Morning recall strengthens overnight memory consolidation"

**Implementation:**
```
- Add array of memory facts (10-15 facts)
- Add useState for current fact index
- Add useEffect with 3-second interval to rotate facts
- Fade animation between fact transitions
- Add corresponding translations in all locale files
```

---

### 2. Merged Beat Optimization (2x Tempo)

**File:** `src/components/BeatPracticeView.tsx`

When 2 or more beats are practiced together (merged beats):

**Current Flow (slow):**
1. Read through 3 times (sentence_1_learning)
2. Fading phase (hide 1 word at a time)
3. Repeat for each sentence, then combine

**Optimized Flow:**
1. Skip to just 1 read-through for merged beats
2. Hide words at 2x rate (2-4 words per successful rep instead of 1-2)

**Implementation:**
- Add `isMergedBeatSession` detection when multiple beats are combined
- For merged sessions:
  - Set `requiredLearningReps = 1` (instead of 2-3)
  - Double the words hidden per success: `wordsToHide = hadErrors ? 2 : Math.min(2 + (fadingSuccessCount * 2), 6)`
- Apply same optimization during recall of multiple beats

---

### 3. True Spaced Repetition: One Beat Per Day

**File:** `src/components/BeatPracticeView.tsx`

Implement science-backed spaced repetition schedule:

**New Beat Learning Cycle:**
1. **Session**: Learn new beat (sentence by sentence, then fading)
2. **10-minute recall**: Notification after 10 minutes for first short-term recall
3. **Evening recall (before 10 PM)**: If less than 6 hours remain before 10 PM, defer to morning
4. **Morning recall**: Next day morning reinforcement
5. **Day 3+**: Recall previously learned beats together before new beat

**Implementation:**
- Modify `showBeatCelebration()` to calculate recall timings
- Add new schedule entries with specific recall times:
  - `recall_10min`: +10 minutes from mastery
  - `recall_evening`: Today at 8 PM (or morning if <6 hours)
  - `recall_morning`: Tomorrow 7-10 AM
- Track recall types in `practice_beats` table (may need migration)
- Update notification edge function to send reminders at these times

**Recall Merging Logic (Day 3+):**
```
Day 1: Learn Beat 1 → 10min recall → Evening → Morning (Day 2)
Day 2: Recall Beat 1, then Learn Beat 2 → Same cycle
Day 3: Recall Beats 1+2 together, then Learn Beat 3
Day 4+: Recall all previous beats together, then learn next
```

---

### 4. Fix "0 Learned" Bug

**File:** `src/pages/Practice.tsx`

**Issue:** The `masteredBeats` count shows 0 even after practicing.

**Root Cause Analysis:**
The count uses `practiceBeats.filter(b => b.is_mastered).length` but `practiceBeats` may not be updated after a beat is mastered during the session.

**Fix:**
- After returning from `BeatPracticeView`, refresh the `practiceBeats` state
- Add a callback from `BeatPracticeView.onComplete` that includes updated beat data
- Or trigger a full reload of `practiceBeats` when `isPracticing` changes from true to false

---

### 5. Fix Missing Translation Placeholders (`{}`)

**Files:** All locale files (`src/i18n/locales/*.json`)

**Issue:** Some translation keys show `{}` instead of actual text.

**Keys to check and add:**
- `beat_practice.beat_number` - "Beat {{number}}"
- `beat_practice.beats_remaining` - with proper `{{count}}` handling
- `beat_practice.come_back` - with `{{current}}` and `{{total}}`
- `beat_practice.no_beats_yet` - with `{{total}}`

**Also check:**
- `progressive` namespace keys that might be missing fallbacks
- Keys using `t('key.name', 'fallback')` pattern where fallback isn't translating

---

### 6. Session Transition Animations

**File:** `src/components/BeatPracticeView.tsx`

Add smooth animations between:
- Learning → Fading transitions
- Sentence → Next sentence transitions  
- Beat completion celebrations
- Session mode changes (recall → learn → rest)

**Implementation:**
- Add Framer Motion `AnimatePresence` wrapper around phase content
- Add entrance/exit animations for text cards
- Add progress ring animations when hiding words
- Add confetti-style particles on beat completion

---

## Database Migration (if needed)

If implementing granular recall scheduling:

```sql
-- Add recall tracking columns to practice_beats
ALTER TABLE practice_beats ADD COLUMN IF NOT EXISTS
  recall_10min_at TIMESTAMP WITH TIME ZONE,
  recall_evening_at TIMESTAMP WITH TIME ZONE,
  recall_morning_at TIMESTAMP WITH TIME ZONE,
  last_merged_recall_at TIMESTAMP WITH TIME ZONE;
```

---

## Push Notification Updates

**File:** `supabase/functions/send-push-notifications/index.ts`

Update to check for specific recall times:
- 10-minute recall reminders
- Evening practice reminders (if not completed today)
- Morning recall prompts

---

## Summary of Changes

| File | Change |
|------|--------|
| `LoadingOverlay.tsx` | Memory facts rotation during loading |
| `BeatPracticeView.tsx` | 2x tempo for merged beats, 1 read-through only |
| `BeatPracticeView.tsx` | True spaced repetition schedule |
| `BeatPracticeView.tsx` | Session transition animations |
| `Practice.tsx` | Fix masteredBeats refresh after practice |
| `en.json` + all locales | Add/fix missing translation keys |
| Database migration | Add recall scheduling columns |
| Edge function | Update notification timing |

---

## Technical Notes

### Merged Beat Detection
```typescript
const isMergedBeatSession = sessionMode === 'recall' && beatsToRecall.length > 1;
// OR when practicing merged segments
```

### Optimized Word Hiding for Merged Sessions
```typescript
const baseWordsToHide = isMergedBeatSession ? 2 : 1;
const progressionMultiplier = isMergedBeatSession ? 2 : 1;
const wordsToHide = hadErrors 
  ? baseWordsToHide 
  : Math.min(baseWordsToHide + (fadingSuccessCount * progressionMultiplier), isMergedBeatSession ? 6 : 3);
```

### 10-Minute Recall Timer
After mastering a beat:
```typescript
const recall10MinDate = new Date(Date.now() + 10 * 60 * 1000);
// Store in schedule and trigger notification
```
