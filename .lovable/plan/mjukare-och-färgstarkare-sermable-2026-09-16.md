# Mjukare och färgstarkare Sermable

## Mål
Göra appens viktigaste vyer lugnare, mer sammanhållna och lekfulla enligt den valda gröna riktningen, utan att ändra hur träningen fungerar.

## Det som byggs
- Byt appens standardaccent från indigo till en frisk grön huvudfärg, med blått, gult och korall för tydliga statuslägen.
- Förfina dashboarden med stabilare mått, tydligare hierarki, taktila knappar, färgstarkare framsteg och mjukare kortövergångar.
- Ersätt tomma laddningsskärmar med ett gemensamt laddningsläge: ett vänligt animerat djur ovanför en lokaliserad “Visste du att”-ruta.
- Visa faktarutan efter en kort väntan så snabba laddningar inte blinkar till, och håll laddningsytans storlek stabil för att undvika hopp.
- Använd samma mjuka in-/utgångar för sidladdning och centrala väntelägen, med reducerad rörelse när enheten föredrar det.
- Behåll befintliga tal, deadlines, sortering, inställningar och övningsflöden oförändrade.

## Teknisk inriktning
- Utgå från befintliga semantiska färgtokens och delade knapp-/kortstilar.
- Återanvänd en lätt SVG-karaktär i stället för tung bild eller 3D i laddningsläget.
- Undvik avsiktligt längre väntetid; gör verklig väntan mer behaglig utan att sakta ned appen.
- Lägg laddningstexter i alla sju språk och använd appens aktuella språk.
- Kontrollera dashboard och laddningsläge i mobil och desktop samt verifiera fel- och bygglogg.
