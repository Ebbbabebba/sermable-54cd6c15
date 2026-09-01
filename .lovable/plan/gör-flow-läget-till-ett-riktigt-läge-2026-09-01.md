# Gör Flow-läget till ett riktigt läge

## Så fungerar Flow idag (verifierat i koden)

Flow läses in per tal (`practice_strictness`) och används på exakt **ett** ställe i övningen: ordmatchningen blir något mildare (tillåter lite större längdvariation och ett extra teckenfel). Allt annat är identiskt med Strict:

- Dolda ord kan **inte** hoppas över. Look-ahead ("du sa nästa ord") gäller bara synliga ord, så om du parafraserar eller hoppar över ett dolt ord fastnar markören tills tvekan-timern avslöjar ordet och färgar det gult/rött.
- Godkänt är **nolltolerans**: en mening räknas som ren först om inga ord är gula eller röda. Ett enda missat ord = misslyckad omgång, även i Flow.
- Repetitionsspärren kräver att 60 % (inläsning) respektive 40 % (fading) av orden matchats från färsk röstinmatning.
- I återkallning demoteras du vid >20 % fel (1 steg) och >50 % (2 steg) — samma i båda lägena.

AI-analysen efteråt har däremot korrekt flow-instruktion (betygsätter mening, inte ordalydelse). Så det som inte fungerar är **realtidsdelen**.

## Vad som ändras

### 1. Flow tillåter att man hoppar förbi dolda ord
I Flow får look-ahead även passera dolda ord (upp till 2 ord framåt, aldrig över menings- eller pausgräns). Då fastnar man inte när man parafraserar.

### 2. "Tillräckligt godkänt" blir en tröskel istället för nolltolerans
I Flow räknas en mening/beat som godkänd när **minst 85 % av de dolda målorden** träffats och inga två fel ligger i rad. Under 85 % = omgången misslyckas som idag.

- Strict: oförändrat, 100 % (nolltolerans).
- Flow: ≥85 % av dolda ord → godkänt och fortsatt progression.
- Bindeord/småord (artiklar, prepositioner) räknas aldrig som fel i Flow.

### 3. Mildare tvekan och spärrar i Flow
- Tvekan-timern får +1 s marginal innan ett dolt ord blir gult.
- Färskhetskravet sänks till 50 % (inläsning) / 30 % (fading), så naturligt tempo inte blockerar avslut.
- Demotering i återkallning sker först vid >35 % fel (1 steg) respektive >60 % (2 steg).

### 4. Tydlighet i gränssnittet
Kort förklaring under lägesvalet: Strict = ordagrant, Flow = godkänt när innehållet kommer med (~85 %). Lokaliseras till alla sju språk.

## Teknisk detalj

- `src/components/BeatPracticeView.tsx`: look-ahead-villkoret `canSkipCurrent` utökas för Flow; ny hjälpfunktion `isRepPassable(failedSet, hiddenSet)` som ersätter `hadErrors = failedSet.size > 0` i `handleFadingCompletion`-anropet; färskhetskvoter och demoteringströsklar villkoras på `practiceStrictness`.
- `src/lib/practicePrefs.ts`: `getHesitationThresholdMs` får en flow-marginal.
- `src/i18n/locales/*.json`: uppdaterade beskrivningar för strict/flow.
- Ingen databasändring behövs — `practice_strictness` finns redan.
