# Plan: Djurvyn — tryckfel + sötare djur

## Problemen
1. **Tryck på djuret stänger vyn.** Djuröverlägget är genomskinligt för tryck (`pointer-events-none`), så ett tryck på djuret träffar orden bakom. Ett ord "tittas fram", villkoret "alla ord dolda" bryts och hela djurvyn försvinner — användaren hamnar tillbaka i vanliga övningen.
2. **Djuren ser fula ut.** Nuvarande SVG-figurer är grova och obalanserade.

## Åtgärder

### 1. Stoppa tryck-genomsläpp
- Gör djuröverläggets behållare tryckblockerande (`pointer-events-auto` på hela ytan) så att tryck aldrig når övningsorden bakom. Stängknappen uppe till höger fungerar som idag — det blir enda sättet att lämna vyn.
- Ingen ändring av övningslogiken; vyn försvinner bara när den ska (mening klar eller aktiv exit).

### 2. Sötare djur (behåll alla sex: räv, kanin, groda, katt, björn, uggla)
- Ritar om SVG-figurerna: rundare kroppsformer, större huvud/kropp-kvot, större uttrycksfulla ögon med glans, mjukare munnar, sammetslena färgtoner som matchar appens varma amber-tema.
- Behåller befintligt beteende: ett djur åt gången i helskärm, humör som blir gladare ju fler ord som sägs rätt, jubel med konfetti vid klarad mening, instruktionsrutan och framstegslisten.
- Behåller rotationen av djur mellan beats.

### 3. Verifiering
- Fota djurvyn i mobilvy och kontrollera utseendet på minst två djur (vanligt + jublande läge).
- Bekräfta att tryck på djuret inte längre stänger vyn.

## Tekniskt
- `src/components/AnimalAudience.tsx` — pointer-events-fix på rotelementet; omarbetade SVG-djur (samma komponentgränssnitt).
- Inga ändringar i `BeatPracticeView.tsx` eller databas.
