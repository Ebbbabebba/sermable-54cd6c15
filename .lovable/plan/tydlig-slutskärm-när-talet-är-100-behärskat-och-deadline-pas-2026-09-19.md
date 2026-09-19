# Tydlig slutskärm när talet är 100 % behärskat och deadline passerad

## Problemet
När ett tal är helt genomarbetat (alla delar behärskade) och deadline har passerat beter sig appen fortfarande som mitt i inlärningen: den låser talet med en nedräkning, visar "Klart för idag!" och en "Öva ändå"-knapp med varning om att öva för tidigt. Det finns ingen riktig slutpunkt — användaren får aldrig veta att talet är *klart*.

## Åtgärd

### 1. Nytt "Talet är klart"-läge (`src/pages/Practice.tsx`)
Nytt villkor högst upp i visningslogiken: `isFullyComplete = masteryPercent >= 100 && goal_date passerad` (behärskning räknas redan på masterade delar; deadline finns i `speech.goal_date`).

När villkoret är uppfyllt visas en egen slutskärm istället för sessionskort, lås och "Öva ändå":
- Festlig ikon (t.ex. bock eller pokal i primärfärg, rund, appens stil).
- Rubrik: "Du kan talet!" 
- Undertext: "Alla delar är behärskade och din deadline har passerats. Bra jobbat!"
- Statistikraden (lärt / 100 % / 0 kvar) ligger kvar under.
- **Primär knapp:** "Tillbaka till översikten" → dashboard.
- **Sekundär knapp:** "Öva inför framträdandet" → presentationsläget (`/presentation/:id`) — det enda som är relevant att göra med ett färdigt tal.
- Ingen nedräkning, ingen varningstriangel, ingen "Öva ändå"-länk.

### 2. Sluta låsa färdiga tal
I `ensureNextPracticeScheduled` / låsberäkningen: om talet är 100 % behärskat och deadline passerad sätts ingen ny låsning (`setIsLocked(false)`) — upprepning efter deadline ska vara frivillig, inte schemalagd. Befintlig schemaläggning före deadline är orörd.

### 3. Texter på alla sju språk
Nya nycklar (sv, en, de, fr, es, it, pt):
- `practice.speech_complete_title` — "Du kan talet!"
- `practice.speech_complete_desc` — "Alla delar är behärskade och din deadline har passerats."
- `practice.back_to_overview` — "Tillbaka till översikten"
- `practice.rehearse_presentation` — "Öva inför framträdandet"

### 4. Inget annat ändras
- "Klart för idag!"-läget för tal som fortfarande är under inlärning behålls som det är.
- "Lektion klar!"-skärmen i övningen (BeatPracticeView) är orörd.
- Dashboard-kortets utseende för färdiga tal ändras inte i denna omgång (säg till om du vill ha ett "Klart"-märke där också).

## Tekniska detaljer
- Fil: `src/pages/Practice.tsx` — nytt villkor före nuvarande `todaySessionDone`-rendering, plus justering i `ensureNextPracticeScheduled` (rad ~565) och låssättning (rad ~1741).
- `masteryPercent`, `speech.goal_date`, `nextReviewDate` finns redan i komponenten — ingen ny datahämtning.
- Översättningsfiler: `src/i18n/locales/{sv,en,de,fr,es,it,pt}.json`.
