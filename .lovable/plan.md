# Städa upp klarskärmen efter en lektion

## Problemet
När dagens lektion är klar på talsidan (Practice) visas idag:
- En stor knapp med texten **"Klart för idag!"** — ser ut som ett meddelande men är egentligen en navigationsknapp till översikten.
- Under den en **lika stor "Öva ändå"-knapp med kronikon** (rest från gamla premiumflödet) plus nedräkningstext.
Resultatet: två stora knappar i högsta prioritet, otydligt vad som är klart och vad man ska göra.

## Åtgärd

### 1. Eget "klart"-läge i huvudinnehållet (`src/pages/Practice.tsx`)
När dagens lektion är klar (`todaySessionDone`) visas ett eget klartkort i mitten istället för bara statistikraden:
- Rund bockikon i primärfärg.
- Rubrik: "Klart för idag!" (eller "Klart för nu!" om repetitionen är senare samma dag).
- Undertext som tydligt säger när nästa repetition är ("Nästa repetition: imorgon kl. 08:00" — bygger på befintlig `nextReviewDate`).
- Statistikraden (lärt / behärskning % / kvar) ligger kvar som den är.

### 2. Bottenlisten förenklas
- **Klar-läge:** en enda primär knapp "Tillbaka till översikten" (navigerar till dashboard). Ingen text som ser ut som ett meddelande på knappen.
- **"Öva ändå"** blir en liten, diskret textlänk under knappen (utan kronikon) — öppnar samma varningsdialog som idag med nedräkning och förklaring varför man bör vänta. Samma hantering när talet är låst men dagens lektion inte är klar.
- Nedräkningstexten under "Öva ändå" flyttas in i varningsdialogen (finns redan där) och tas bort från bottenlisten.

### 3. Texter
- Nyckel `practice.back_to_overview` ("Tillbaka till översikten") läggs till på alla sju språk (sv, en, de, fr, es, it, pt).
- Nyckel `practice.next_review_at` ("Nästa repetition: {{time}}") på alla sju språk.

### 4. Inget annat ändras
- "Lektion klar!"-skärmen i själva övningen (BeatPracticeView) ligger kvar — den fungerar.
- Låslogik, varningsdialog och tidsstyrning är orörda; det är bara presentationen av klart-läget som ändras.

## Tekniska detaljer
- Fil: `src/pages/Practice.tsx` (klartkort + bottenlisten runt rad 2351–2400).
- `isLocked` + `nextReviewDate` används fortfarande för att avgöra om "Öva ändå"-länken syns.
- Kronikonen (`Crown`) tas bort från "Öva ändå" — premium är inte längre en gräns i appen.
