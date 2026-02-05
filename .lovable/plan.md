

# General Overview Practice Mode - Implementation Plan

## Overview

This feature introduces a new practice mode called **"General Overview"** that helps users learn the content and flow of their speech without word-by-word memorization. Instead of testing exact wording, this mode focuses on helping users remember the main topics, key points, and the logical structure of their speech.

---

## How It Works

### User Experience Flow

1. **Mode Selection**: When creating or practicing a speech, the user can choose between:
   - **Word-by-Word** (current default) - Memorize exact wording
   - **General Overview** (new) - Understand content and topics

2. **Initial Read-Through**: User reads the full speech once to familiarize themselves with the content

3. **Topic Practice**: 
   - AI extracts 3-6 main topics/sections from the speech
   - Each topic shows a brief headline and key talking points
   - User practices by speaking about each topic in their own words

4. **AI Evaluation**:
   - After speaking, AI checks if the user covered the main points
   - Feedback shows which topics were covered, missed, or partially addressed
   - Score based on content coverage, not exact wording

5. **Progressive Challenge**:
   - First sessions: Show topic headlines + key points
   - Later sessions: Only topic headlines
   - Mastery: Just numbered markers (Topic 1, 2, 3...)

---

## Technical Implementation

### 1. Database Changes

Add new columns and table for overview mode:

```text
Table: speeches
  + learning_mode: 'word_by_word' | 'general_overview' (existing column, add new value)

Table: overview_topics (NEW)
  - id: uuid
  - speech_id: uuid (FK to speeches)
  - topic_order: integer
  - topic_title: text (e.g., "Introduction to climate change")
  - key_points: text[] (array of 2-4 bullet points)
  - original_section: text (the actual text this topic covers)
  - is_mastered: boolean
  - practice_count: integer
  - last_coverage_score: numeric
  - created_at: timestamp

Table: overview_sessions (NEW)  
  - id: uuid
  - speech_id: uuid
  - session_date: timestamp
  - topics_covered: uuid[] (which topics were addressed)
  - topics_missed: uuid[]
  - overall_score: numeric (0-100)
  - transcription: text
  - ai_feedback: text
  - created_at: timestamp
```

### 2. New Edge Function: `extract-speech-topics`

AI-powered function to analyze a speech and extract main topics:

```text
Input: speech text
Output: 
  - topics: Array of {
      topic_order: number,
      topic_title: string,
      key_points: string[],
      original_section: string
    }

Uses Lovable AI (google/gemini-3-flash-preview) to:
1. Identify logical sections/topics in the speech
2. Generate a concise title for each topic
3. Extract 2-4 key talking points per topic
4. Map each topic back to the original text section
```

### 3. New Edge Function: `analyze-overview-session`

AI-powered function to evaluate how well the user covered the topics:

```text
Input: 
  - transcription (what user said)
  - topics (the expected topics with key points)
  - original_speech_text

Output:
  - topics_covered: which topics were addressed
  - topics_partially_covered: topics mentioned but incomplete
  - topics_missed: topics not addressed
  - coverage_score: 0-100
  - feedback: specific guidance on what was missed
  - suggestions: what to focus on next
```

### 4. New UI Components

**OverviewModeSelector** - Updated mode selection in PresentationModeSelector:
- Add fourth card for "General Overview" mode
- Description: "Learn the content and flow without memorizing exact words"
- Features: Topic-based learning, content coverage analysis, speak naturally

**OverviewPracticeView** - New practice component:
- Shows topic cards with headlines
- Progressive hint levels (full points, headlines only, numbers only)
- Recording with transcription
- Results showing coverage visualization

**OverviewTopicCard** - Individual topic display:
- Topic number and title
- Key points (collapsible based on difficulty)
- Coverage indicator (green/yellow/red after session)

**OverviewResults** - Session results view:
- Topic coverage grid (visual representation)
- Percentage score for content coverage
- AI feedback on what was missed
- Suggestions for improvement

### 5. Integration Points

**Practice.tsx modifications**:
- Detect `learning_mode === 'general_overview'`
- Render `OverviewPracticeView` instead of `BeatPracticeView`
- Load topics from `overview_topics` table

**UploadSpeechDialog modifications**:
- Add learning mode selector
- Trigger `extract-speech-topics` when overview mode selected

**Speech Card modifications**:
- Show learning mode indicator
- Different progress metrics for overview mode

---

## File Changes Summary

| File | Change Type |
|------|-------------|
| `supabase/migrations/xxx_add_overview_tables.sql` | Create |
| `supabase/functions/extract-speech-topics/index.ts` | Create |
| `supabase/functions/analyze-overview-session/index.ts` | Create |
| `src/components/OverviewPracticeView.tsx` | Create |
| `src/components/OverviewTopicCard.tsx` | Create |
| `src/components/OverviewResults.tsx` | Create |
| `src/components/PresentationModeSelector.tsx` | Modify |
| `src/components/UploadSpeechDialog.tsx` | Modify |
| `src/pages/Practice.tsx` | Modify |
| `src/i18n/locales/*.json` | Modify (all locales) |
| `src/integrations/supabase/types.ts` | Auto-generated |

---

## Alternative Design Consideration

Instead of creating a completely separate practice flow, we could also:

1. **Hybrid Approach**: Keep beats structure but show topic summaries instead of full text during recall phases. This would reuse more existing code but might feel less natural for content-focused learning.

2. **Cue Card Mode**: Display only key points as "cue cards" during practice, similar to what speakers use during presentations. This is simpler but less structured than the full topic system.

The recommended approach (above) creates a distinct experience optimized for content understanding while still tracking progress and using AI for feedback.

