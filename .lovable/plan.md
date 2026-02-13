

## Spaced Repetition 2/3/5/7 Schedule + Beat Merging

### Problem
1. The current recall scheduling uses fixed time-based intervals (10min, evening, morning, then vague "daily"). There is no proper 2/3/5/7 day spaced repetition schedule.
2. After morning recall, the session ends instead of continuing to the next unlearned beat.
3. Multi-beat speeches practice beats in isolation forever -- they never merge (1 -> 2 -> 1+2 -> 3 -> 1+2+3, etc.).

### Solution Overview

#### 1. 2/3/5/7 Spaced Repetition Schedule (Deadline-Adjusted)

After a beat is mastered, schedule recall sessions at these intervals from the mastery date:
- Session 1: Day 1 (same day -- 10min + evening + morning recalls already handle this)
- Session 2: Day 3 (2 days after session 1)
- Session 3: Day 6 (3 days after session 2)
- Session 4: Day 11 (5 days after session 3)
- Session 5: Day 18 (7 days after session 4)

When a deadline exists, compress these intervals proportionally. For example, if only 7 days remain, the 2/3/5/7 intervals get compressed to fit within that window.

**Database change**: Add a `recall_session_number` column to `practice_beats` to track which spaced repetition session the beat is on (0 = just mastered, 1 = after 10min/evening/morning, 2 = first 2/3/5/7 session, etc.). Add a `next_scheduled_recall_at` column for the calculated next recall date.

#### 2. After Recall, Jump Into Next Beat

When a recall-only session completes (morning/evening/daily):
- Check if there are unlearned beats remaining
- If yes: automatically transition to learning the next beat (via beat_preview) instead of showing "session complete"
- If no (single-beat speech or all done): show session complete as usual

#### 3. Beat Merging for Multi-Beat Speeches

Implement progressive beat merging during recall sessions:

```text
Beat 1 mastered -> recall beat 1 alone
Beat 2 mastered -> recall beat 2 alone, then recall beat 1+2 merged
Beat 3 mastered -> recall beat 3 alone, then recall beat 1+2+3 merged
Beat 4 mastered -> recall beat 4 alone, then recall beat 1+2+3+4 merged
```

During merged recalls, the text from all merged beats is concatenated and treated as one long recall. This ensures the user practices transitions between beats.

### Technical Details

#### Database Migration

```sql
ALTER TABLE practice_beats 
  ADD COLUMN recall_session_number integer DEFAULT 0,
  ADD COLUMN next_scheduled_recall_at timestamptz DEFAULT NULL;
```

#### File: `src/components/BeatPracticeView.tsx`

**A. 2/3/5/7 Scheduling (in `showBeatCelebration` and recall completion)**

Add a function `calculateNextRecallDate(sessionNumber, masteredAt, goalDate)` that:
- Takes the current recall session number and deadline
- Returns the next recall date using the 2/3/5/7 pattern
- Compresses intervals if deadline is close
- The intervals array: [0 (immediate), 0 (same day evening/morning), 2, 3, 5, 7] days from previous session

When a beat's recall is completed successfully:
1. Increment `recall_session_number`
2. Calculate and store `next_scheduled_recall_at` using the function above
3. Update `last_recall_at`

**B. After Recall -> Next Beat (in recall completion logic, ~line 1342-1356)**

Replace the current "session_complete" path when `newBeatToLearn` is null:
- Query `beats` array for unlearned beats (`is_mastered === false`)
- If found: set it as the new beat to learn, transition to `beat_preview`
- If not found: show `session_complete`

**C. Beat Merging (in `setBeatsAndPlan` and recall completion)**

When building the recall queue (`beatsNeedingDailyRecall` etc.):
1. After individual beat recalls, check if there are multiple consecutive mastered beats
2. If beats 1 through N are all mastered, add a "merged recall" entry that combines their text
3. The merged recall uses concatenated text from all mastered beats up to that point

Add a new `mergedRecallBeats` concept:
- After all individual beat recalls complete, check if 2+ beats are mastered
- If so, add a merged recall round where the user must recall all mastered beats as one continuous text
- Store merged recall completion in `last_merged_recall_at` (column already exists in the table)

**D. Recall queue priority order update:**
1. 10-minute recalls (individual beats)
2. Evening recalls (individual beats)
3. Morning recalls (individual beats)
4. Scheduled 2/3/5/7 recalls (individual beats due today)
5. Merged recall of all mastered beats (if any individual recall was done this session)

#### File: `src/components/BeatPracticeView.tsx` - Beat interface update

Add `recall_session_number` and `next_scheduled_recall_at` to the Beat interface and all queries.

#### File: `supabase/functions/send-push-notifications/index.ts`

Update to check `next_scheduled_recall_at` for sending push notifications on scheduled recall days, in addition to existing evening/morning checks.

### Example Flow (3-beat speech, 7-day deadline)

```text
Day 1: Learn Beat 1 -> 10min recall -> Evening recall -> Morning recall (Day 2 6AM)
Day 2: Morning recall Beat 1 -> Learn Beat 2 -> 10min recall Beat 2 -> Evening recall Beat 2 + Merged 1+2
Day 3: Morning recall Beat 2 -> Merged 1+2 -> Learn Beat 3 -> 10min recall Beat 3 -> Evening recall Beat 3 + Merged 1+2+3
Day 4: Scheduled recall Beat 1 (2 days after session 1) + Merged 1+2+3
Day 5: Scheduled recall Beat 2 (2 days) + Beat 3 (2 days) + Merged 1+2+3
Day 6: Full speech mode (all beats merged, 8-hour intervals)
Day 7: Deadline - pure recall mode
```

### Summary of Changes
- **1 migration**: Add `recall_session_number` and `next_scheduled_recall_at` columns
- **`BeatPracticeView.tsx`**: Add scheduling function, update recall completion to jump to next beat, implement merged recall queue
- **`send-push-notifications/index.ts`**: Add scheduled recall notification triggers

