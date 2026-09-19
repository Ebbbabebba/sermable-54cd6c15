# Bättre minnesinlärning: se över intervall och inlärningsstruktur

## Så fungerar det idag (kontrollerat i koden)

1. När ett avsnitt klaras första gången: repetition efter 10 minuter, samma kväll kl 20, nästa morgon kl 06.
2. Därefter tar FSRS-algoritmen över och räknar ut nästa datum utifrån hur bra det gick.
3. Intervallen kortas automatiskt om deadline närmar sig (max 4 timmar när det är 0–2 dagar kvar, max 12 timmar vid under en vecka).
4. Påminnelser skickas morgon och kväll i appversionen.

Grundstrukturen är alltså redan forskningsmässigt rimlig. Men tre saker gör att intervallen blir felaktiga i praktiken.

## Problem som är värda att åtgärda

**1. Algoritmen får fel underlag vid godkänd repetition.**
Vid ett godkänt försök rapporteras alltid "100 % rätt, noll tvekan" — även om du kämpade dig igenom med långa pauser. Det gör att nästa intervall blir för långt för avsnitt som egentligen sitter dåligt. Åtgärd: skicka den verkliga träffsäkerheten och antalet tveksamma ord, så att ett kämpigt godkänt ger kortare intervall och ett flytande ger längre.

**2. Intervallen kan inte bli kortare än ett dygn men inte heller längre än det behövs.**
Nästa repetition avrundas alltid till hela dagar. Samtidigt krymps intervallet med upp till 60 % om du hade mycket text synlig. Kombinationen gör stegen ryckiga. Åtgärd: räkna i timmar istället för hela dagar, så stegen blir jämna (t.ex. 20 timmar, 2,5 dagar, 6 dagar) istället för hoppiga.

**3. Ingen "hur säker kände du dig"-signal.**
Forskning visar att användarens egen bedömning direkt efter försöket förutsäger glömska bättre än enbart antal rätt ord. Åtgärd: en snabb trestegsfråga efter varje repetition ("kämpigt / okej / satt perfekt") som justerar nästa intervall.

## Ytterligare optimeringar

4. **Försenade repetitioner ska inte straffas dubbelt.** Om du kommer tillbaka långt efter utsatt tid ska avsnittet öppna med mer text synlig istället för att dumpas som misslyckat.
5. **Blanda avsnitt inom passet.** Idag tränas samma avsnitt i följd. Att varva mellan avsnitt (interleaving) ger tydligt bättre långtidsminne. Föreslås som varannan repetitionsomgång.
6. **Skydda övergångarna mellan avsnitt.** De vanligaste blackouterna sker vid övergångar. Lägg in en kort "skarvövning" där sista meningen i ett avsnitt leder in i första meningen i nästa.
7. **Sömnfönstret utnyttjas bara delvis.** Kvällsrepetitionen är låst till kl 20 oavsett dina inställda övningstider — bör istället läggas 30–60 minuter före din inställda sluttid.
8. **Fler repetitioner nära deadline.** Sista två dygnen bör gå över till helhetsgenomgångar i rätt ordning istället för enstaka avsnitt.

## Tekniska detaljer

- `src/components/BeatPracticeView.tsx` rad ~2597: skicka verklig `rawAccuracy`, `hesitations` och `lapses` istället för hårdkodat 100/0/0 vid lyckad recall.
- `supabase/functions/schedule-next-review/index.ts`: `intervalDays()` avrundar till hela dygn — byt till timupplösning; `visibilityFactor` (0,4–1,0) appliceras därefter.
- Lägg till valfri `selfRating` (1–3) i `scheduleNextReview`-anropet som kombineras med `ratingFromAccuracy`.
- Overdue-hantering: `wasOverdue` finns redan i schemaläggaren men används bara för loggning — låt den styra starttäckningen i recall.
- Kvällsrepetition: ersätt hårdkodat `setHours(20,...)` med `profiles.practice_end_hour`.
- Interleaving och skarvövning byggs ovanpå befintlig `selectBeatsForEnduranceDrill`.

## Ordning

Steg 1–3 först (de påverkar intervallens korrekthet direkt), sedan 4, 7, 5, 6, 8.
