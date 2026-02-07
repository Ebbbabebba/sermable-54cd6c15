

# Overview Practice Mode - Column Structure Redesign

## Summary

Redesign the General Overview practice mode to use a **column-based structure** per speech section. Instead of showing generic topic cards, each section displays three distinct columns: **Key Words**, **Key Numbers**, and **Key Phrases**. The user reads through the speech once, then explains each section freely while the AI evaluates coverage of these structured elements.

---

## How It Works

### Practice Flow

1. **Read-Through Phase** (unchanged): User reads the full speech text once
2. **Section Practice Phase** (new column layout):
   - Speech is divided into logical sections (e.g., Introduction, Argument, Conclusion)
   - Each section card shows three columns side-by-side:

   | Key Words (4-7) | Key Numbers | Key Phrases |
   |---|---|---|
   | global warming | 1.5C threshold | "tipping point" |
   | youth impact | 2030 target | "generation impact" |
   | future risk | 60% youth concern | "economic pressure" |
   | personal story | | |
   | urgency | | |

3. **Recording**: User presses "Explain this section" for each section individually
4. **AI Evaluation per section**: Checks if user:
   - Captured the main idea
   - Mentioned minimum key words
   - Included important numbers
   - Reflected the overall structure
5. **Results**: Per-section breakdown with score and specific feedback on what was missed

---

## Database Changes

### Modify `overview_topics` table

Add three new columns to store the structured extraction data:

```text
ALTER TABLE overview_topics ADD COLUMN key_words text[] DEFAULT '{}';
ALTER TABLE overview_topics ADD COLUMN key_numbers text[] DEFAULT '{}';
ALTER TABLE overview_topics ADD COLUMN key_phrases text[] DEFAULT '{}';
```

The existing `key_points` column will be kept for backward compatibility but the new columns will be used for the column display.

### Modify `overview_sessions` table

Add a `section_scores` JSONB column to store per-section results:

```text
ALTER TABLE overview_sessions ADD COLUMN section_scores jsonb DEFAULT '[]';
```

This stores an array like:
```json
[
  {
    "topic_id": "uuid",
    "score": 76,
    "main_idea_captured": true,
    "key_words_mentioned": ["global warming", "urgency"],
    "key_words_missed": ["personal story"],
    "numbers_mentioned": ["1.5C"],
    "numbers_missed": ["2030 target"],
    "phrases_mentioned": [],
    "phrases_missed": ["tipping point"]
  }
]
```

---

## Edge Function Changes

### Update `extract-speech-topics`

Change the AI prompt to extract three structured categories per section instead of generic key points:

- **key_words**: 4-7 short support words representing core content
- **key_numbers**: Important statistics, dates, and factual anchors
- **key_phrases**: Short central expressions (never full sentences), in quotes

The function will save these into the new columns on `overview_topics`.

### Update `analyze-overview-session`

Change to evaluate **per section**, one at a time. The function receives:
- The current section's key_words, key_numbers, key_phrases
- The user's transcription for that section

It returns a per-section score with detailed breakdown of which keywords, numbers, and phrases were mentioned or missed.

---

## UI Component Changes

### Rewrite `OverviewTopicCard`

Transform from a simple topic card to a **three-column layout**:

- Left column: Key Words (displayed as colored chips/tags)
- Center column: Key Numbers (displayed with a number icon prefix)
- Right column: Key Phrases (displayed in quotes, italic)

On mobile, columns stack vertically.

Each section card includes a "Explain this section" mic button at the bottom.

### Rewrite `OverviewPracticeView`

Change the practice flow:

1. **Read-Through Phase**: Same as current (show full speech text)
2. **Section-by-Section Practice**: Instead of recording everything at once:
   - Show one section at a time with its three columns
   - User taps "Explain this section" to record
   - After recording, show immediate per-section feedback
   - User moves to next section
3. **Final Results**: Show overall summary with all section scores

### Rewrite `OverviewResults`

Update to show per-section detailed feedback:
- Per section: score percentage with breakdown
- Checkmarks/warnings for: structure, main idea, keywords, numbers, phrases
- Example format:

```text
Section 1: Introduction - 76%
  [check] Structure clear
  [check] Main idea captured
  [warn] Missed numbers: 2030 target
  [warn] Missing concept: tipping point
```

---

## Progressive Difficulty (kept from current design)

- **Level 1 (Full hints)**: Show all three columns with content
- **Level 2 (Titles only)**: Show section title + column headers but hide the actual words/numbers/phrases
- **Level 3 (Numbers only)**: Show just "Section 1", "Section 2" etc.

---

## File Changes Summary

| File | Change |
|------|--------|
| Database migration | Add `key_words`, `key_numbers`, `key_phrases` to `overview_topics`; add `section_scores` to `overview_sessions` |
| `supabase/functions/extract-speech-topics/index.ts` | Update AI prompt to extract structured columns |
| `supabase/functions/analyze-overview-session/index.ts` | Rewrite to evaluate per-section with keyword/number/phrase matching |
| `src/components/OverviewTopicCard.tsx` | Rewrite to three-column layout with chips |
| `src/components/OverviewPracticeView.tsx` | Rewrite to section-by-section recording flow |
| `src/components/OverviewResults.tsx` | Rewrite to show per-section detailed feedback |
| `src/i18n/locales/en.json` | Add new translation keys |
| `src/i18n/locales/sv.json` | Add new translation keys |

