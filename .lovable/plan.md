# Läget "Generell översikt" – gör det verkligt och rent

## Vad som gäller idag

Steget "Hur vill du lära dig talet?" sparar valet som `learning_mode` på talet
(`word_by_word` eller `general_overview`). Valet skrivs till databasen och går att
ändra i efterhand, men ingen del av övningen läser det: all träning körs alltid
ord-för-ord med progressiv ordgömning. "Generell översikt" är alltså i praktiken
bara en etikett just nu.

Beskrivningen som visas ("Lär dig innehåll och flöde med nyckelord, siffror &
fraser") behålls enligt önskemål – det är beteendet bakom som byggs.

## Vad som byggs

### 1. Generell översikt får egen träningslogik

När ett tal har `learning_mode = general_overview`:

- **Nyckelord istället för alla ord**: i varje beat markeras bärande ord
  (substantiv, namn, siffror, fackord) som nyckelord. Övningen kräver bara att
  dessa sägs – fyllnadsord och böjningar räknas alltid som klarade.
- **Mjukare matchning**: matchningströskeln sänks och synonym-/omformulerings-
  tolerans höjs, så man kan säga samma sak med egna ord.
- **Ordgömning gömmer bara nyckelorden**: resten av texten står kvar som stöd,
  istället för att hela texten successivt försvinner.
- **Bemästrat = alla nyckelord täckta** i rätt ordning, inte exakt formulering.
- Analys och feedback efter passet bedömer täckning av nyckelord och struktur,
  inte ordagrannhet.

Ord-för-ord-läget fungerar exakt som idag och påverkas inte.

### 2. Valsteget görs Duolingo-rent

- Två stora, luftiga kort med tydlig ikon, kort rubrik och nuvarande beskrivning.
- Ett tydligt aktivt tillstånd (färgad ram, bock, mjuk skala) och taktil feedback.
- Bort med extra hjälp-ikoner och dubbla förklaringslager – ett kort, en mening.
- Samma kortdesign används både vid skapande och vid redigering i efterhand,
  så det ser identiskt ut på båda ställena.
- Ingen ny text skrivs; befintliga översättningar återanvänds på alla sju språk.

## Teknisk sammanfattning

- `learning_mode` läses in i praktikflödet (`src/pages/Practice.tsx`) och skickas
  vidare till beat-vyn.
- `src/components/BeatPracticeView.tsx` får ett översiktsläge: nyckelordsurval,
  sänkta matchningströsklar, nyckelordsbaserad gömning och mastery-villkor.
- Nyckelordsurvalet görs i en ny hjälpmodul (t.ex. `src/utils/keywordExtraction.ts`)
  med heuristik (versaler, siffror, ordlängd, stoppordslista per språk), så att
  inget extra AI-anrop behövs vid övning.
- Analyssteget (`supabase/functions/analyze-speech`) får läget som indata och
  betygsätter täckning istället för exakthet när översiktsläget är valt.
- `src/components/UploadSpeechDialog.tsx` och `src/components/LearningModeSelector.tsx`
  får den nya, förenklade kortdesignen (delad `Choice`-komponent).
