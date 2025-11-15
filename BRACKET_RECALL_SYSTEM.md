# Bracket-Based Recall System

## Overview
The bracket system tracks mastered words (removed from the manuscript) separately from visible words, allowing users to practice pure recall from memory.

## How It Works

### Step 1: Bracket Display
- Words that have been mastered and removed are shown in brackets: `[ hi my name is Ebba ]`
- The bracket indicates these words must be recalled from memory
- All words inside the bracket start in a neutral gray state

### Step 2: Active Listening
- The app listens as you begin recalling the bracketed words
- Real-time speech recognition tracks which words you say

### Step 3: Correct Words
- When you say a word correctly, it turns **green** inside the bracket
- Correctly spoken words remain green throughout the session
- Example: After saying "hi my name", those words appear green while "is Ebba" remains gray

### Step 4: Incorrect Words
- Words spoken incorrectly turn **red**
- They fade out after 2 seconds
- The bracket remains in place
- Other words are unaffected
- You can retry the word immediately

### Step 5: Hesitations
- If you pause too long on a word (2s for regular words, 4s for first word), it turns **yellow**
- The word fades out after 2 seconds
- The bracket remains in place
- Other words are unaffected
- You can retry the word

### Step 6: Persistence
- Correctly spoken words stay green throughout the entire session
- Only incorrect or hesitated words need to be retried
- You can work through the bracket at your own pace

### Step 7: Bracket Completion
When all words in a bracket are correctly recalled:
1. The bracket collapses from `[ hi my name is Ebba ]` to `[ ]`
2. The empty bracket turns green
3. A click sound plays
4. The bracket completely disappears from the manuscript
5. This indicates the segment is fully mastered

### Step 8: Repeated Failures
- Brackets persist even with multiple errors
- Each error/hesitation is tracked per segment
- The system tracks how difficult each segment is
- Segments with many errors will affect your overall session accuracy

### Step 9: Spaced Repetition Integration
After practice, the adaptive learning system adjusts based on bracket performance:

**Correct Recall (high accuracy, few errors)**
- Longer interval until next practice
- Reduced script visibility (more words hidden in brackets)
- Larger segment length (more of the speech at once)

**Errors (low accuracy, many errors/hesitations)**
- Shorter interval (practice sooner)
- Increased script visibility (fewer words hidden)
- Smaller segment length (focus on manageable chunks)

**Deadline Proximity**
- <3 days: Force full speech with minimal visibility (max 10-20%)
- 3-7 days: At least 80% of speech, minimal notes (10-30% visibility)
- 7+ days: Progressive note reduction based on performance

## Performance Tracking

### Segment-Level Tracking
- Each bracket segment tracks its own errors and hesitations
- Segments with more difficulty are noted
- Overall session accuracy reflects all segment performances

### Weighted Accuracy
Performance is weighted by script visibility:
- 80-100% visible: 20% weight (mostly reading)
- 60-79% visible: 50% weight
- 40-59% visible: 70% weight
- 20-39% visible: 85% weight
- 0-19% visible: 100% weight (pure memory)

### Adaptation Rules

**High weighted score (≥70%) with low visibility (≤30%)**
→ Increase interval (2-4 days)

**High raw score (≥80%) with high visibility (≥70%)**
→ Keep interval short (4-8 hours) - still reading

**Low weighted score (<50%)**
→ Shorten interval (2-6 hours)

**Deadline approaching**
→ Cap intervals regardless of performance

## Key Principles

1. **Only Mastered Words**: Brackets only contain words that have been mastered and removed from the manuscript

2. **Progressive Difficulty**: As you improve, more words move into brackets (reduced visibility)

3. **Deadline-Aware**: The system automatically adjusts difficulty and intervals based on your presentation date

4. **Performance-Based**: Your actual memory performance (not just reading ability) determines progression

5. **Segment Autonomy**: Each bracket is independent - you can fail one while succeeding at others

6. **Persistent Progress**: Green words stay green, allowing you to retry only what you missed

## Integration with Main System

The bracket recall system is fully integrated with:
- Adaptive learning algorithm
- Spaced repetition scheduling
- Word visibility calculation
- Segment length adjustment
- Performance trend tracking
- Deadline proximity rules

All bracket performance data feeds into the overall adaptive learning system to ensure optimal practice scheduling and difficulty adjustment.
