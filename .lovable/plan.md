## Vad vi bygger

En ny "rekvisita-cue"-funktion: markera valfri textsekvens i ditt manus → liten popup där du skriver in cue (t.ex. "le", "skratta") → markerad text får en svag bakgrundsfärg. Under practice, när du läser den sekvensen, dyker cue:n upp ovanför manus i sin egen färg och försvinner när du passerat sekvensens slut.

Plus: en interaktiv guidad tour första gången användaren skapar/redigerar ett tal på enheten, som visar alla detaljer (standalone-app, markering med rekvisita, hidden words m.m.).

---

## 1. Syntax & datamodell

Vi inför en ny inline-syntax som lever bredvid `[brackets]`, `(parens)` och `-pause-`:

```
Tack alla {{le}}för att ni kom hit{{/}} ikväll.
```

- `{{cue}}…{{/}}` omsluter sekvensen som cue:n gäller för.
- Cue:n (`le`) visas ovanför manus medan ord-index ligger inom range.
- Den omslutna texten får en svag bakgrundsfärg i editor + practice (förstärks vid hover/klick i editorn).
- AI, röstigenkänning och rendering ignorerar markörerna (precis som stage directions).

Varför inline-tokens istället för separat metadata: håller manuset portabelt (kan kopieras, delas, redigeras manuellt), följer samma mönster som befintliga `[ ]` / `( )` / `-`.

---

## 2. Editor-upplevelse

I `UploadSpeechDialog` (skapa) och `SpeechDetail`/edit-textarea (redigera):

- Byt `<textarea>` mot en lättviktig `contenteditable`-yta som visar:
  - Vanlig text
  - `[hidden]` med subtil bracket-styling
  - `(direction)` italic
  - **NY:** `{{cue}}…{{/}}` med svag färgad bakgrund + liten cue-badge i marginalen
- När användaren markerar text (mouse/touch) visas en flytande knapp: "+ Lägg till rekvisita". Klick → popover med textfält → spara → omsluter selection med `{{cue}}…{{/}}`.
- Klick på en befintlig cue-highlight → bakgrunden förstärks + popover för redigera/ta bort. Dubbelklick = direktredigering.
- Pro-tip-bubbla visas alltid över editor-rutan: "💡 Tips: markera text för att lägga till rekvisita (le, skratta, paus…)".

---

## 3. Practice-upplevelse

I `BeatPracticeView` (och `StrictPresentationView`):

- Parse cues till `Map<wordIndex, { cue, startIdx, endIdx, color }>`.
- Den omslutna textsekvensen renderas med svag bakgrundsfärg (samma som i editorn) så användaren ser var cue:n är aktiv.
- När `currentWordIndex` är inom `[startIdx, endIdx]` → visa cue ovanför manus i en distinkt färg (t.ex. accent/orange, skiljd från stage-direction-primary). Fade ut när index passerar `endIdx`.
- Återanvänder `StageDirectionCue`-komponenten med en ny variant (`type: "prop"`) som styr färg.

Färger (semantiska tokens i `index.css`):
- `--prop-cue-bg`: mycket svag varm färg (ca 8% opacity)
- `--prop-cue-bg-strong`: vid hover/aktiv (ca 20%)
- `--prop-cue-fg`: cue-badge ovanför manus

---

## 4. Parser-uppdateringar

`src/utils/stageDirections.ts` (eller ny `src/utils/propCues.ts`):

- `tokenizeScript` lär sig `{{…}}…{{/}}`.
- `stripStageDirections` strippar även cue-markörerna men behåller den omslutna texten (så ord-index = visningsindex).
- Ny export: `extractPropCues(text) → { plainText, cues: Array<{cue, startWordIndex, endWordIndex}> }`.
- Befintliga konsumenter (`BeatPracticeView`, `StrictPresentationView`, AI-prompts, print) får cue-info gratis och kan välja att rendera eller ignorera.

---

## 5. Interaktiv första-gångs-tour

Ny komponent `FirstTimeCreateTour.tsx` som triggas första gången användaren öppnar editorn (kontrollerat via `localStorage.getItem("sermable.tour.create.v1")`):

Steg (klick "Nästa" mellan varje):
1. **Välkommen** – kort intro, "Här är några knep som gör Sermable kraftfullt."
2. **Hidden words `[ ]`** – animerar in `[exempel]` i ett demo-manus och visar hur det göms i practice.
3. **Stage directions `( )`** – animerar `(le)` italic ovanför.
4. **Rekvisita-cue (NY)** – animerar markering av text → popover → bakgrunden tonar in → cue dyker upp över manus.
5. **Pauser `-` / `-3s`** – mini-countdown-animation.
6. **Standalone-app** – kort om "lägg till på hemskärm för bästa upplevelse" (visas bara om inte redan installerad).
7. **Klart!** – CTA "Börja skapa ditt tal".

Tekniskt: full-screen modal med vänster: animerat demo-manus (egen mini-renderer), höger: text + Föregående/Nästa/Hoppa över. Spara `v1` i localStorage så framtida uppdateringar kan tvinga ny tour.

Lokaliseras till alla 7 språk.

---

## 6. Filer som ändras / skapas

**Nya:**
- `src/utils/propCues.ts` – parser + extraktion
- `src/components/PropCuePopover.tsx` – flytande "lägg till/redigera"-popover
- `src/components/RichScriptEditor.tsx` – contenteditable med highlight för `[ ]`, `( )`, `{{ }}`
- `src/components/FirstTimeCreateTour.tsx` – guidad tour
- `src/components/PropCueOverlay.tsx` – cue-badge ovanför manus (kan också byggas in i StageDirectionCue)

**Ändras:**
- `src/utils/stageDirections.ts` – samexistens med cues
- `src/components/BeatPracticeView.tsx` – rendera bakgrundsfärg + active prop cue
- `src/components/StrictPresentationView.tsx` – samma
- `src/components/UploadSpeechDialog.tsx` – byt textarea → RichScriptEditor, trigga tour
- `src/pages/SpeechDetail.tsx` – samma i edit-läge
- `src/index.css` – nya färgtokens
- `src/i18n/locales/*.json` – nya nycklar (tour-steg, pro-tip, popover-knappar)

**AI/edge functions:** ingen ändring – `stripStageDirections` strippar redan cue-markörerna innan text går till AI.

---

## 7. Validering

- Bygget grönt
- Manuell test: skapa tal → markera "för att ni kom" → skriv "le" → highlight syns → practice → cue "le" dyker upp ovanför manus när du läser sekvensen, försvinner efter
- Tour visas en gång, går att hoppa över, dyker inte upp igen
- Befintliga `[ ]`, `( )`, `-` fortsätter fungera oförändrat

---

## 8. Frågor innan jag bygger

Är ovan OK? Specifikt:
1. Syntax-valet `{{cue}}…{{/}}` — ok, eller vill du ha annat (t.ex. `«cue»…«»`)?
2. Tour-trigger: första gången editorn öppnas (mitt förslag) — eller hellre direkt efter onboarding innan första talet skapas?

Säg "kör" så bygger jag.