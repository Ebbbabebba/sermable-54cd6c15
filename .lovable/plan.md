# Tydligare steg: "mening 1 + 2 tillsammans"

## Vad som händer idag

När du klarat mening 2 går övningen vidare till ett hopkörningssteg där mening 1 och 2 tränas i följd. Mening 1 ligger då redan dold, så skärmen börjar om från talets första ord — det ser ut som att appen hoppat tillbaka. Övergångstexten säger bara "Nu kör vi ihop dem!" i en knapp sekund, utan att förklara vad som ska hända.

## Vad som ändras

Steget behålls (det tränar övergången mellan meningarna), men blir tydligt:

1. **Tydligare övergångsruta.** Innan hopkörningen startar visas en förklarande text: rubrik "Mening 1 + 2 tillsammans" och en rad som säger att du nu ska säga båda meningarna i följd, från början, ur minnet.
2. **Tydlig rubrik under passet.** Rubriken överst visar "Mening 1 + 2" respektive "Mening 1 + 2 · utan manus" — idag står det redan så på svenska via en nyckel, men sifferindikatorn visar fortfarande "2", vilket ändras till "1 + 2".
3. **Kort etikett på själva sidan.** En diskret rad ovanför texten under hopkörningssteget: "Från början — båda meningarna".
4. Samma tydlighet läggs på slutsteget "hela stycket" så att det inte heller upplevs som ett hopp bakåt.

Inget ändras i inlärningslogiken: samma antal repetitioner, samma orddöljning, samma schemaläggning.

## Tekniska detaljer

- `src/components/BeatPracticeView.tsx`
  - `showSentenceCelebration()`: vid `sentence_2_fading` sätts både rubrik- och förklaringstext (nytt state för underrubrik i firande-rutan) i stället för bara ett kort meddelande; samma för `sentence_3_fading` → helt stycke.
  - `getCurrentSentenceNumber()`: returnera en indikator för kombinationsfaserna i stället för `2`, så stegräknaren inte ser ut att stå still.
  - `getProgressInfo()`: oförändrad logik, men kombinationsfasen får en egen kort sidoetikett som renderas ovanför texten.
- Nya i18n-nycklar i `src/i18n/locales/{en,sv,de,fr,es,it,pt}.json` under `beat_practice`: `combine_title`, `combine_explainer`, `combine_from_start`, `full_beat_title`, `full_beat_explainer`. Inga hårdkodade strängar i UI.
- Firande-rutans layout behåller nuvarande rundade stil; bara en extra textrad tillkommer.
