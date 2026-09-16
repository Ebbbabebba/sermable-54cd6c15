# Roadmap

## Klart: Djurpublik i helskärm

- [x] Djurvyn ersätter manuset i den helt fördolda fasen
- [x] Ett stort djur åt gången fyller mobil- och datorskärmen
- [x] Humör, blick, leende och armar följer varje korrekt målord
- [x] Godkänd mening utlöser jubel, konfetti och "Meningen klar!"
- [x] Verifierad typkontroll och build

## Klart: Jämnare meningar per avsnitt

- [x] Balanserad uppdelning i `segment-speech-into-beats`
- [x] Funktionen utrullad

## Pågående: Generell översikt-läge + Duolingo-rent valsteg

- [ ] `src/utils/keywordExtraction.ts` – heuristiskt nyckelordsurval
- [ ] `BeatPracticeView.tsx` – `learningMode`-prop, göm bara nyckelord, mjukare matchning, mastery = nyckelord täckta
- [ ] `Practice.tsx` – skicka `learning_mode` till BeatPracticeView + analyze-speech
- [ ] `analyze-speech` edge – läs `learning_mode`, betygsätt täckning i översiktsläge
- [ ] `UploadSpeechDialog.tsx` + `LearningModeSelector.tsx` – ren Duolingo-kortdesign
- [ ] Verifiera: tsgo + build OK
