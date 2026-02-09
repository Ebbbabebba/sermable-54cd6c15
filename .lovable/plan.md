

# General Overview Mode Improvements

## Summary

Three key improvements to make General Overview practice more interactive and useful:

1. **Order keywords sequentially** - Keywords appear in the order they appear in the speech section, giving a natural flow
2. **Real-time green highlighting** - As the user speaks, keywords and numbers turn green when mentioned
3. **Remove Key Phrases column** - Simplify the card to just two columns: Key Words and Key Numbers

---

## Changes

### 1. Update AI extraction prompt (`extract-speech-topics`)

- Instruct the AI to return `key_words` in the order they appear in the speech text
- Remove `key_phrases` from the extraction prompt entirely (stop generating them)
- Keep `key_phrases` column in the database for backward compatibility but stop populating it

### 2. Add real-time speech recognition during recording (`OverviewPracticeView`)

- When the user is recording, use the existing `RealtimeTranscription` utility to get live transcription
- As words come in, fuzzy-match them against the current section's `key_words` and `key_numbers`
- Pass a `mentionedWords` set down to the `OverviewTopicCard` so matched items turn green in real-time
- This gives satisfying instant feedback as the user speaks

### 3. Simplify `OverviewTopicCard` to two columns

- Remove the Key Phrases column entirely
- Show only **Key Words** (as badge chips) and **Key Numbers** (as mono-styled items)
- Add a `mentionedKeyWords` and `mentionedKeyNumbers` prop (string arrays)
- When a keyword/number is in the mentioned set, render it with a green background and checkmark instead of the default style
- Animate the transition from default to green (smooth color fade)

### 4. Update `OverviewResults` 

- Remove all phrases-related display (missed phrases, mentioned phrases)
- Keep keywords and numbers breakdown only

### 5. Update `analyze-overview-session` edge function

- Remove `key_phrases` from the evaluation prompt
- Remove `phrases_mentioned` and `phrases_missed` from the expected response
- Simplify scoring to focus on keywords and numbers coverage only

### 6. Update hint levels

- **Level 1 (Full)**: Show all keywords and numbers with green highlighting
- **Level 2 (Titles only)**: Show section title + count of keywords/numbers (2 columns instead of 3)
- **Level 3 (Blind)**: Show only section number

---

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/extract-speech-topics/index.ts` | Update prompt to order keywords sequentially and remove key_phrases |
| `supabase/functions/analyze-overview-session/index.ts` | Remove phrases from evaluation, simplify scoring |
| `src/components/OverviewTopicCard.tsx` | Remove phrases column, add green highlighting for mentioned items |
| `src/components/OverviewPracticeView.tsx` | Add real-time transcription matching, track mentioned words, pass to card |
| `src/components/OverviewResults.tsx` | Remove phrases from results display |
| `src/i18n/locales/en.json` | Remove phrase-related keys, add new keys if needed |
| `src/i18n/locales/sv.json` | Same |

---

## Technical Details

### Real-time matching logic (in OverviewPracticeView)

During recording, use a simple interval or the existing real-time transcription to get partial text. For each incoming word:

```text
for each word in transcription:
  normalize(word) -> lowercased, stripped of punctuation
  for each keyWord in currentSection.key_words:
    if levenshteinDistance(normalize(word), normalize(keyWord)) <= 2:
      add keyWord to mentionedKeyWords set
  for each keyNumber in currentSection.key_numbers:
    if word contains the numeric portion of keyNumber:
      add keyNumber to mentionedKeyNumbers set
```

This uses fuzzy matching consistent with the existing speech recognition approach in the codebase.

### Green highlight styling (in OverviewTopicCard)

Keywords/numbers transition from default styling to green:
- Default: `bg-primary/5 border-primary/20 text-foreground`
- Mentioned: `bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300` with a smooth 300ms transition

