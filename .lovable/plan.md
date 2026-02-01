
# Presentation Mode Development Plan

## Overview

This plan expands Presentation Mode with **enhanced post-session analysis**, **new presentation modes**, and **rich analytics** including fluency timelines, word-level mastery tracking, comparison metrics, and AI coaching tips.

---

## Part 1: Enhanced Database Schema

### New Tables

**1. `presentation_word_performance`** - Tracks per-word performance across sessions
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| session_id | uuid | FK to presentation_sessions |
| speech_id | uuid | FK to speeches |
| word | text | The word |
| word_index | integer | Position in speech |
| status | text | correct/hesitated/missed/skipped |
| time_to_speak_ms | integer | Milliseconds to say word |
| was_prompted | boolean | Did user need a hint? |
| wrong_attempts | text[] | What user said instead |
| created_at | timestamptz | When recorded |

**2. `presentation_sessions` updates** - Add columns for richer analytics
| New Column | Type | Description |
|------------|------|-------------|
| mode | text | strict/fullscript/freestyle/timed |
| fluency_timeline | jsonb | Array of {timestamp, wordIndex, status} |
| avg_time_per_word_ms | integer | Average speaking pace |
| longest_pause_ms | integer | Longest hesitation |
| pace_consistency | numeric | 0-100 score for even pacing |
| word_performance_json | jsonb | Full word-by-word data |

---

## Part 2: New Presentation Modes

### 2.1 Freestyle Mode (speak freely about topics)
- Shows topic/section headers only
- User speaks in their own words
- Tracks cue word coverage
- No word-by-word matching
- Scores based on content coverage and confidence

### 2.2 Timed Challenge Mode
- Countdown timer based on target duration
- Pacing indicator (ahead/behind schedule)
- Urgency visual cues as time runs out
- Bonus points for finishing on time
- Practice hitting specific time targets

### 2.3 Section Practice Mode
- Practice specific sections/paragraphs
- Focus on weak spots identified from analytics
- Loop a section until mastered
- Drill-down from full speech to problem areas

---

## Part 3: Enhanced Post-Session Analysis UI

### 3.1 Fluency Timeline Chart
Visual graph showing the entire presentation:
- X-axis: Word position (or time)
- Y-axis: Time-to-speak or status
- Color coding: Green (smooth), Yellow (hesitation), Red (missed)
- Hover to see exact word and timing
- Identify patterns (e.g., "struggles at paragraph transitions")

### 3.2 Word-Level Mastery Panel
- List of words sorted by struggle frequency
- Track mastery across multiple sessions
- Show improvement: "This word was missed 5 times last week, only 1 time now"
- Highlight anchor words that consistently cause problems
- Drill button to practice specific weak words

### 3.3 Comparison Metrics
- Side-by-side with previous session
- Trend charts: accuracy over time, pace over time
- Personal bests: "New record! 92% accuracy"
- Improvement percentage: "+12% from last session"
- Session history list with key metrics

### 3.4 AI Coaching Tips
- Personalized feedback based on patterns
- Specific word/phrase recommendations
- Practice strategy suggestions
- Encouraging messages based on progress
- Actionable next steps

---

## Part 4: Technical Implementation

### 4.1 Files to Create

**New Components:**
```
src/components/analysis/
├── FluentcyTimeline.tsx       # Interactive timeline chart
├── WordMasteryPanel.tsx       # Word-level tracking display
├── SessionComparison.tsx      # Compare with previous sessions
├── AICoachingCard.tsx         # AI-generated tips
├── EnhancedSummary.tsx        # New summary page orchestrator
└── PresentationStats.tsx      # Reusable stats display
```

**New Mode Components:**
```
src/components/presentation/
├── FreestyleView.tsx          # Freestyle mode UI
├── TimedChallengeView.tsx     # Timed challenge mode UI
└── SectionPracticeView.tsx    # Section-by-section practice
```

**New Hooks:**
```
src/hooks/
├── useWordMastery.ts          # Track word performance over time
├── useSessionHistory.ts       # Fetch and compare past sessions
└── usePresentationAnalytics.ts # Aggregate analytics
```

### 4.2 Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Presentation.tsx` | Add new modes to flow, pass data to enhanced summary |
| `src/components/PresentationModeSelector.tsx` | Add Freestyle, Timed, Section options |
| `src/components/PresentationSummary.tsx` | Replace with EnhancedSummary or extend |
| `src/components/StrictPresentationView.tsx` | Emit fluency timeline data |
| `supabase/functions/analyze-presentation/index.ts` | Generate richer analysis, AI tips |

### 4.3 Edge Function Updates

**analyze-presentation** enhancements:
- Calculate pace consistency score
- Identify fluency patterns
- Compare with previous sessions
- Generate personalized AI coaching tips
- Return detailed fluency timeline

**New: get-word-mastery** function:
- Aggregate word performance across sessions
- Calculate mastery levels per word
- Identify consistently weak words
- Return improvement trends

---

## Part 5: Implementation Order

### Phase 1: Database & Analytics Foundation
1. Add new columns to `presentation_sessions`
2. Create `presentation_word_performance` table
3. Update `analyze-presentation` to save detailed data
4. Create `get-word-mastery` edge function

### Phase 2: Enhanced Summary UI
1. Build `FluentcyTimeline` chart component (using Recharts)
2. Build `WordMasteryPanel` component
3. Build `SessionComparison` component
4. Build `AICoachingCard` component
5. Create `EnhancedSummary` to combine all

### Phase 3: New Presentation Modes
1. Build `FreestyleView` (topic-based speaking)
2. Build `TimedChallengeView` (countdown + pacing)
3. Build `SectionPracticeView` (loop sections)
4. Update mode selector with new options

### Phase 4: Integration & Polish
1. Connect all new components
2. Add loading states and animations
3. Mobile-responsive design
4. Test all flows end-to-end

---

## Part 6: UI/UX Details

### Fluency Timeline Preview
```text
┌─────────────────────────────────────────────────┐
│  Fluency Timeline                               │
│  ▄▄▄▃▃▃▄▄▅▅▃▃▃▄▄▄█▁▁▃▃▃▄▄▄▄▃▃▃▃▄▄▄▄▃▃▃        │
│  ───────────────────────────────────────────    │
│  ↑ smooth   ↑ slight pause    ↑ struggle        │
│                                                 │
│  Hover: "commitment" - 1.2s (hesitated)         │
└─────────────────────────────────────────────────┘
```

### Word Mastery Panel Preview
```text
┌─────────────────────────────────────────────────┐
│  Words to Practice                              │
│                                                 │
│  ⚠️ "nevertheless"    missed 4x this week      │
│  ⚠️ "infrastructure"  hesitated 3x             │
│  ✅ "commitment"       improving! (2→0 misses) │
│                                                 │
│  [Practice Weak Words]                          │
└─────────────────────────────────────────────────┘
```

### Comparison Widget Preview
```text
┌─────────────────────────────────────────────────┐
│  vs. Last Session                               │
│                                                 │
│  Accuracy:    78% → 85%     ↑ +7%              │
│  Hesitations: 12 → 8        ↓ -4               │
│  Pace:        2.1s → 1.8s   ↑ Faster           │
│                                                 │
│  🏆 Personal Best: 92% (3 days ago)            │
└─────────────────────────────────────────────────┘
```

---

## Technical Notes

- Use **Recharts** (already installed) for timeline visualization
- Store fluency timeline as JSONB for flexibility
- AI coaching uses existing Lovable AI integration
- Word mastery tracks across all presentation sessions, not just current speech
- Session comparison fetches last 5-10 sessions for trends

