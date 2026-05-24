## Plan

Jag fixar `BeatPracticeView.tsx` där sentence 2 fortfarande kan auto-kompletteras av gamla/stale speech-resultat.

### Ändringar

1. **Gör completion epoch-säker**
   - Låt `checkCompletion` ta emot den `phaseEpoch` som gällde när transkriberingen startade.
   - Avbryt completion om fasen hunnit bytas eller om callbacken tillhör en gammal repetition.
   - Uppdatera alla `checkCompletion(...)`-anrop som kommer från speech/pause/timeout/skip så de inte kan trigga fel fas.

2. **Flytta spoken-state före completion**
   - När `processTranscription` når slutet av sentence 2 uppdateras `spokenIndicesRef` och UI-state innan `checkCompletion` körs.
   - Det tar bort race där completion körs på en lokal `Set` medan ref/UI fortfarande ligger i föregående state.

3. **Rensa Web Speech-buffer hårdare vid fasbyte**
   - I `transitionToPhase`, efter `resetForNextRep`, nollställ `ignoreResultsBeforeIndexRef` till senast kända `event.results.length` igen.
   - Detta behövs eftersom `resetForNextRep` höjer `repetitionId` men Web Speech kan ändå leverera gamla final/interim chunks i nästa tick.

4. **Blockera första auto-completion i sentence 2 tills ny speech faktiskt hörts**
   - Introducera en ref som kräver fresh speech efter varje fasbyte innan en learning-phase får räknas som komplett.
   - Det betyder: sentence 2 kan inte gå från helt synlig till färdig bara av gamla transcript tokens.

### Förväntat resultat

- Vid sentence 2 startar alla ord synliga.
- Den hoppar inte över hela meningen innan du pratar.
- Efter första riktiga genomläsningen visar den `1/2`.
- Först efter andra riktiga genomläsningen går den vidare till fading.