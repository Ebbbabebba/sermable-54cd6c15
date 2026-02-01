
# Plan: Fix Beat Progression and Implement Pre-Beat Recall for All Users

## Problem Summary

Three issues need to be fixed:

1. **Same beat keeps showing after finishing** - After mastering a beat, when the user returns to practice, the same beat appears instead of advancing to the next one
2. **No pre-beat recall before new beats** - Users should recall the previously mastered beat once before learning a new one
3. **No clear path to deadline-day mastery** - The system should ensure word-by-word memorization by the deadline

---

## Root Cause Analysis

### Issue 1: Beat Not Advancing
In `BeatPracticeView.tsx`, the `showBeatCelebration()` function (lines 1481-1616):
- Marks the current beat as mastered in the database
- Updates local state with `setBeats(updatedBeats)`
- BUT only premium users in intensive mode (`beatsPerDay > 1`) get the flow that queues the next beat
- Free users and `beatsPerDay === 1` users go directly to `session_complete`
- The problem: the local `beats` state is updated, but `newBeatToLearn` is NOT updated to point to the next unmastered beat
- On session reload, `loadOrCreateBeats()` should pick the next unmastered beat, but if it doesn't, the same beat shows again

### Issue 2: Pre-Beat Recall Missing
The `pre_beat_recall` mode exists but is only triggered in the intensive mode flow:
- Line 1577-1583: Only when `shouldContinueToday && nextUnmastered` 
- Regular users never get this mode between sessions
- The recall should happen at the START of each new session (when returning to practice)

---

## Solution Design

### Part 1: Fix Beat Progression in Same Session

After mastering a beat, the system should:
1. Mark beat as mastered (already works)
2. Find the next unmastered beat (already works)
3. If there's a next beat AND we should continue today:
   - Set up pre-beat recall flow (recall the just-mastered beat)
   - Then transition to learning the next beat
4. If session complete (no more beats today):
   - Just show session complete (already works)

### Part 2: Implement Pre-Beat Recall at Session Start

When `loadOrCreateBeats()` loads and finds:
- At least 1 mastered beat exists
- A new beat to learn exists
- This is NOT a recall-only session

Then BEFORE showing beat_preview for the new beat:
1. Show the last mastered beat for ONE recall pass
2. User must recall it with all words hidden
3. Then proceed to beat_preview for the new beat

### Part 3: Ensure Word-by-Word Mastery by Deadline

The current system already has strong foundations:
- Progressive word hiding in fading phases
- All words must be hidden for beat mastery
- Spaced repetition intervals based on deadline

To guarantee deadline-day readiness:
- 3 days before deadline: Automatic full-speech practice mode
- 1 day before: Only full-speech recalls (no individual beats)
- Deadline day: Pure recall mode

---

## Implementation Details

### File: `src/components/BeatPracticeView.tsx`

#### Change 1: Add Pre-Beat Recall at Session Start

In `loadOrCreateBeats()` around line 529, after determining beats to recall and new beat to learn:

```
Current logic:
- If beatsNeedingRecall.length > 0 → recall mode
- Else if firstUnmastered → beat_preview
- Else → session_complete

New logic:
- If beatsNeedingRecall.length > 0 → recall mode (unchanged)
- Else if firstUnmastered:
  - Check if there's a PREVIOUSLY mastered beat (most recent)
  - If yes → start in pre_beat_recall mode for that beat, queue the new beat
  - If no (first beat ever) → go directly to beat_preview
- Else → session_complete
```

#### Change 2: Store "Last Mastered Beat" for Pre-Recall

When entering with a new beat to learn:
1. Find the most recently mastered beat (by `mastered_at` timestamp)
2. Set `beatToRecallBeforeNext` to that beat
3. Set `nextBeatQueued` to the new beat to learn
4. Enter `pre_beat_recall` mode

#### Change 3: Fix In-Session Progression for All Users

