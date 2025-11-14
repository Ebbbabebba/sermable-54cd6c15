# Fully Automated Training Workflow

## Zero Manual Decisions Required

After each practice attempt, the system automatically processes everything with **NO user input needed**:

## Automatic Processing Steps

### 1. 🔍 Word Detection (Automatic)
**What it does:** Analyzes your spoken input vs the target text
- Counts correctly remembered words
- Identifies missed words
- Detects delayed words (hesitations)
- Calculates raw accuracy percentage

**Location:** `supabase/functions/analyze-speech/index.ts`

### 2. 📊 Script Support Detection (Automatic)
**What it does:** Measures how much you relied on visible notes
- Tracks current `base_word_visibility_percent` (0-100%)
- Records what percentage of words were visible during practice
- Passes this data to the weighting system

**Location:** Practice page tracks visibility, sent to `update-adaptive-learning`

### 3. ⚖️ Script-Weighted Performance (Automatic)
**What it does:** Applies weighting factor to prevent false confidence

| Visibility % | Weight | Example Transform |
|-------------|--------|-------------------|
| 90% visible | 20% | 95% → 19% weighted |
| 70% visible | 50% | 90% → 45% weighted |
| 50% visible | 70% | 85% → 60% weighted |
| 30% visible | 85% | 80% → 68% weighted |
| 10% visible | 100% | 80% → 80% weighted |

**Location:** `update-adaptive-learning/index.ts` lines 47-76

### 4. 📅 Schedule Update (Automatic)
**What it does:** Updates spaced-repetition schedule using:
- Weighted accuracy (not raw accuracy)
- Days until deadline
- Performance trend
- Consecutive struggles

**Location:** `update-adaptive-learning/index.ts` + database schedules table

### 5. 🤖 Automatic Determinations

#### A. Next Practice Session Timing (Automatic)
**Rules Applied:**
- **Rule 1:** Weighted ≥70% + visibility ≤30% → 2-4 days interval
- **Rule 2:** Raw ≥80% + visibility ≥70% → 4-8 hours (not truly memorizing)
- **Rule 3:** Weighted <50% → 2-6 hours (need more practice)
- **Deadline Override:** ≤2 days = max 4hrs, ≤7 days = max 12hrs

**Output:** `next_review_date` stored in database, no user choice

#### B. Next Text Segment Length (Automatic)
**Rules Applied:**

| Condition | Action | New Length |
|-----------|--------|------------|
| Deadline ≤3 days | Force full speech | 100% |
| Deadline ≤7 days | Force at least | 80% minimum |
| Weighted ≥75% + no struggles | Increase segment | +20% |
| Weighted ≥60% | Increase segment | +10% |
| Weighted <40% | Decrease segment | -20% |
| Weighted <50% | Decrease segment | -10% |
| Otherwise | Keep current | No change |

**Bounds:** Minimum 20%, Maximum 100%
**Function:** `calculate_segment_length()` in database
**Storage:** `current_segment_length` in speeches table

#### C. Next Script Support Level (Automatic)
**Rules Applied:**

**7+ Days Before Deadline:**
- Weighted ≥80% → 20-40% visibility (reducing notes)
- Weighted 60-79% → 40-60% visibility
- Weighted <60% → 60-100% visibility (more support needed)

**3-7 Days Before Deadline:**
- Weighted ≥70% → 10% visibility
- Weighted ≥50% → 20% visibility
- Weighted <50% → 30% visibility (max allowed)

**<3 Days Before Deadline:**
- Base 10% visibility
- Max 20% if struggling badly (3+ consecutive failures)
- **NO EXCEPTIONS** - forced memorization mode

**Function:** `calculate_word_visibility()` in database
**Storage:** `base_word_visibility_percent` in speeches table

### 6. 📈 Automatic Difficulty Increase (High Performance)
**Triggers automatically when:**
- Weighted accuracy ≥70% AND
- Visibility ≤30% AND
- No consecutive struggles

**Automatic Actions:**
1. ✅ Increase interval to 2-4 days
2. ✅ Increase segment length by 10-20%
3. ✅ Decrease word visibility by 10-15%
4. ✅ Update performance trend to positive

**User sees:** Toast notification explaining the changes
**User does:** Nothing - all automatic

### 7. 📉 Automatic Difficulty Reduction (Low Performance)
**Triggers automatically when:**
- Weighted accuracy <50% OR
- Consecutive struggles ≥2

**Automatic Actions:**
1. ✅ Decrease interval to 2-6 hours
2. ✅ Decrease segment length by 10-20%
3. ✅ Increase word visibility by 10-30%
4. ✅ Track struggle count

**User sees:** Toast notification explaining the adjustments
**User does:** Nothing - all automatic

### 8. 🎯 Automatic Deadline Adjustments
**System monitors:** `days_until_deadline` every session

**Automatic Overrides:**

**14+ Days Out:**
- Normal adaptive rules apply
- Focus on understanding and gradual memorization

**7-14 Days Out:**
- Segments ≥60% of speech
- Maximum 12-hour intervals
- Visibility reducing based on performance

**3-7 Days Out:**
- Segments ≥80% of speech  
- Maximum 12-hour intervals
- Visibility capped at 10-30% (minimal notes)

**<3 Days Out:**
- FULL SPEECH ONLY (100% segment)
- Maximum 4-hour intervals
- Visibility 5-20% MAX (effectively no notes)
- Performance-based adjustments DISABLED
- Pure memorization mode activated

**User input:** None required
**User notification:** Toast shows deadline status

### 9. 🏁 Final State Guarantee

**At Deadline Day (D-Day):**

**Automatically Enforced:**
- ✅ Segment length: 100% (full speech only)
- ✅ Word visibility: 5-10% (essentially zero notes)
- ✅ Practice intervals: Every 1-4 hours
- ✅ No exceptions for poor performance

**Goal Achievement:**
The system GUARANTEES you'll practice the full speech with effectively zero notes by deadline day, regardless of your current performance level.

## Complete Automation Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User completes practice session                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Analyze transcription (analyze-speech edge function)    │
│     → Detect words, calculate accuracy                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Calculate weighted accuracy                             │
│     → Apply script visibility weight                        │
│     → 90% vis + 95% acc = 19% weighted                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Update adaptive learning (update-adaptive-learning)     │
│     → Call calculate_word_visibility(weighted_acc)          │
│     → Call calculate_segment_length(weighted_acc)           │
│     → Call calculate_practice_frequency(all_metrics)        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Apply adaptation rules automatically                    │
│     → Determine next interval (2hrs to 4days)              │
│     → Determine next segment (20% to 100%)                 │
│     → Determine next visibility (5% to 100%)               │
│     → Override with deadline constraints                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Store all decisions in database                         │
│     speeches: visibility, segment, trends, struggles        │
│     schedules: next_review_date, interval, frequency        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Show user comprehensive notification                    │
│     → What changed and why                                  │
│     → When to practice next                                 │
│     → What to expect next session                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  User waits until next_review_date                          │
│  (Speech is LOCKED until then for free users)               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  System unlocks speech automatically                        │
│  User practices with NEW settings (automatic)               │
└─────────────────────────────────────────────────────────────┘
```

## No User Decisions Required

The user ONLY needs to:
1. ✅ Upload the speech with a deadline
2. ✅ Practice when the system unlocks it
3. ✅ Speak during practice sessions

Everything else is **100% AUTOMATIC**:
- ❌ No choosing difficulty
- ❌ No manual scheduling
- ❌ No deciding visibility
- ❌ No segment selection
- ❌ No interval adjustment

The system is your AI coach making all training decisions based on science and your performance data.
