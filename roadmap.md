# Roadmap

## Pågående: Djurpublik i helskärm

- [x] Djurvyn ersätter manuset i den helt fördolda fasen
- [x] Sex stora, tydligt olika djur fyller mobil- och datorskärmen
- [x] Humör, blick, leende och armar följer varje korrekt målord
- [x] Godkänd mening utlöser gemensamt jubel och konfetti
- [ ] Verifiera mobil, desktop och build

## Pågående: Generell översikt-läge + Duolingo-rent valsteg

- [ ] `src/utils/keywordExtraction.ts` – heuristiskt nyckelordsurval
- [ ] `BeatPracticeView.tsx` – `learningMode`-prop, göm bara nyckelord, mjukare matchning, mastery = nyckelord täckta
- [ ] `Practice.tsx` – skicka `learning_mode` till BeatPracticeView + analyze-speech
- [ ] `analyze-speech` edge – läs `learning_mode`, betygsätt täckning i översiktsläge
- [ ] `UploadSpeechDialog.tsx` + `LearningModeSelector.tsx` – ren Duolingo-kortdesign
- [ ] Verifiera: tsgo + build OK
