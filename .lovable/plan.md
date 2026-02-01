
# Presentation Mode Development Plan

## Overview

This plan expands Presentation Mode with **enhanced post-session analysis**, **new presentation modes**, **rich analytics**, and a **premium Audience Mode** with animated avatars that react to your performance.

---

## Part 1: Enhanced Database Schema ✅ COMPLETED

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

## Part 2: Presentation Modes

### 2.1 Strict Mode (existing)
- Word-by-word matching
- Progressive keyword hints when stuck
- Detailed performance tracking

### 2.2 Full Script Mode (existing)
- Full text visible
- Words fade as spoken
- Focus on fluency

### 2.3 🆕 Audience Mode (PREMIUM)
**The Centerpiece Feature - Speak in front of animated avatars!**

**Experience:**
- 2-4 cartoon audience members appear in a FaceTime/video call style grid
- Avatars react in real-time:
  - **Nodding** when you're speaking smoothly
  - **Smiling** when pace is good
  - **Looking confused/concerned** when you hesitate
  - **Clapping/celebrating** at the end
- No script visible - true presentation simulation
- Full speech with no beat breaks - continuous flow

**Flow:**
1. Goes through ALL beats as one continuous speech
2. No pauses between beats - pure presentation mode
3. **Interleaved weak spots**: Every 3-4 beats, if issues detected, pause with "Time for weak spots! 💪" 
4. Drill the problematic words/phrases
5. Resume the presentation from where you left off

**Premium Value:**
- Free users: Standard strict/fullscript modes
- Premium users: Unlock Audience Mode with animated reactions

### 2.4 Freestyle Mode
- Shows topic/section headers only
- User speaks in their own words
- Tracks cue word coverage
- No word-by-word matching

### 2.5 Timed Challenge Mode
- Countdown timer based on target duration
- Pacing indicator (ahead/behind schedule)
- Urgency visual cues

---

## Part 3: Audience Mode Technical Design

### 3.1 Avatar System

**Avatar Components:**
```
src/components/audience/
├── AudienceGrid.tsx          # 2x2 grid of audience members
├── AvatarCharacter.tsx       # Individual animated avatar
├── AvatarReactions.tsx       # Reaction state machine
└── WeakSpotInterlude.tsx     # "Time for weak spots!" UI
```

**Avatar States:**
| State | Trigger | Animation |
|-------|---------|-----------|
| neutral | Default | Slight idle movement, blinking |
| listening | User speaking smoothly | Gentle nodding, engaged expression |
| impressed | >85% accuracy last 10 words | Wider smile, enthusiastic nod |
| confused | Hesitation detected | Slight head tilt, furrowed brow |
| concerned | Missed word | Brief worried expression |
| celebrating | Session complete | Clapping, big smiles |

**Performance Tracking:**
- Rolling 10-word accuracy window
- Hesitation detection (>2s pause)
- Track which beats had issues for weak spot interlude

### 3.2 Weak Spot Interlude

**Trigger:** After every 3-4 beats, if accuracy drops below 80% OR 2+ hesitations in that section

**UI:**
```
┌─────────────────────────────────────────────┐
│                                             │
│     ⏸️ Time for Weak Spots! 💪              │
│                                             │
│     Let's practice these tricky parts:      │
│                                             │
│     "Nevertheless, the infrastructure..."   │
│     "...commitment to excellence..."        │
│                                             │
│     [Practice These]  [Skip & Continue]     │
│                                             │
└─────────────────────────────────────────────┘
```

**Behavior:**
- Shows 2-3 problematic phrases
- Quick drill (3x each phrase)
- Return to full presentation where you left off

---

## Part 4: Enhanced Post-Session Analysis UI

### 4.1 Fluency Timeline Chart
Visual graph showing the entire presentation:
- X-axis: Word position (or time)
- Y-axis: Time-to-speak or status
- Color coding: Green (smooth), Yellow (hesitation), Red (missed)
- Hover to see exact word and timing

### 4.2 Word-Level Mastery Panel
- List of words sorted by struggle frequency
- Track mastery across multiple sessions
- Show improvement trends
- Drill button to practice specific weak words

### 4.3 Comparison Metrics
- Side-by-side with previous session
- Trend charts: accuracy over time
- Personal bests
- Improvement percentage

### 4.4 AI Coaching Tips
- Personalized feedback based on patterns
- Specific word/phrase recommendations
- Practice strategy suggestions

---

## Part 5: Technical Implementation

### 5.1 Files to Create

