# Roadmap

## Klart: Lekfull mobilförnyelse

- [x] Pastellfärger, Nunito och delade kort-/knappstilar
- [x] Hem med verkligt tal, nedräkning, maskotring, beats och repetition
- [x] Hem/Tal/Statistik/Inställningar och verkliga statistikvärden
- [x] Förfina övningsord, mikrofon och befintlig feedback utan regeländringar
- [x] Verifiera mobil, iPad och övningsnavigering i webbläsaren

## Klart: Övningen får aldrig frysa

- [x] Stäng-knappen lämnar direkt, sparning sker i bakgrunden
- [x] Tidsgräns på mikrofon- och inloggningssteg
- [x] Laddning visar alltid stängknapp och Försök igen
- [ ] Testa på iPhone/iPad (väntar på användaren)

## Klart: Naturlig apptypografi

- [x] Förfina hemskärmens rubriker och text med Apples systemstil
- [x] Ge textdisplayer och övningar lugnare, konsekvent typografi utan ändrade övningsregler
- [x] Kontrollera hemskärm och övningsvy i webbläsaren

## Complete: Apple-inspired graphite refinement

- [x] Apply graphite tokens and Apple system typography across the app
- [x] Refine dashboard into clean iPhone-style lists and restrained controls
- [x] Verify navigation, dialogs and screen fit in the browser

## Complete: Flat app-wide design without Tailwind

- [x] Replace the Tailwind build dependency with standalone CSS while retaining existing screen layouts
- [x] Remove gradients across app styling and graphics
- [x] Refine shared controls and non-centered welcome/onboarding compositions
- [x] Verify browser rendering, navigation, and responsive layouts

## Klart: Fullständig översättning av kvarvarande skärmar

- [x] Delade tal och kontoradering på alla sju språk
- [x] Återblicken nästa dag och dess mikrofonmeddelanden på alla sju språk
- [x] Manusläget, felmeddelanden och resultatsammanfattning på alla sju språk

## Klart: Mjukare och färgstarkare kärnupplevelse

- [x] Grön standardaccent med tydliga kompletterande statusfärger
- [x] Stabilare dashboardkort, framsteg och knappövergångar
- [x] Gemensamt laddningsläge med glatt djur och lokaliserade fakta
- [x] Verifiera dashboard och laddningsläge i mobil och desktop

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
