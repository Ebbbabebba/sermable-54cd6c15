# Förbättringsplan: Memoriseringssystemet

Detta är ett stort arbete. Jag föreslår att vi delar upp det i **5 faser** så vi kan testa varje steg innan vi går vidare. Varje fas levererar tydligt värde på egen hand.

---

## Fas 1 — Konsolidera schemakällor (löser hopp-buggen permanent)

**Problem:** `schedules`, `speech_calendar_events`, `practice_beats.next_scheduled_recall_at` och `speech_segments.next_review_at` lever parallellt och kommer i otakt.

**Lösning:**
- Ny tabell `mastery_events` (append-only logg över alla recall/practice-händelser per beat).
- Ny vy `v_next_due` som per användare returnerar nästa beat att öva (en enda källa).
- All UI (Dashboard, notiser, lås) byter till `v_next_due`.
- Befintliga `next_scheduled_recall_at`-fält behålls men sätts av en enda edge-funktion `compute-next-due`.

**Leverans:** Bug med hoppade sessioner försvinner. Dashboard, notiser och praktik visar alltid samma "nästa".

---

## Fas 2 — Ersätt SM-2 med FSRS + korrigerad viktning

**Problem:** SM-2 passar inte sekventiella beats. Viktad accuracy straffar höga råpoäng absurt (95 % → 19 %).

**Lösning:**
- Implementera FSRS-4.5 (öppen algoritm) i ny edge-funktion `fsrs-schedule`.
- Per beat lagras: `stability`, `difficulty`, `last_review`, `reps`, `lapses`.
- Visibility blir **modifier på intervallet** (`interval × visibilityFactor`), inte multiplikator på poängen.
- Råpoäng + visibility loggas separat för analys.
- Deadline-cap behålls från `ADAPTIVE_LEARNING_RULES.md`.

**Leverans:** Mer rättvisa intervall, bättre långtidsretention.

---

## Fas 3 — Smartare notiser (interleaving + sömn-konsolidering + prioritet)

**Problem:** Notiser är blockade per tal, kopplas inte till sömn, ignorerar deadline-prioritet.

**Lösning:**
- `send-adaptive-notifications` skrivs om:
  - **Morgonnotis (inom 30 min efter `practice_start_hour`)**: "5-min mix" — top-3 förfallna beats från ALLA aktiva tal (interleaving).
  - **Kvällsnotis (30 min före `practice_end_hour`)**: kort recall av dagens mest bräckliga beat (sömnkonsolidering).
  - **Deadline-prioritet**: `priority = urgency(deadline) × (1 − mastery) × overdueness`. Tal närmare deadline går först.
- Dashboard sorteras enligt samma prioritet.
- Notistexter lokaliseras till alla 7 språk.

**Leverans:** Forskningsbaserad notistiming, bättre retention, tydligare fokus.

---

## Fas 4 — Desirable difficulty + lapse-tracking

**Problem:** Hint-systemet hjälper för snabbt. Misslyckade ord glöms inte över tal.

**Lösning:**
- `useAdaptiveTempo`: hint-fördröjning skalas upp gradvis (400ms → 2500ms) när användaren börjar klara beats utan stöd.
- Slumpa in en "blank run" (ingen hint, 0 % visibility) var 4:e session efter mastery.
- `user_word_mastery.total_missed` får inverkan på `protected_word_logic` — ord med hög global misslyckandefrekvens prioriteras som hidden även i nya tal.

**Leverans:** Djupare inlärning (testing effect), användaren bygger ett personligt "svårordsregister".

---

## Fas 5 — Observability + A/B-mätning

**Problem:** Inget sätt att veta om förbättringarna faktiskt fungerar.

**Lösning:**
- `mastery_events` (från Fas 1) blir grund för analys.
- Nytt fält `presentation_sessions.predicted_accuracy` (FSRS-prediktion vid sessionstart) jämförs mot faktisk accuracy.
- Enkel intern analytics-vy: retention-kurva per användare över 7/30/90 dagar.
- Free tier-policy uppdateras: 1 aktivt tal, obegränsad recall på gamla tal (så SR-värdet syns).

**Leverans:** Vi kan mäta att systemet faktiskt blir bättre, och free-användare upplever SR:s värde.

---

## Tekniska detaljer

**Nya/ändrade tabeller (Fas 1+2):**
- `mastery_events` (append-only): `id, user_id, speech_id, beat_id, event_type, raw_accuracy, visibility, hesitations, lapses, created_at`
- `practice_beats` får: `fsrs_stability, fsrs_difficulty, fsrs_reps, fsrs_lapses`
- Vy: `v_next_due` (per user_id)

**Nya/ändrade edge-funktioner:**
- `compute-next-due` (Fas 1) — ersätter spridd logik
- `fsrs-schedule` (Fas 2) — ersätter `update-sm2-schedule`
- `send-adaptive-notifications` (Fas 3) — skrivs om för interleaving + prioritet

**Komponenter som påverkas:**
- `Dashboard.tsx`, `SpeechCard.tsx`, `ReviewNotifications.tsx`, `LockCountdown.tsx`, `BeatPracticeView.tsx`, `useAdaptiveTempo.ts`, `useSleepAwareTracking.ts`

**Det ändras INTE:**
- Practice-UI:t (färger, animations, hidden brackets) — bara backend för schemaläggning.
- Speech recognition-logik.
- Befintlig speech-data — migration är bakåtkompatibel (existerande fält fylls i parallellt).

---

## Mitt förslag

**Börja med Fas 1 nu.** Den löser den konkreta buggen du nyligen rapporterade och är en förutsättning för allt annat. Den tar ca 1 iteration och är låg risk.

När Fas 1 är verifierad, säg till så kör jag Fas 2, osv. Vill du ändra ordning, hoppa över någon fas, eller köra allt på en gång?
