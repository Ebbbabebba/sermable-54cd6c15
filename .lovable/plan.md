## Plan: make the post-beat memory plan smarter

The current issue is likely caused by the “all beats completed” fallback: when every beat is mastered and no specific recall is due, the app simply starts recall on the first beat again. There are also broad daily recall rules that can make many mastered beats eligible every new day, which can feel repetitive instead of planned.

### What I’ll change

1. **Replace the “always first beat” fallback**
   - When all beats are completed, choose the best beat to review based on:
     - overdue scheduled recall first,
     - oldest `last_recall_at`,
     - lowest `recall_session_number`,
     - then beat order as a final fallback.
   - This prevents Beat 1 from being selected every time.

2. **Use a real rotating recall queue**
   - Build one deduplicated queue for due recalls.
   - Sort the queue by priority instead of raw array order:
     - 10-minute recall,
     - evening recall,
     - morning recall,
     - scheduled 2/3/5/7-day recall,
     - light maintenance recall.
   - For maintenance recall after all beats are completed, limit the session to a small rotating set instead of all beats every time.

3. **Advance the schedule after any successful maintenance recall**
   - Right now scheduled recalls update `recall_session_number` and `next_scheduled_recall_at`, but the all-completed fallback can run without being treated like a scheduled recall.
   - I’ll make fallback/maintenance recalls update `last_recall_at` and the next interval too, so the beat gets pushed into the future and another beat can surface next.

4. **Make merged/full-speech recall meaningful**
   - Keep the existing merged recall concept, but make it happen when multiple beats are actually due or after the individual due recalls.
   - Avoid using merged recall as a reason to keep replaying the same first beat.

5. **Improve the user-facing session messaging**
   - Change copy so the completed state explains the actual plan, e.g. “Next review: Beat 3” or “Maintenance recall selected from the oldest beat.”
   - Keep localization safe: add fallback strings where needed and avoid raw translation keys.

### Technical details

Files I expect to update:

- `src/components/BeatPracticeView.tsx`
  - Add helper functions for recall priority, deduplication, and next-beat selection.
  - Replace the all-mastered fallback that currently chooses the first beat.
  - Ensure successful maintenance recalls write `last_recall_at`, `recall_session_number`, and `next_scheduled_recall_at`.

- `src/pages/Practice.tsx`
  - Update “Coming up” preview logic so it mirrors the smarter due/rotation rules rather than “not recalled today”.
  - Avoid previewing the same completed beat repeatedly when another beat is older or due.

- `src/i18n/locales/*.json` only if new visible copy is needed.

No database schema change should be required; the needed fields already exist on `practice_beats`.

### Expected behavior after the fix

- After all beats are completed, the app rotates through beats instead of repeatedly starting with the same one.
- If a beat is due by the 2/3/5/7-day schedule, it appears before non-due beats.
- If no beat is strictly due but the user chooses to practice anyway, the app picks the least recently recalled beat.
- Completing a recall pushes that beat forward in the memory schedule.
- The practice flow still supports quick 10-minute, evening, morning, and full-speech recall.