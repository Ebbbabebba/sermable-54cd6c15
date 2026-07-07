# Plan: Fem förbättringar samlat

## 1. Mindre "AI"-känsla på ikoner (t.ex. Nytt tal-dialogen)
Idag används rörliga/gradient-ikoner (roterande stjärnor, pulserande gradient-cirklar) i UploadSpeechDialog och LearningModeSelector/PresentationModeSelector som ser generiskt AI-genererade ut.

**Ändring:** ersätt de animerade gradient-badgesarna med lugna, platta ikoner i stil med resten av appen:
- Ta bort `animate-spin`, `animate-pulse`, `bg-gradient-to-br from-primary/…` runt ikonerna.
- Behåll Lucide-ikonerna (Brain, BookOpen, Ear, MonitorPlay), men i en enfärgad rund/rounded-square badge (`bg-muted text-foreground`, aktiv = `bg-primary text-primary-foreground`), utan rörelse.
- Samma behandling i UploadSpeechDialog-stegens header-ikoner.

## 2. "Tip:" på scen­anvisningar översätts till alla språk
`upload.stageDirections.tip` finns bara delvis översatt (sv har "Pro-tips:", övriga faller tillbaka till engelska).

**Ändring:** lägg till korrekt översatt sträng i `de.json`, `fr.json`, `es.json`, `it.json`, `pt.json` för nyckeln `upload.stageDirections.tip` (och `upload.stageDirections.eyebrow/title/subtitle` om de saknas). Samma sak för `beat_practice.coffee_tip` som visas som "Tip: …" — verifieras i alla 7 filer.

## 3. Kamera → "bara svart" när man scannar dokument
`startCamera` i `UploadSpeechDialog.tsx` kör `getUserMedia({ video: { facingMode: "environment" } })` och sätter direkt `videoRef.current.srcObject = stream`. På iOS/Safari och i Capacitor blir videon svart eftersom:
- `<video>` saknar `playsInline`, `muted`, `autoPlay`.
- `video.play()` anropas aldrig efter att stream satts.
- I native (Capacitor) körs getUserMedia i webviewen utan mikrofonpermission-flödet, vilket ofta ger svart bild.

**Ändring:**
- Lägg till `playsInline muted autoPlay` på `<video>` och `await videoRef.current.play()` när `loadedmetadata` fyrar.
- Använd `@capacitor/camera` i native (redan kompatibelt med Capacitor-uppsättningen): på iOS/Android → `Camera.getPhoto({ source: CameraSource.Camera, resultType: DataUrl })` istället för getUserMedia; skicka direkt base64 till `scan-document`-edgefunktionen. På web fortsätt använda getUserMedia med fixarna ovan.
- Vid fel: visa inline-fel (via nya InlineMessages) istället för toast.

## 4. "Låt oss testa dina kunskaper" när talet öppnas
Idag sätts `familiarity_level` (beginner/intermediate/confident) vid skapande, men den används bara för att styra hur snabbt ord göms — inget test triggas.

**Ändring:**
- Ny kolumn `knowledge_test_completed_at timestamptz` i `speeches`-tabellen.
- När `SpeechDetail`/Practice öppnas för ett tal där `familiarity_level ∈ ('intermediate','confident')` OCH `knowledge_test_completed_at IS NULL` → visa en inline-banner högst upp: **"Låt oss testa dina kunskaper"** med CTA-knapp.
- Klick startar ett **snabbtest**: en kort sekvens där 3–5 slumpade beats visas i strict-läge med ~40 % av orden dolda (motsvarande "confident"-svårighet). Använder befintliga `BeatPracticeView`-hjälpare men med flaggan `quickAssessment=true` som:
  - hoppar över lock/cooldown,
  - kör max ~2 min,
  - loggar accuracy per beat.
- Efter testet: beräkna medel-accuracy → uppdatera `familiarity_level` automatiskt (≥85 % = confident, 60–85 % = intermediate, <60 % = beginner) och sätt `knowledge_test_completed_at = now()`. Visa kort inline-summering ("Vi anpassar övningen till din nivå: …").

## 5. Förklara skillnaderna direkt i UI (info-panel)
Idag har `LearningModeSelector` och strict/flow-toggle korta beskrivningar men användaren förstår inte skillnaden.

**Ord-för-ord vs Generell översikt:**
- Ord-för-ord: du lär dig den exakta texten. Ord göms progressivt tills du kan recitera hela talet utantill. Bäst för högtidstal, monologer, pitchar där formuleringen räknas.
- Generell översikt: du lär dig **strukturen och nyckelpoängerna** — inte ordval. AI:n godkänner att du säger samma sak med egna ord. Bäst för presentationer, föreläsningar, intervjusvar.

**Strikt vs Flöde:**
- Strikt: talet matchas ord-för-ord. Fel/hopp markeras rött direkt, hesitationer gult efter 2 s. AI-analysen är sträng.
- Flöde: talet matchas semantiskt. Små avvikelser, synonymer och omkastningar godkänns. Fokus på pace och naturligt flöde snarare än exakthet.

**Ändring:** utöka `helpText` i `LearningModeSelector` med texten ovan (redan lokaliserad via `en.json` + de 6 andra), och lägg till motsvarande hjälp-popover vid strict/flow-toggeln där den visas (Practice-inställningar och SpeechDetail).

---

## Teknisk sammanfattning
- **Frontend:** `UploadSpeechDialog.tsx` (ikoner + kamera-fix), `LearningModeSelector.tsx`/`PresentationModeSelector.tsx` (lugnare ikoner), nya `KnowledgeTestBanner.tsx` + `QuickAssessmentDialog.tsx`, hjälp-texter i strict/flow-toggle.
- **Backend:** migration som lägger `knowledge_test_completed_at` på `speeches` (med GRANT + RLS-policy uppdatering).
- **Native:** `@capacitor/camera` installeras för native-fallback i kamera-scannen.
- **i18n:** komplettera `upload.stageDirections.tip`, `beat_practice.coffee_tip` samt nya nycklar för snabbtest och utökade hjälp-texter i alla 7 språk (en, sv, de, fr, es, it, pt).
- **Inline-messages:** kamera-fel och test-resultat visas via nya `InlineMessages`-systemet, inga toasts.

Inga ändringar i övrig inlärningslogik, spaced repetition eller mastery-beräkning.