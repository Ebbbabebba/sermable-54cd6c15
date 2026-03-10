

# Remove Old General/Overview Mode & Improve Script Mode

## What's changing

### 1. Remove the old "General Overview" learning mode entirely
The old overview system (topic extraction, `overview_topics` table, `OverviewPracticeView`) will be removed. Script Mode replaces it everywhere.

**Files to edit:**
- `src/components/LearningModeSelector.tsx` — Remove the `general_overview` option. Since only `word_by_word` remains, either keep just one option or remove the selector entirely and default to `word_by_word`.
- `src/components/UploadSpeechDialog.tsx` — Remove the `general_overview` branch that calls `extract-speech-topics`. All speeches use `word_by_word` + segmentation.
- `src/pages/Practice.tsx` — Remove the `general_overview` routing block (lines ~1825-1836) that renders `OverviewPracticeView`. Remove `handleSwitchLearningMode`. Remove import of `OverviewPracticeView`.
- `src/components/PresentationModeSelector.tsx` — The "General/Overview" card (3rd card) should be renamed to "Script Mode" with updated description reflecting the beat + reference word flow. Keep the 3-column grid with Strict, Full Script, Script.

### 2. Improve Script Mode UX

**Current issues & improvements:**

- **No progress persistence** — Beats are re-extracted every time. Store extracted beats in the database so users resume where they left off.
- **No session history** — Results aren't saved. Track scores per beat over time to show mastery.
- **Missing "show original" after results** — After seeing the score, let users tap to reveal the original text side-by-side with what they said.
- **No transcript shown** — Show the user's actual transcription in the results so they can see what was heard vs the original.
- **Aggregate/disaggregate UX is unclear** — Add labels and tooltips explaining what these buttons do. Show the beat range visually.
- **No overall session summary** — When all beats are done, show a summary screen with scores per beat, overall score, and time spent instead of just navigating back.

**Files to edit:**
- `src/components/ScriptPracticeView.tsx`:
  - Show transcript in results phase alongside original text
  - Add "Show original" toggle in results
  - Build a completion summary screen when all beats are done
  - Better labels for aggregate/disaggregate buttons
  
**Database migration:**
- Create `script_beats` table to cache extracted beats per speech
- Create `script_sessions` table to store per-beat results over time

```text
script_beats:
  id uuid PK
  speech_id uuid FK -> speeches.id
  beat_index int
  text text
  reference_word text
  created_at timestamp

script_sessions:
  id uuid PK
  speech_id uuid FK -> speeches.id  
  user_id uuid
  beat_start int
  beat_end int
  score int
  content_coverage int
  order_accuracy int
  transcript text
  created_at timestamp
```

### 3. Files to delete (cleanup)
- `src/components/OverviewPracticeView.tsx` — No longer used
- `src/components/OverviewTopicCard.tsx` — No longer used  
- `src/components/OverviewResults.tsx` — No longer used

### Summary of all changes

| Area | Action |
|------|--------|
| `LearningModeSelector.tsx` | Remove `general_overview` option |
| `UploadSpeechDialog.tsx` | Remove overview topic extraction branch |
| `Practice.tsx` | Remove overview routing + switch mode logic |
| `PresentationModeSelector.tsx` | Rename 3rd card to "Script Mode" |
| `ScriptPracticeView.tsx` | Add transcript display, completion summary, beat caching, clearer aggregate UX |
| DB migration | Create `script_beats` + `script_sessions` tables |
| Cleanup | Delete `OverviewPracticeView`, `OverviewTopicCard`, `OverviewResults` |