In `showBeatCelebration()`, after marking beat as mastered:
- For ALL users (not just premium intensive mode), if there's a next beat:
  - Queue the next beat
  - Enter rest/pre-beat-recall flow
- Remove the artificial split between premium/free for beat progression

---

## Session Flow Diagram

```text
User enters Practice
         │
         ▼
    Load Beats
         │
         ├─── Has beats needing daily recall? ─── YES ──▶ RECALL MODE
         │                                                     │
         │                                                     ▼
         NO                                           Recall all mastered
         │                                            beats (2x each)
         ▼                                                     │
    Has new beat to learn?                                    ▼
         │                                            Done with recalls
         ├─── YES                                              │
         │       │                                             ▼
         │       ▼                                    Has new beat to learn?
         │   Has previously mastered beat?                     │
         │       │                                    ├─ YES ──▶ PRE-BEAT RECALL
         │       ├── YES ──▶ PRE-BEAT RECALL                   │
         │       │           (recall last beat once)           │
         │       │                  │                 └─ NO ───▶ SESSION COMPLETE
         │       │                  ▼
         │       │           BEAT PREVIEW
         │       │                  │
         │       │                  ▼
         │       │            LEARN MODE
         │       │           (sentence by sentence)
         │       │                  │
         │       │                  ▼
         │       │           Beat Mastered!
         │       │                  │
         │       │                  ▼
         │       │      More beats to learn today?
         │       │           │            │
         │       │          YES          NO
         │       │           │            │
         │       │           ▼            ▼
         │       │     Queue next    SESSION COMPLETE
         │       │     + Rest Timer
         │       │           │
         │       │           ▼
         │       │     PRE-BEAT RECALL
         │       │     (for just-mastered)
         │       │           │
         │       │           ▼
         │       │     BEAT PREVIEW
         │       │     (for next beat)
         │       │           │
         │       └───────────┴──────────────────────────▶ (continue loop)
         │
         └─── NO ──▶ SESSION COMPLETE (all mastered or limit reached)
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/BeatPracticeView.tsx` | Add pre-beat recall at session start; fix beat progression for all users |

---

## Technical Implementation Steps

### Step 1: Modify Session Start Logic
In `loadOrCreateBeats()`, after line 533 (where we check for new beat to learn):
- Find the most recently mastered beat (if any)
- If found, set up pre-beat recall before beat preview
- Update `sessionMode` to `pre_beat_recall` with proper state

### Step 2: Simplify In-Session Beat Progression
In `showBeatCelebration()`:
- Remove the complex premium/free/intensive mode branching
- After marking beat as mastered, check if there's a next unmastered beat
- If yes AND daily limit not reached: queue it for learning (with pre-beat recall)
- If no OR limit reached: session complete

### Step 3: Ensure Pre-Beat Recall Completion Flows Correctly
In `handlePreBeatRecallCompletion()`:
- After successful recall with all words hidden
- Transition to `beat_preview` for the `nextBeatQueued` beat
- This already exists but may need verification

---

## Edge Cases Handled

1. **First beat ever** - No pre-beat recall (nothing to recall yet)
2. **All beats mastered** - Goes to session complete with all-mastered message
3. **Free user daily limit** - Session complete + upsell prompt
4. **User exits mid-session** - Checkpoint saved, resume from same spot
5. **Deadline approaching** - Intervals shortened automatically (already works)

---

## Expected User Experience

### Session Flow (After Fix):
1. User opens practice for speech with Beat 1 mastered, Beat 2 unmastered
2. System shows "Recall Time" - user recalls Beat 1 (all words hidden)
3. After successful recall, "Coming up..." preview of Beat 2
4. User clicks "I'm Ready to Practice"
5. Learns Beat 2 sentence by sentence
6. After mastering Beat 2 → Session Complete
7. Next session: Recall Beat 2, then learn Beat 3

### By Deadline Day:
- User has mastered all beats individually
- Daily recalls have reinforced memory
- Full speech recall mode ensures seamless performance
