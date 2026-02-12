

## Implement Evening and Morning Recall Sessions

### Problem
After mastering a beat and completing the 10-minute coffee break recall, there is no scheduled reinforcement until the next day's session. Research shows that an **evening review** (same day) and a **morning review** (next day) are critical for memory consolidation -- especially because sleep plays a major role in transferring short-term memory to long-term memory.

### Current Flow
```text
Master Beat -> 10m Coffee Break -> Quick Recall -> Next Beat -> ... -> Session Done
                                                                         |
                                                          (next session = next day, no evening/morning recall)
```

### Proposed Flow
```text
Master Beat -> 10m Coffee Break -> Quick Recall -> Next Beat -> ... -> Session Done
                                                                         |
                                              Evening Recall (7-11 PM same day, push notification)
                                                                         |
                                              Morning Recall (6-10 AM next day, push notification + in-app prompt)
                                                                         |
                                                              Normal adaptive intervals
```

### Changes

#### 1. Schedule Evening and Morning Recalls in the Database
When a beat is mastered in `BeatPracticeView.tsx` (the `showBeatCelebration` function), calculate and store `recall_evening_at` and `recall_morning_at` timestamps alongside the existing `recall_10min_at`:
- **Evening**: Same day at 8 PM (or 2+ hours after mastery if mastered after 6 PM)
- **Morning**: Next day at 7 AM

#### 2. Add Evening/Morning Recall Detection to Session Start
Update the beat loading logic (`setBeatsAndPlan`) to detect beats needing evening or morning recalls, in addition to the existing 10-minute recall detection. Priority order:
1. 10-minute recalls (highest priority)
2. Evening recalls (due and not yet completed)
3. Morning recalls (due and not yet completed)
4. Daily recalls (existing logic)

#### 3. Update the `last_recall_at` Tracking
After a successful evening or morning recall, update `last_recall_at` on the beat so it is not triggered again.

#### 4. Send Push Notifications for Evening and Morning Recalls
Update the `send-push-notifications` edge function to check for beats with `recall_evening_at` or `recall_morning_at` that are due and send targeted notifications:
- Evening: "Time for a quick evening review of [beat]. Sleep will lock it into memory!"
- Morning: "Morning memory test! Your brain consolidated overnight. Quick recall now for maximum retention."

#### 5. Integrate with Existing Morning Recall UI
The `SleepAwareScheduling` component already shows a morning recall prompt (6-10 AM). Update it to check for beats with `recall_morning_at` due, rather than relying solely on `localStorage`.

### Technical Details

**Files to modify:**
- `src/components/BeatPracticeView.tsx` -- Schedule evening/morning timestamps on mastery; detect and trigger evening/morning recalls at session start
- `supabase/functions/send-push-notifications/index.ts` -- Add evening/morning recall notification triggers
- `src/components/SleepAwareScheduling.tsx` -- Use database `recall_morning_at` instead of localStorage for morning prompts

**Database columns already exist** -- `recall_evening_at` and `recall_morning_at` are already in the `practice_beats` table, just unused.

**No migration needed** -- all required columns are already present.

