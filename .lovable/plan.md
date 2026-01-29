# Beat Preview and Full Speech View Implementation

## Status: ✅ Completed

## Overview

This plan implemented two features to improve the memorization experience for long speeches:

1. **Beat-by-Beat Preview**: Before practicing each new beat, shows the upcoming beat text for a quick read-through
2. **"Show Whole Speech" Button**: A button that opens a modal/sheet showing the complete speech text on demand

---

## Implementation Summary

### Changes Made

**BeatPracticeView.tsx:**
- Added `beat_preview` to `SessionMode` type
- Added `fullSpeechText` prop to interface
- Added `showFullSpeechModal` state
- Added beat preview screen with "Coming up..." UI
- Added full speech Sheet modal accessible from header
- Updated session flow: recall → beat_preview → learn

**Practice.tsx:**
- Passes `speech.text_original` as `fullSpeechText` prop to BeatPracticeView

---

## Flow

```text
Start → Recall Mode → Beat Preview → Learn Mode → Rest → Next Beat
                          ^
                          |
            (can tap 📖 Full Speech anytime)
```
