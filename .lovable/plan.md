## Mål

1. **Bättre spaced repetition** — gör dagens SM-2 mer förutsägbar och deadline-medveten, så användaren får rätt antal övningstillfällen i rätt ordning fram till sitt tal.
2. **Talspecifik kalender** — visuell månadsvy per tal som visar vilka dagar som är "Practice", "Recall", "Test" och "Presentation Day", så användaren ser hela vägen fram till deadline.

---

## Del 1 — Spaced repetition: vad som blir bättre

Idag finns två parallella system: `update-sm2-schedule` (klassisk SM-2 med "again/hard/good/easy"-rating) och de adaptiva intervallerna per beat. Det fungerar tekniskt men:

- SM-2 kräver att användaren själv betygsätter — vi kan istället **härleda betyg automatiskt** från `sessionAccuracy` (t.ex. ≥95% = good, ≥80% = hard, <80% = again, 100% utan dolda ord = easy). Mindre friktion.
- Dagens deadline-cap är aggressiv (24h max när 14 dagar kvar) — det gör att "good" och "easy" knappt skiljer sig nära deadline. Jag mjukar upp så användaren inte överöses sista veckan.
- Inget koncept av **"target sessions per day"** baserat på deadline. Jag inför en enkel regel: ju närmare deadline, desto fler scheman per dag (1 → 2 → 3 → 4).
- **Genererar framtida sessions i förväg** istället för bara "next review" — krävs för kalendervyn nedan.

### Schemaläggningsregler (ny)

| Dagar till deadline | Sessioner/dag | Recall-typer per dag |
|---|---|---|
| 30+ | 1 | Practice |
| 15-30 | 1 | Practice + ev. Recall |
| 8-14 | 2 | Practice + Recall |
| 4-7 | 3 | Morning recall + Practice + Evening recall |
| 1-3 | 4 | Full repetition (alla beats) |
| 0 (idag) | — | "Presentation Day" markerad, inga locks |

---

## Del 2 — Speech Calendar

En ny komponent `SpeechCalendar` som visas på speech-detaljvyn (eller dashboarden via popover). Månadsvy med:

- **Idag** — markerad
- **Practice-dagar** — blå prick
- **Recall-dagar** — gul prick
- **Test/Full run** — orange prick (≤7 dagar kvar)
- **Presentation Day** — röd flagga med talets titel
- **Avklarade dagar** — grön bock
- **Missade dagar** — grå streck

Klick på en dag → liten popover som visar planerade sessions för dagen + knapp "Start practice" om det är idag/förfluten.

### Datakälla

Jag lägger till en ny tabell `speech_calendar_events` (eller använder befintliga `schedules`-rader utökade) som genereras automatiskt när:
- Ett tal skapas (med `goal_date`)
- En session avslutas (omräkning av framtida slots)
- `goal_date` ändras

```text
goal_date = 2026-05-20
today     = 2026-05-02 (18 dagar kvar)

Genererar:
  2026-05-02  practice
  2026-05-03  practice
  2026-05-05  recall
  2026-05-07  practice
  ...
  2026-05-18  morning recall, practice, evening recall
  2026-05-19  full run (test mode)
  2026-05-20  PRESENTATION DAY
```

---

## Tekniska ändringar

### Database
- Ny tabell `speech_calendar_events`:
  - `id`, `speech_id`, `user_id`, `event_date` (date), `event_type` ('practice'|'recall'|'test'|'presentation'), `completed` (bool), `completed_at`, `session_id` (nullable, länk till practice_sessions)
  - RLS: user kan se/CRUD egna via `speech_id → speeches.user_id`
- Trigger eller edge function som regenererar events när `speeches.goal_date` ändras

### Edge functions
- **Ny:** `generate-speech-schedule` — tar `speechId`, läser `goal_date`, raderar framtida ej-avklarade events, genererar nya enligt tabellen ovan
- **Uppdatera:** `update-sm2-schedule` — auto-deriva rating från accuracy, mjukare deadline-caps, anropar `generate-speech-schedule` efter uppdatering

### Frontend
- **Ny:** `src/components/SpeechCalendar.tsx` — månadsvy baserad på shadcn `Calendar`, med custom `modifiers` för olika event-typer och `modifiersClassNames` för färgprickar
- **Ny:** `src/components/SpeechCalendarDayPopover.tsx` — visar dagens planerade events
- **Integration:** Lägg till kalender-knapp/sektion på Dashboard speech card eller på en ny detaljvy
- **Lokalisering:** Nya strängar (calendar.practice, calendar.recall, calendar.test, calendar.presentationDay, calendar.completed, calendar.missed) i alla 7 språk

### UX-detaljer
- Kalendern är read-only — användaren kan inte flytta dagar manuellt (skulle krocka med SR-algoritmen). Däremot syns "skip till idag"-knapp.
- Presentation Day-cellen är extra framträdande med talets titel och nedräkning.
- Mobilvänlig: full bredd, swipe mellan månader, max 2 månader fram.

---

## Vad jag INTE ändrar

- Speech recognition / matchning — det justerade vi nyligen, det rörs inte här.
- Beat-segmenteringslogiken (30 ord, 2-3 meningar) — bevaras.
- Free vs Premium lock-beteende — bevaras (free får hard locks, premium får soft warnings även med nya kalendern).

---

## Frågor innan jag bygger

Två snabba val så jag bygger rätt sak:

1. **Var ska kalendern synas?** (a) på dashboard som expanderbar vy per tal, (b) som egen flik på speech-detaljvyn, eller (c) båda
2. **Auto-rating från accuracy** — okej att SM-2-betyg beräknas automatiskt så användaren slipper trycka "good/hard/easy" efter varje session?

Jag ställer dem som val när planen är godkänd. Säg till om något ska läggas till eller tas bort innan dess.