# Optimera inlärningsperioden fram till deadline

Jag körde igenom ett tal med 12 avsnitt och deadline om 14 dagar, med den nya repetitionsstegen (10 min → 1 → 3 → 7 → 14 → 30 dagar). Stegen i sig fungerar nu. Men själva *perioden* har tre svagheter.

## Vad simuleringen visade

```text
dag  0: 1 nytt,  0 repetitioner
dag  4: 1 nytt,  2 repetitioner
dag  8: 1 nytt,  6 repetitioner
dag 11: 1 nytt, 11 repetitioner   <- hela talet setts först nu
dag 12: 0 nya,  12 repetitioner
dag 14: 0 nya,  12 repetitioner   <- framträdandet
```

### 1. Talets slut hinner aldrig sätta sig
Appen lär ut ett nytt avsnitt per dag så länge det "finns gott om tid". Med 12 avsnitt och 14 dagar betyder det att sista avsnittet ses först dag 11 och hinner repeteras tre gånger. Talets avslutning – det publiken minns bäst – blir den svagaste delen.

### 2. Arbetsbördan är extremt ojämn
Första veckan: två-tre korta repetitioner om dagen. Sista veckan: tolv. Det är omvänt mot hur det borde kännas, och risken är att man ger upp precis när det gäller.

### 3. Ingen planerad genomkörning av hela talet
Hela talet körs bara igenom som en bieffekt av att avsnitten råkar bli klara, inte som ett inplanerat moment. Man kan komma till framträdandet med alla avsnitt gröna utan att en enda gång ha framfört talet från början till slut.

## Vad jag vill ändra

**A. Inlärningstakten anpassas efter deadline, inte efter "ett om dagen".**
Alla avsnitt ska vara introducerade när ungefär 60 % av tiden gått, så att resten av perioden är ren repetition. Med 12 avsnitt och 14 dagar blir det cirka två nya avsnitt om dagen den första veckan.

**B. Jämn daglig arbetsbörda.**
Ett tak för hur många repetitioner en dag får innehålla. Överskjutande avsnitt flyttas till dagen efter, de mest bräckliga först. Dagar som blir tomma fylls i stället med ett tidigarelagt avsnitt, så att man aldrig har en dag helt utan övning.

**C. Talets slut prioriteras.**
Avsnitt i den sista tredjedelen av talet får en extra repetition tidigt, och inlärningen börjar omväxlande från början och från slutet i stället för strikt kronologiskt.

**D. Planerade helgenomkörningar.**
Hela talet körs igenom som ett inplanerat moment vid halva perioden, tre dagar före deadline, dagen före, och på morgonen samma dag. De syns i planeringen och ger notis.

**E. Tydlig plan i appen.**
På talets sida visas vad perioden består av: "Inlärning till den 24:e, sedan repetition, genrep den 30:e." I dag ser man bara nästa repetition.

## Teknisk sammanfattning

- `calculateBeatsPerDay` i `src/components/BeatPracticeView.tsx` (rad 411) byts från "1 per dag när det finns tid" till `ceil(kvarvarande avsnitt / (dagar till deadline * 0.6))`, min 1.
- Ny daglig kö-logik: repetitioner sorteras på förfallotid och bräcklighet, kapas till ett tak (härlett ur talets längd, t.ex. max ~8 avsnitt/pass) och överskjutande skjuts en dag framåt via `next_scheduled_recall_at`.
- Underfyllda dagar drar in nästa avsnitt tidigt (motsvarande Ankis "load balancer").
- Introduktionsordningen varvar början och slut i stället för `beat_order` stigande.
- Helgenomkörningar skrivs som rader i `speech_calendar_events` (`event_type: 'full_runthrough'`) vid 50 % av perioden, D-3, D-1 och D-morgon; de plockas upp av den befintliga notisfunktionen.
- Talsidan (`src/pages/SpeechDetail.tsx`) får en kompakt fasöversikt: inlärningsfas, repetitionsfas, genrep, framträdande.
- Ny text i alla sju språkfiler.
