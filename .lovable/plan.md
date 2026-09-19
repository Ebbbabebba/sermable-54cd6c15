# Riktiga spaced repetition-intervall efter 100 % behärskad

## Bakgrund (verifierat i koden)

- Ett avsnitt blir `is_mastered` efter en lyckad genomgång med alla ord dolda; talet är 100 % när alla avsnitt är behärskade.
- Efter mastery finns en växande stege per avsnitt (FSRS i `next_scheduled_recall_at` + 2/3/5/7-dagarsstegen via `recall_session_number`).
- Men två äldre mekanismer kör över detta och ger "alltid ~23 h":
  1. `computeNextBeatReviewDate` i `src/pages/Practice.tsx` (rad ~540) skriver platt 24 h (4/8/12/24 h nära deadline) till `schedules.next_review_date`, som styr lås/nedräkning på dashboard och Practice.
  2. "Daglig repetition"-kön i `BeatPracticeView.tsx` (rad ~1210–1234) tvingar varje behärskat avsnitt att repeteras varje ny dag så länge `recall_session_number < 5`, oavsett FSRS-intervall.

## Ändringar

1. **Ta bort det platta dygnslåset**
   - `src/pages/Practice.tsx`: `ensureNextPracticeScheduled`/`computeNextBeatReviewDate` slutar skriva platta 24 h. Istället speglas det tidigaste kommande `next_scheduled_recall_at` bland talets avsnitt (FSRS styr), eller så skrivs inget alls om inget är schemalagt.
   - Samma justering där `schedules.next_review_date` läses för lås/nedräkning (Practice.tsx rad ~464, SpeechCard.tsx rad ~75–85): färdiginlärda avsnitt utan förfallet FSRS-pass visar aldrig "Redo om 23 h".

2. **Slopa den tvingande dagliga repetitionen**
   - `BeatPracticeView.tsx`: ta bort `beatsNeedingDailyRecall`-kön (eller begränsa den till att bara gälla innan första FSRS-passet satts). Kvar blir: 10 min → kväll → morgon (dag 1), sedan enbart FSRS-schemalagda pass.

3. **Färdigt tal + passerad deadline = inga påstötningar**
   - Verifiera att frivillig-läget (Practice.tsx rad ~2139) inte ändå blockeras/triggeras av `schedules`-låset efter ändringarna.

## Resultat för användaren

Efter 100 % behärskad kommer repetitionerna på riktiga spaced repetition-intervall: först samma dag (10 min/kväll/morgon), sedan växande gap på flera dagar som anpassas efter hur bra passen gick – inte en platt 23-timmars påminnelse.

## Tekniskt

- Berörda filer: `src/pages/Practice.tsx`, `src/components/BeatPracticeView.tsx`, ev. `src/components/SpeechCard.tsx`.
- Ingen databasmigrering behövs; `schedules`-tabellen finns kvar men skrivs inte längre med platt 24 h.
- Testa: behärska ett avsnitt i förhandsvisningen och kontrollera att nästa repetitionstid följer FSRS-steget, inte 24 h.
