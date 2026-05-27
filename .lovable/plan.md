## Mål
Eliminera de återkommande klagomålen ("sentence 2 hoppar över", "ord markeras inte", "låst trots att FSRS frisläppt") och rätta den vetenskapliga miss-aligneringen där FSRS pre-emptar de korta 10-min/kväll/morgon-cyklerna.

## Fas A — En schemaläggare, inte tre

**1. Gör FSRS villkorlig på recall_session_number ≥ 2** — `src/components/BeatPracticeView.tsx`
- I de två call-platserna för `scheduleNextReview()` (efter beat-mastery och efter merged-recall success): skippa anropet om `recall_session_number < 2`. Korta cykeln (10-min/kväll/morgon) får leva orörd.

**2. Ta bort dubbelskrivning av `next_scheduled_recall_at`** — `BeatPracticeView.tsx:2036-2065`
- Behåll stege-skrivningen (`calculateNextRecallDate`) för sessions 0–1.
- För sessions ≥ 2: skriv INTE fältet direkt; låt enbart FSRS äga det.

**3. Ta bort död `schedules`-skrivning** — `BeatPracticeView.tsx:2609-2638` (`showBeatCelebration`)
- Ta bort hela SM-2-blocket som skriver `schedules`-tabellen. Beat-flödet använder inte den tabellen.

**4. Uppdatera lock-check** — `src/pages/Practice.tsx:~396`
- Läs lock-status från `practice_beats.next_scheduled_recall_at` (min över beats) istället för `schedules.next_review_date` när läget är beat-baserat.

**5. Använd refs istället för stale state i FSRS-payload** — `BeatPracticeView.tsx:1945-1954, 2056-2065`
- Byt `hiddenWordIndices` → `hiddenWordIndicesRef.current` inuti deferred callbacks så `visibilityPercent` är aktuell.

## Fas B — Markeringslogik

**6. Fixa sentence-2 auto-complete på riktigt** — `BeatPracticeView.tsx`
- Lägg till `phaseTransitionAtRef` (timestamp) i `transitionToPhase`.
- I `processTranscription`: rensa `needsFreshSpeechRef` endast om båda:
  - `rawWords.length > ignoreResultsBeforeIndexRef.current` (genuint nytt tal, inte recyclad buffer)
  - `Date.now() - phaseTransitionAtRef.current > 500` (minst 500ms sedan fas-byte)

**7. Union istället för summa för failRatio** — `BeatPracticeView.tsx:1897-1898`
```ts
const failed = new Set([...hesitatedIndicesRef.current, ...missedIndicesRef.current]);
const failRatio = failed.size / Math.max(1, words.length);
```

**8. Sluta dubbelstraffa hesitations i FSRS** — `supabase/functions/schedule-next-review/index.ts:44-49`
- Ta bort `|| hesitations > 4` i `ratingFromAccuracy`. `rawAccuracy` reflekterar redan hesitations via fail-ratio.

**9. Höj `requiredLearningReps` för sentence_1 till 2** — `BeatPracticeView.tsx:365`
- Matchar sentence_2/3. Förhindrar att fading börjar efter en enda läsning ("desirable difficulty"-fix som RemNote/Bjork-litteraturen pekar på).

**10. Evening-branch order-fix** — `BeatPracticeView.tsx:2552-2556`
- Swap så `>= 20` testas före `>= 18`. Förhindrar evening-recall i det förflutna.

## Teknisk not (för utvecklare)

- Inga schema-ändringar krävs. Endast kodjusteringar i `BeatPracticeView.tsx`, `Practice.tsx` och en enda edge function (`schedule-next-review`).
- `update-adaptive-learning` / `update-sm2-schedule` / `schedules`-tabellen lämnas orörda — de tjänar fortfarande det legacy segment-flödet. Detta är ett separat sanerings-jobb för framtiden.
- Fas C (UTC-normalisering av morgon-recall, premium-init, COMMON_WORDS språkfilter, dead `practice_stage`) lämnas till en separat omgång — inte blockerande för dagens problem.

## Förväntat resultat

- Inga fler "sentence 2 hoppar över"-incidenter.
- Inga felaktiga låsningar för premium efter FSRS-skrivning.
- Tidiga korta cykler (10-min/kväll/morgon) respekteras alltid → matchar Pimsleur graduated interval recall + Ebbinghaus.
- FSRS tar över först vid session 2+, vilket är när dess långsiktiga modell faktiskt är meningsfull.
- failRatio och rating blir korrekta → mindre felaktig demotion.
