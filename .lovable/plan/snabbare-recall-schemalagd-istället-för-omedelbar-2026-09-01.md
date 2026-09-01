# Snabbare recall + schemalagd istället för omedelbar

## Problemet idag

Recall tar lång tid av tre skäl, och den dyker upp direkt i samma pass även när inget egentligen förfallit:

1. **Fade-kurvan börjar för långsamt.** Recall startar med hela texten synlig och döljer 1 → 2 → 3 → 5 → 7 … ord per godkänd runda (`BeatPracticeView.tsx:1466`). För ett beat på ~30 ord krävs 5–7 rundor bara för att nå "allt dolt".
2. **Två perfekta rundor krävs efter det.** När allt är dolt måste du klara beatet felfritt två gånger till (`:2447-2451`, "1/2 perfect recalls"), oavsett hur bra det gick.
3. **Köerna staplas.** 10-min-, kvälls-, morgon-, schemalagd- och daglig recall läggs alla i samma kö (`:1193-1199`), och ovanpå det körs en merged recall av alla bemästrade beats (`:2567-2597`). Samma text repeteras då både solo och i merge i samma pass.

Dessutom triggas **pre-beat recall** (`:1287-1306`) och **10-minuters recall** direkt inne i passet — inte för att ett schemalagt intervall passerat, utan för att du nyss bemästrade beatet.

## Vad som ändras

### 1. Kortare recall
- **Adaptiv fade-kurva:** dölj en andel av kvarvarande ord istället för fast antal — ca 25 % av de synliga målorden per godkänd runda, minst 3 ord. Ett 30-ordsbeat når "allt dolt" på 3–4 rundor istället för 6–7.
- **Starta delvis dolt:** ett beat som redan har `recall_session_number ≥ 1` börjar inte från noll utan med ~40 % redan dolt (utöver gap-orden). Har du klarat det förr behöver du inte läsa upp det med manus igen.
- **En perfekt runda räcker** vid session ≥ 2, eller när föregående recall gick felfritt. Två krävs bara första gången ett beat recall:as och efter en misslyckad runda.

### 2. Färre upprepningar per pass
- **Max 2 solo-recalls per pass.** Övriga förfallna beats markeras som avklarade via den merged recall som ändå körs — ingen beat körs både solo och i merge i samma pass.
- Om merged recall körs och täcker ett beat, hoppas dess solo-recall över helt.

### 3. Recall blir schemalagd, inte omedelbar
- **Pre-beat recall** körs bara när något av följande gäller: beatet har ett förfallet `next_scheduled_recall_at`, det är minst ~30 minuter sedan beatet bemästrades, eller deadline är ≤ 3 dagar bort (tidspress). Annars går du direkt vidare till nästa beat och beatet plockas upp i nästa schemalagda pass.
- **10-minuters recall i slutet av passet** körs bara vid tidspress (deadline ≤ 3 dagar) eller när `recall_10min_at` verkligen passerat i ett *nytt* pass. I normalfallet avslutas passet och recall sker vid nästa schemalagda tillfälle (pushnotisen finns redan).
- Alla nedtonade omedelbara recalls skriver fortfarande `next_scheduled_recall_at`, så inget faller mellan stolarna — det flyttas bara till schemat.

### 4. Text och tydlighet
Recall-introt visar hur många beats som ingår och att det är en kort avstämning, så det inte känns öppet i tid. Nya/ändrade strängar läggs in i alla sju språk.

## Teknisk sammanfattning

- `src/components/BeatPracticeView.tsx`
  - `getWordsToHideCount` (:1465) → andelbaserad, tar emot antal kvarvarande synliga målord.
  - Recall-init (:1444-1488) → seed av fördolda ord utifrån `recall_session_number`.
  - `handleRecallCompletion` (:2447-2451) → krav på 1 vs 2 perfekta rundor.
  - Kösammansättning (:1193-1210) → tak på 2 solo-recalls, dedup mot merged recall.
  - Pre-beat recall-gate (:1287-1306) och end-of-session-recall (:2533-2540) → villkorade på förfallen schemaläggning / deadline ≤ 3 dagar.
- `src/i18n/locales/{sv,en,de,es,fr,it,pt}.json` — recall-intro-texter.
- Ingen databasändring; befintliga kolumner (`recall_session_number`, `next_scheduled_recall_at`, `total_successful_recalls`) räcker.