**Audience Mode Components:**
```
src/components/audience/
├── AudienceGrid.tsx          # 2x2 avatar grid layout
├── AvatarCharacter.tsx       # Single avatar with animations
├── AudienceModeView.tsx      # Main audience mode orchestrator
├── WeakSpotInterlude.tsx     # Weak spot drill UI
└── AudienceReactionEngine.ts # Logic for triggering reactions
```

**Analysis Components:**
```
src/components/analysis/
├── FluencyTimeline.tsx       # Interactive timeline chart
├── WordMasteryPanel.tsx      # Word-level tracking display
├── SessionComparison.tsx     # Compare with previous sessions
├── AICoachingCard.tsx        # AI-generated tips
└── EnhancedSummary.tsx       # New summary page orchestrator
```

**Hooks:**
```
src/hooks/
├── useWordMastery.ts          # Track word performance over time
├── useSessionHistory.ts       # Fetch and compare past sessions
├── useAudienceReactions.ts    # Manage avatar reaction states
└── useWeakSpotDetection.ts    # Detect when to trigger weak spot drill
```

### 5.2 Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Presentation.tsx` | Add Audience Mode flow |
| `src/components/PresentationModeSelector.tsx` | Add Audience Mode option (premium) |
| `src/components/PresentationSummary.tsx` | Integrate enhanced analytics |
| `supabase/functions/analyze-presentation/index.ts` | ✅ Already updated |

### 5.3 Edge Functions ✅ COMPLETED

**analyze-presentation** enhancements:
- ✅ Calculate pace consistency score
- ✅ Identify fluency patterns
- ✅ Generate personalized AI coaching tips
- ✅ Return detailed fluency timeline
- ✅ Save to presentation_word_performance

**get-word-mastery** function:
- ✅ Aggregate word performance across sessions
- ✅ Calculate mastery levels per word
- ✅ Identify consistently weak words
- ✅ Return improvement trends

---

## Part 6: Implementation Order

### Phase 1: Database & Analytics Foundation ✅ COMPLETED
1. ✅ Add new columns to `presentation_sessions`
2. ✅ Create `presentation_word_performance` table
3. ✅ Update `analyze-presentation` to save detailed data
4. ✅ Create `get-word-mastery` edge function

### Phase 2: Audience Mode (Premium Feature)
1. Create AvatarCharacter with CSS/Framer animations
2. Build AudienceGrid layout (2x2 FaceTime style)
3. Implement AudienceReactionEngine (state machine)
4. Build WeakSpotInterlude component
5. Create AudienceModeView orchestrator
6. Add to mode selector with premium gate

### Phase 3: Enhanced Summary UI
1. Build FluencyTimeline chart (Recharts)
2. Build WordMasteryPanel component
3. Build SessionComparison component
4. Build AICoachingCard component
5. Create EnhancedSummary to combine all

### Phase 4: Integration & Polish
1. Connect all new components
2. Add loading states and animations
3. Mobile-responsive design
4. Test all flows end-to-end

---

## Part 7: Avatar Design

### Visual Style
- **Aesthetic**: Friendly, approachable cartoon characters (like Duolingo or Headspace)
- **Diversity**: Different ages, genders, ethnicities
- **Size**: Head + shoulders visible in grid cell
- **Animations**: CSS/Framer Motion based (no 3D/canvas for performance)

### Avatar Expressions
```
Neutral:    😐 Slight smile, eyes forward
Listening:  🙂 Gentle nod, engaged eyes
Impressed:  😊 Bigger smile, enthusiastic nod
Confused:   😕 Slight head tilt, raised eyebrow
Concerned:  😟 Brief worried look
Celebrating: 🥳 Clapping hands, big smile
```

### Sample Avatar Grid
```
┌──────────────────┬──────────────────┐
│                  │                  │
│   👩‍💼 Sarah        │   👨‍💻 Alex         │
│   (nodding)      │   (smiling)      │
│                  │                  │
├──────────────────┼──────────────────┤
│                  │                  │
│   👴 Marcus       │   👩‍🎓 Emma         │
│   (impressed)    │   (listening)    │
│                  │                  │
└──────────────────┴──────────────────┘
```

---

## Technical Notes

- Use **Recharts** (already installed) for timeline visualization
- Use **Framer Motion** (already installed) for avatar animations
- Store fluency timeline as JSONB for flexibility
- AI coaching uses existing Lovable AI integration
- Avatar reactions use a state machine with debounced transitions
- Weak spot detection tracks rolling accuracy over last 3-4 beats
