# Genomgång av repetitionssystemet + korta deadlines

## Vad som fungerar
- Stegen 10 min → 1 → 3 → 7 → 14 → 30 dagar, med tak nära deadline.
- Nya avsnitt introduceras under de första 60 % av tiden.
- Början och slutet av talet varvas.
- De sista två dygnen övar man hela talet i ett svep.

## Problem som hittats

**1. Framsteg nollställs nära deadline.**
Med kort tid kvar kortas intervallen (t.ex. till 12 timmar). Nästa gång läser systemet det korta intervallet som om man stod på första steget. Då klättrar man aldrig uppåt, även om det går perfekt. Det ger onödigt många repetitioner av avsnitt man redan kan.

**2. Efter deadline fortsätter det i all evighet.**
När datumet har passerat får alla avsnitt en repetition var fjärde timme, och notiserna fortsätter.

**3. Deadline om 0–2 dagar: allt läggs på en dag.**
Har talet 15 avsnitt och deadline i morgon ska alla 15 läras in i dag, utan varning. Det är orimligt, och resultatet blir sämre än om man prioriterar.

**4. Appen och servern räknar dagar olika.**
Appen räknar "dagar kvar" uppåt efter lokal tid. Servern avrundar efter UTC-tid. Det kan skilja en dag, så att taket och dagsplanen säger olika saker. Utanför Sverige kan det bli ännu tydligare fel.

## Åtgärder
1. **Spara steget direkt.** Nästa gång läses inte steget ut ur intervallet, så ett nedkortat intervall tappar inte framstegen.
2. **Efter deadline:** en sista repetition, sedan pausas schemat och notiserna. Undantag: om man själv väljer "Öva inför framträdandet".
3. **Kort deadline (under 3 dagar):**
   - Visa en tydlig ruta när talet skapas eller deadline sätts, till exempel: "15 avsnitt på 1 dag är mycket. Vi fokuserar på början, slutet och övergångarna." Förslag om att flytta datumet om det går.
   - Komprimerat schema: inlärning med 10 min / 1 h / 3 h / kvällsrepetition, genomkörning på morgonen samma dag.
   - Tak på cirka 8 nya avsnitt per pass. Resten sprids ut över passen under dagen.
4. **Samma dagräkning överallt:** utgå från kalenderdatum i användarens tidszon, både i appen och på servern.
5. **Kontrollkörning:** simulera deadline om 1, 3, 7, 14 och 30 dagar och bekräfta att varje avsnitt får minst 3–4 repetitioner före framträdandet.

## Tekniska detaljer
- `schedule-next-review`: använd `fsrs_reps` plus en ny kolumn `ladder_rung` (migration) i stället för `currentRung(prevIntervalMin)`. Har deadline passerats: sätt `next_scheduled_recall_at = null` efter en repetition. Ny kortare stege när det är 2 dagar eller mindre kvar: `[10, 60, 180, 480]` min. `daysUntil` räknas via `profiles.timezone`.
- `BeatPracticeView.calculateBeatsPerDay`: tak per pass. Parsa `goal_date` som lokalt datum (`new Date(y, m-1, d)`) i stället för UTC.
- `send-due-now-notifications`: hoppa över tal där `goal_date < idag`, om inte användaren valt att fortsätta öva.
- Varningsrutan kopplas till den befintliga funktionen `assess_memorization_feasibility`. Texterna finns på alla sju språk.
