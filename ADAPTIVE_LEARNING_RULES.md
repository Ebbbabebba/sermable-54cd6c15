# Adaptive Learning System Rules

## Overview
The system uses scientifically-based spaced repetition with weighted performance scoring to optimize speech memorization while respecting deadline constraints.

## Core Principle: Weighted Accuracy
Performance scores are adjusted based on script visibility to prevent artificially high scores when reading from notes:

| Script Visibility | Performance Weight | Example |
|------------------|-------------------|---------|
| 80-100% (Full script) | 20% | 95% accuracy → 19% weighted |
| 60-79% (Heavy notes) | 50% | 90% accuracy → 45% weighted |
| 40-59% (Moderate notes) | 70% | 85% accuracy → 60% weighted |
| 20-39% (Light notes) | 85% | 80% accuracy → 68% weighted |
| 0-19% (Minimal/no notes) | 100% | 80% accuracy → 80% weighted |

## Adaptation Rules

### 1. High Score with Minimal Notes
**Condition:** Weighted accuracy ≥70% AND visibility ≤30%
**Action:** 
- ✅ **INCREASE** practice interval (2-4 days)
- ✅ True memorization achieved
- ✅ Reward with longer rest periods

### 2. High Score with Full Script
**Condition:** Raw accuracy ≥80% AND visibility ≥70%
**Action:**
- ⚠️ **KEEP SHORT** interval (4-8 hours)
- ⚠️ Just reading well, not memorizing
- ⚠️ Force more practice to test real memorization

### 3. Low Weighted Score
**Condition:** Weighted accuracy <50%
**Action:**
- 🔄 **SHORTEN** interval (2-6 hours)
- 🔄 More frequent practice needed
- 🔄 May increase script visibility if struggling

### 4. Moderate Performance
**Condition:** Between above thresholds
**Action:**
- 📊 Standard spaced repetition intervals
- 📊 Frequency adjusted by multiplier
- 📊 Progressive difficulty increase

## Deadline-Based Note Restrictions

### 7+ Days Before Deadline
- **Notes:** Fully allowed (up to 100% visibility)
- **Strategy:** Progressive learning, focus on understanding
- **Visibility:** Reduces based on weighted performance

### 3-7 Days Before Deadline
- **Notes:** MINIMAL (10-40% visibility max)
- **Strategy:** Transition to memorization mode
- **Visibility:** 
  - 10% if weighted accuracy ≥70%
  - 20% if weighted accuracy ≥50%
  - 30% if struggling

### <3 Days Before Deadline
- **Notes:** NO NOTES (5-25% visibility max)
- **Strategy:** Final memorization sprint
- **Visibility:** 
  - 5-10% for good performance
  - Up to 25% only if severely struggling (3+ consecutive failures)

## Interval Caps by Deadline Urgency

| Days Until Deadline | Maximum Interval |
|---------------------|------------------|
| ≤2 days | 4 hours |
| 3-7 days | 12 hours |
| 8-14 days | 2 days |
| 15+ days | 4 days |

## Performance Tracking

### Consecutive Struggles
- Tracks sessions with weighted accuracy <50%
- Increases script visibility by +10% per struggle (max +30%)
- Resets when weighted accuracy ≥60%

### Performance Trend
- Normalized change from last session (-1 to +1)
- Affects word visibility calculation (±10%)
- Helps identify improving vs declining performance

## Example Scenarios

### Scenario A: False Confidence
- Raw accuracy: 95%
- Script visibility: 90%
- **Result:** 19% weighted accuracy
- **Action:** Keep short 6-hour interval, reduce visibility to 70%
- **Message:** "High accuracy but still reading from script. Time to reduce visibility."

### Scenario B: True Mastery
- Raw accuracy: 85%
- Script visibility: 15%
- **Result:** 85% weighted accuracy
- **Action:** Increase interval to 3 days
- **Message:** "Excellent! You're truly memorizing without script reliance."

### Scenario C: Struggling Learner
- Raw accuracy: 65%
- Script visibility: 80%
- **Result:** 13% weighted accuracy
- **Action:** Shorten to 3-hour interval, maintain high visibility
- **Message:** "Start by memorizing key phrases, then gradually reduce visibility."

### Scenario D: Deadline Pressure
- Days until deadline: 2
- Raw accuracy: 90%
- Script visibility: 60%
- **Result:** 54% weighted, but forced to 10% visibility
- **Action:** Max 4-hour interval, 10% visibility regardless of performance
- **Message:** "Presentation is in 2 days! Practice without notes."

## Success Metrics

The system considers you "ready" when:
- Weighted accuracy consistently ≥80%
- Script visibility ≤20%
- No consecutive struggles
- Within 7 days of deadline

The goal is complete memorization (0% notes) by presentation day while maintaining optimal learning efficiency through scientifically-backed spaced repetition principles.
