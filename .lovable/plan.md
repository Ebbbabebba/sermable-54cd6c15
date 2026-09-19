# Genomgång av presentationslägena

Jag körde igenom talet i appen i mobilformat och testade alla tre lägen. Alla tre startar utan fel, men det finns tydliga problem: ett läge sparar inte resultatet, ett läge räknar fel på texten, och en stor del av koden bakom är oanvänd.

## Vad jag hittade

**Helt tal (Whole Speech)** — fungerar bäst. Manus visas, ord dimmas, ledtrådar kommer vid tvekan, och resultatet analyseras och sparas.
Problem: kugghjulet i inställningarna har en textstorleks-inställning som inte gör någonting, och ordräkningen i startrutan räknar annorlunda än själva övningen.

**Lyssna-läget** — ser bra ut, men:
- Resultatet sparas aldrig. Du får en sammanfattning på skärmen, men den försvinner och finns inte i historiken, till skillnad från de andra lägena.
- Rekvisita- och scenmarkeringar (t.ex. `{{skratta}}` och `(vinka)`) räknas som ord du måste säga. Det gör att läget tror att du hoppar över ord, ger onödiga ledtrådar och räknar fel procent.
- Sammanfattningstexten visas alltid på engelska, även i svenska appen.
- Färre språk stöds här än i övriga lägen.

**Manusläget (Script Mode)** — fungerar, men överlappar delvis med den vanliga övningen (läs beat, återberätta). Det behöver inte tas bort, men förtjänar en tydligare beskrivning så man förstår när det ska användas.

**Osynliga/döda delar** — en "publikvy" i 3D finns kvar i koden men går inte att nå, en gammal kopia av hela helskärmsläget ligger kvar oanvänd, och två alternativa skärmlayouter (kompakt/klocka) kan aldrig visas.

## Förslag

1. **Slå ihop Lyssna-läget med Helt tal.** I stället för tre kort blir det två: "Helt tal" och "Manusläge". I Helt tal väljer du före start om manus ska visas (teleprompter) eller vara dolt (lyssna-varianten). Samma motor, samma analys, samma sparade resultat — ett läge mindre att förstå och underhålla.
2. **Fixa textrensningen** så rekvisita och scenanvisningar aldrig räknas som ord, oavsett variant.
3. **Spara alla körningar** så att även den dolda varianten får AI-analys och hamnar i historiken.
4. **Översätt** alla texter i lägena till alla sju språk.
5. **Rensa bort** publikvyn i 3D, den gamla dubbletten av helskärmsläget, klock-/kompaktlayouterna och inställningar som inte gör något (textstorlek).
6. **Tydligare val-skärm:** kortare beskrivningar, "rekommenderat" på Helt tal, och en rad som förklarar vad man tränar i varje läge.

## Teknisk detalj

- `Presentation.tsx`: ta bort `selectedMode: 'audience'`, `viewMode`, `handleAudienceModeSelect`, `handleOverviewModeSelect`, `currentWordPerformance` och den oanvända MediaRecorder/Whisper-vägen om den inte längre behövs; `handleStartPresentation` har en timer-bugg (`Date.now() - Date.now()`).
- Nytt: `scriptVisible`-flagga skickas till `CompactPresentationView`; den dolda varianten renderas av samma komponent (tomt textlager + hint-eskalering) i stället för `ListenMode.tsx`.
- `ListenMode.tsx` avvecklas när hint-eskaleringen (HINT_STAGE_1..3) flyttats in i `CompactPresentationView`; dess resultat går genom `handlePerformanceData` → `analyze-presentation` → `presentation_sessions`.
- Radera `StrictPresentationView.tsx` och de döda `compact`/`wearable`-grenarna i `WearableHUD.tsx`; lämna `audience/`-mappen borttagen från bundlen.
- Bryt ut gemensam `getRecognitionLanguage`/`normalizeWord` till `src/utils/wordRecognition.ts` så språkkartan finns på ett ställe.
- Lägg till saknade nycklar (`listenMode.*`, nya lägesbeskrivningar) i alla sju locale-filer; ta bort hårdkodade `defaultValue`-strängar.
