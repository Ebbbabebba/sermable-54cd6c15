# Roadmap

## Pågående: Generell översikt-läge + Duolingo-rent valsteg

- [ ] `src/utils/keywordExtraction.ts` – heuristiskt nyckelordsurval
- [ ] `BeatPracticeView.tsx` – `learningMode`-prop, göm bara nyckelord, mjukare matchning, mastery = nyckelord täckta
- [ ] `Practice.tsx` – skicka `learning_mode` till BeatPracticeView + analyze-speech
- [ ] `analyze-speech` edge – läs `learning_mode`, betygsätt täckning i översiktsläge
- [ ] `UploadSpeechDialog.tsx` + `LearningModeSelector.tsx` – ren Duolingo-kortdesign
- [ ] Verifiera: tsgo + build OK
