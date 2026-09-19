# Rekvisitamärken i presentationsläget + feedback på fel språk

Två separata fel, båda bekräftade i koden.

## 1. `{{skratta}}` syns i presentationsläget

Manuset rensas på två olika sätt i appen, och presentationsvyerna använder fel variant.

- Den funktion som rensar text (`stripStageDirections`) tar bort `{{...}}`-märkena korrekt.
- Men den funktion som delar upp manuset i enskilda ord för teleprompter-vyerna (`tokenizeScript`) gör det inte – den känner bara igen parenteser. Därför blir `{{skratta}}hej` ett eget "ord" på skärmen.

Det drabbar båda presentationsvyerna (strikt läge och kompakt läge) och även utskriftsdialogen, som använder samma uppdelning. I strikt läge blir det dessutom fel ordräkning, eftersom de två varianterna ger olika antal ord.

**Åtgärd:** ordmärkningen görs på samma sätt överallt. `tokenizeScript` får känna igen och hoppa över `{{cue}}`- och `{{/}}`-märken samt pausmarkörer, precis som textrensningen redan gör. Då visas bara "hej", ordindex stämmer mellan vyerna, och den färgade rekvisita-etiketten fungerar som tidigare.

## 2. Feedback ges bara på engelska

Ingen av de tre funktioner som skapar feedback säger åt AI:n vilket språk svaret ska vara på, så modellen svarar alltid på engelska. Reservtexterna (när AI:n inte svarar) är också hårdkodade på engelska.

Det gäller:
- feedback efter presentation
- feedback efter övningspass
- feedback efter återberättning

**Åtgärd:** appen skickar med användarens språk vid varje anrop, och AI:n instrueras att svara på det språket. Reservtexterna hämtas ur appens vanliga språkfiler i stället för att skrivas på engelska i servern.

Språket som används är det appen visas på (samma val som i inställningarna). Talets eget språk används som reserv om appspråket saknas.

## Teknisk sammanfattning

**Rekvisitamärken**
- `tokenizeScript` i `src/utils/stageDirections.ts` byter till samma tokenisering som `extractPropCues` använder: hoppa över `{{...}}`, `{{/}}`, `(...)` och pausmarkörer, och räkna bara riktiga ord.
- `StrictPresentationView.tsx` tar bort den dubbla ordlistan (rad 121 vs 125) och använder `words` från `tokenizeScript`, så ordindex och rekvisita-index alltid ligger i fas.
- `CompactPresentationView.tsx` och `BeatPrintDialog.tsx` får rätt beteende automatiskt via samma funktion.

**Språk på feedback**
- `src/pages/Presentation.tsx`, `src/pages/Practice.tsx` och `src/components/ScriptPracticeView.tsx` skickar med `feedbackLanguage: i18n.language` (reserv: talets `speech_language`) i anropen till `analyze-presentation`, `analyze-speech` och `analyze-retelling`.
- De tre edge-funktionerna läser fältet, mappar koden till språknamn (en, sv, de, fr, es, it, pt) och lägger till en rad i systemprompten: svara uteslutande på det språket, inklusive JSON-fältens innehåll.
- Hårdkodade reservtexter i `analyze-presentation` ersätts av nycklar som klienten översätter, med nya texter i alla sju språkfiler.
- De tre funktionerna deployas.
