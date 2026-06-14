# Mer förlåtande röstigenkänning

## Mål
- Synliga ord: accepteras nästan så fort du säger något som börjar likt — inte vänta på perfekt match.
- Dolda ord: samma förlåtande tröskel — bara helt fel ord eller tystnad ska ge röd/gul.
- Snabb eller långsam talhastighet ska fungera lika bra.

## Vad ändras (frontend, `src/pages/Practice.tsx`)

### 1. `areWordsSimilar()` — lättare matchning (rad 968–994)
Idag: 1–3 tecken kräver exakt match; 4–5 tecken max 1 fel; långa ord kräver 70% längd.
Nytt:
- **Prefix-träff**: om talat ord = första 2+ tecken av förväntat ord (eller tvärtom), räknas det som match. Det fångar "demo" → "demokrati", "kapt" → "kapten" som Whisper/Web Speech ofta klipper.
- **Ljudlik start**: matcha på första 3 tecken efter normalisering (ta bort 'h', dubbletter) — fångar "phon" ≈ "fon".
- **Levenshtein**: tillåt 1 fel även för 3-bokstavsord, 2 fel för 4–6, 3 fel för 7+.
- Längd-spärren (`< 70%`) tas bort — ersätts av prefix-regeln.
- Behåll skydd: helt olika första bokstav + ingen prefix-träff = ingen match.

### 2. Synligt ord = hoppa fram på minsta yttrande
För ord där `currentHiddenIndices.has(i) === false` (synliga ord):
- Om någon röst-aktivitet kommer in inom ordets fönster, behandla även en lös delträff som korrekt — auto-fade vid t.ex. första stavelsen.
- `isHardToRecognizeWord`-logiken (utils/wordRecognition.ts) utökas till att också gälla synliga ord generellt: vid synligt ord auto-accepteras vid ≥1 talat tecken som matchar början.

### 3. Dolda ord — bara fel på riktigt fel
- Behåll dagens logik men höj acceptanskravet så att även dolda ord får prefix-/Levenshtein-toleransen från (1).
- Endast två orsaker till röd-markering:
  - Look-ahead hittar ett senare ord (= användaren hoppade över) **och** ordet var dolt.
  - Tystnad längre än adaptiv hesitationströskel (redan implementerat).

### 4. Talhastighet — bredare adaptiv tröskel (`useAdaptiveTempo.ts`)
- Sänk `CALIBRATION_WORDS` 10 → 5 så systemet anpassar sig snabbare.
- Höj övre clamp 5000 → 7000 ms för långsamma talare.
- Sänk nedre clamp 300 → 200 ms för snabba talare.
- Multiplikator för långa ord 1.3 → 1.5; korta ord 0.8 → 0.7.
- Lägg till "burst-läge": om de 3 senaste intervallen alla < 300 ms, sänk tröskeln till median × 1.2 så snabba sjok inte stoppar upp.

### 5. Look-ahead vid mismatch (rad 1106–1154)
- Öka `maxLookAhead` från 5 → 8 för långa snabba meningar.
- Använd den nya förlåtande `areWordsSimilar` även här (redan gör det, men nya regler gäller automatiskt).

### 6. Konstant timeout-recovery
Behåll dagens 6 s "yellow timeout" för stillastående ord (memory: Yellow Timeout).

## Filer som rörs
- `src/pages/Practice.tsx` — `areWordsSimilar`, synligt-ord-acceptans, look-ahead.
- `src/hooks/useAdaptiveTempo.ts` — kalibrering, clamps, burst-läge.
- `src/utils/wordRecognition.ts` — utöka prefix-/start-matchning.

## Inget ändras
- UI/layout, design tokens, översättningar.
- Backend/edge functions.
- Mastery/spaced repetition-regler.

## Test
1. Säg bara första stavelsen av varje ord — alla synliga ord ska fade till grått.
2. Prata extremt fort 3–4 ord i rad — inga gula markeringar.
3. Prata extremt långsamt (≈1 ord/3 s) efter 10 ords kalibrering — inga gula så länge du faktiskt säger ordet.
4. Säg ett helt fel ord på en dold position — markeras rött (oförändrat beteende).
