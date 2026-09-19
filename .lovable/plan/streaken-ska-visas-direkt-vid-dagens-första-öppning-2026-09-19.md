# Streaken ska visas direkt vid dagens första öppning

## Problem
Streak-popupen (elden med antal dagar) dyker inte upp direkt när appen öppnas första gången på dygnet – den kan dröja upp till en timme.

## Orsak (bekräftad i koden)
`checkStreak()` i `src/pages/Dashboard.tsx` körs bara en gång – när dashboarden monteras. I native-appen stängs appen sällan helt; den ligger kvar i minnet. När användaren öppnar den en ny dag **återställs inget** – dashboarden är redan monterad, så `checkStreak()` körs aldrig igen förrän appen startas om helt eller användaren navigerar bort och tillbaka. Därför "dröjer" streaken.

## Åtgärder

1. **Kör streak-kollen när appen kommer till förgrunden**
   - I `Dashboard.tsx`: lyssna på `document.visibilitychange` och `window.focus` (täcker både webbläsare och Capacitor native-app, där WebView får visibilitychange vid återupptagning).
   - När appen blir synlig: jämför dagens datum med `streak-last-shown-date` i localStorage. Ny dag → kör `checkStreak()` direkt.

2. **Datumkoll i lokal tid, omräknad varje gång**
   - `today` beräknas vid varje körning (redan så), men spärr-logiken flyttas så att en ny dag alltid triggar omkoll även om komponenten är kvar monterad.

3. **Visa streaken utan att vänta på övrig data**
   - `checkStreak()` körs redan parallellt med `loadSpeeches()` – säkerställ att den inte blockeras av session-väntan (`waitForStableSession` max 2,5 s) så popupen syns inom någon sekund efter att dashboarden syns.

4. **Bonusfix: lokalisera popupen**
   - `StreakCelebration.tsx` har hårdkodad engelska ("Day Streak!", "You're on fire!", "Yay!"). Ersätt med översättningsnycklar i alla sju språk (en, sv, de, fr, es, it, pt), i linje med appens regel om inga råa texter.

## Tekniska detaljer
- Fil: `src/pages/Dashboard.tsx` – nytt `useEffect` med `visibilitychange`/`focus`-lyssnare, cleanup vid unmount. Timers följer `ReturnType<typeof setTimeout>`-konventionen.
- Fil: `src/components/StreakCelebration.tsx` – `useTranslation()`, nya nycklar `streak.title`, `streak.subtitle`, `streak.button` i `src/i18n/locales/*.json`.
- Ingen backend-ändring. Ingen ändring av hur streaken räknas (konsekutiva dagar från `practice_sessions` + `presentation_sessions`).

## Verifiering
- Bygg grönt.
- Test: sätt `streak-last-shown-date` till igår i localStorage, ladda om → popup direkt. Simulera återupptagning (visibilitychange) → popup utan omladdning.
