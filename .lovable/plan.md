# Fas 5 — Koppla in konsumenterna

Nu finns FSRS-motorn, `mastery_events`-loggen och `v_next_due`-vyn på plats. Det här steget gör att användaren faktiskt **märker** skillnaden.

## 1. BeatPracticeView → använd FSRS

- Efter varje avslutad beat-session: anropa `schedule-next-review` edge-funktionen med `raw_accuracy`, `visibility_percent`, `hesitations`, `lapses`, `duration_seconds`.
- Skriv en rad i `mastery_events` (event_type: `recall` eller `practice`).
- Sluta skriva till gamla `schedules`-tabellen för denna beat (lämna kvar för bakåtkompatibilitet, men den är inte längre källa).
- FSRS-funktionen uppdaterar `practice_beats.fsrs_*` och `next_scheduled_recall_at` automatiskt.

## 2. Dashboard → läs från `v_next_due`

- Byt ut dagens "vad ska jag öva på?"-logik mot `get_top_due_beats` RPC.
- Visa beats sorterade efter `priority_score` (deadline-pressure × (1−mastery) × overdueness).
- "Nästa övning"-kortet visar översta beaten oavsett vilket tal den tillhör.

## 3. ReviewNotifications & LockCountdown

- `ReviewNotifications.tsx` läser nästa due-tid från `v_next_due` istället för `schedules.next_review_date`.
- `LockCountdown.tsx` använder samma källa → låsen släpper exakt när FSRS säger "due".

## 4. SpeechCard → mastery & nästa pass

- Visa aggregerad FSRS-mastery (medel av `fsrs_stability` normaliserat) per tal.
- Visa "Nästa övning om X" baserat på tidigast `next_scheduled_recall_at` bland talets beats.

## 5. Desirable difficulty i praktiken

- `useAdaptiveTempo`-skalningen är klar — anropa den med `masteryConfidence` från beatens `fsrs_stability/difficulty` i `BeatPracticeView`.
- Lägg in "blank run" var 4:e session när beat är mastered (`fsrs_reps ≥ 3 && fsrs_stability > 7`): dölj alla ord en runda utan hjälp.

## Påverkade filer

**Frontend**
- `src/pages/Dashboard.tsx` — byt schedules-query mot `get_top_due_beats`
- `src/components/practice/BeatPracticeView.tsx` — anropa `schedule-next-review`, logga event, läs `masteryConfidence`
- `src/components/SpeechCard.tsx` — visa FSRS-mastery + nästa pass
- `src/components/ReviewNotifications.tsx` — läs `v_next_due`
- `src/components/practice/LockCountdown.tsx` — läs `v_next_due`
- `src/hooks/useNextDueBeat.ts` (ny) — wrapper kring `get_top_due_beats`

**Backend** — redan på plats, ingen migration behövs.

## Vad användaren märker

- Dashboarden visar **rätt** nästa övning, även när två tal har olika deadlines.
- Låsen släpper när FSRS säger så (inte efter fasta intervall).
- Hint-fördröjningen ökar gradvis när man blir bättre på en beat.
- Morgon-/kvällsnotiser blandar beats från olika tal (interleaving).

## Riskpunkter

- Gamla `schedules`-rader finns kvar; några gamla queries kan dubbelläsa. Vi behåller dem men slutar skriva — efter 2 veckor kan vi droppa.
- Första gången en användare öppnar appen efter uppdateringen saknas `fsrs_*`-värden → fallback till defaults (stability=1, difficulty=5).
