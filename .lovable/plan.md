## What's happening

På `sentence_2_learning` syns ord redan "spoken" och meningen markeras som avklarad innan användaren hunnit prata. När jag spårar logiken hittar jag två konkreta orsaker:

1. **Resultatindex-gaten nollställs felaktigt vid fas-byte.** `resetForNextRep` sätter `ignoreResultsBeforeIndexRef.current = 0`. Speech-engine-objektet aborteras aldrig (medvetet, för att undvika iOS-mic-pinget), så `event.results`-arrayen innehåller fortfarande alla tidigare slutförda resultat från mening 1. När nästa `onresult` triggas itereras hela arrayen igen från index 0 och mening 1:s text spelas upp i `runningTranscriptRef`. Den texten råkar matcha tillräckligt många stoppord i mening 2 ("och", "att", "är", "som"…) → alla index markeras spoken → `checkCompletion` triggar.

2. **`requiredLearningReps = 1` ger noll marginal.** Så fort `checkCompletion` säger "alla spoken" går vi direkt till `sentence_2_fading` på nästa rep, och `handleFadingCompletion` döljer 3 ord. Det är de gömda orden användaren ser. En enda läcka räcker för att lägga vyn i fading.

## Fix

**`src/components/BeatPracticeView.tsx`**

1. I `transitionToPhase` (efter den synkrona ref-resetten): bumpa `ignoreResultsBeforeIndexRef.current = latestSpeechResultCountRef.current` så att alla gamla resultat-index från mening 1 hoppas över av `onresult`-loopen. Detta är säkerhetsbältet mot återinspelning av stale `event.results`.

2. Lägg till en `phaseEpochRef = useRef(0)` som incrementeras i `transitionToPhase`. Skicka in epoch i `processTranscription`-anropet från `recognition.onresult` (vid sidan av `repId`) och returnera tidigt om epoch inte matchar. Samma gate i `checkCompletion` (jämför mot epoch fångad vid call-entry). Detta säkerställer att ingen callback som var i flight under övergången kan röra mening 2.

3. I `resetForNextRep`: ta bort raden `ignoreResultsBeforeIndexRef.current = 0`. Denna nolla bara behövs vid första start; mellan reps räcker `repetitionIdRef`-gaten. Att alltid nolla den är det som öppnar dörren för stale resultat.

4. Höj `requiredLearningReps` från `1` → `2` ENBART vid övergång till andra meningen och framåt (sentence_2_learning, sentence_3_learning, sentences_1_2_learning, beat_learning). Mening 1 (allra första intrycket) behåller 1 rep så användaren snabbt kommer igång. Detta ger ett skyddsnät: även om en läcka skulle smita igenom punkterna ovan så krävs två kompletta genomläsningar innan fading kickar in — en stale-pseudo-rep ger då bara "1/2" och nästa riktiga läsning startar från noll.

## Verification

Efter implementation: be användaren testa mening 2 igen. Förväntat:
- När övergångs-animationen ("Now let's combine them") försvinner är hela mening 2 synlig, inga gråa ord.
- Räknaren visar `Read aloud 1/2`. Inget händer förrän de börjar prata.
- Efter två fullständiga genomläsningar går vi till `sentence_2_fading` och då (och först då) börjar ord döljas i grupper om 3.

Inga ändringar i datamodell, edge functions eller andra vyer.
