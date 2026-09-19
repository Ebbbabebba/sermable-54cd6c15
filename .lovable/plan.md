# Fix: inputfält sticker utanför skärmen på iOS

## Mål
Inga textfält eller inmatningsrutor ska sticka utanför skärmkanten i iOS-appen, och layouten ska inte hoppa till när man trycker i ett fält.

## Orsaker som hittats
1. **iOS auto-zoom**: Textarea använder `text-sm` (14px). På iOS zoomar skärmen automatiskt in vid fokus i fält med mindre än 16px text — när man lämnar fältet står layouten kvar förskjuten och element "sticker ut".
2. **`w-screen` i AI-dialogen**: `AiSpeechBuilderDialog` använder `w-screen` (100vw), som på iOS kan bli bredare än den synliga skärmen när verktygsfält/safe-area räknas in.
3. **Fasta min-bredder i flexrader**: t.ex. `min-w-32`-knappar och fält utan `min-w-0` kan tvinga raden bredare än skärmen.

## Åtgärder
1. **src/components/ui/textarea.tsx** — byt `text-sm` till `text-base` (16px) på mobil, behåll `md:text-sm` på större skärmar. Då försvinner iOS auto-zoom.
2. **Granska alla inmatningsfält** (`Input`, `PropCueTextarea`, lösenords-/e-postfält i Auth, ResetPassword, AccountSettings, UploadSpeechDialog, AiSpeechBuilderDialog) och säkerställ minst 16px textstorlek på mobil.
3. **src/components/AiSpeechBuilderDialog.tsx** — byt `w-screen` mot `w-full max-w-[100dvw]` så dialogen aldrig blir bredare än skärmen.
4. **Flexrader med fält** — lägg till `min-w-0` på fältets omslutande element där det saknas (t.ex. UploadSpeechDialog:s knapp- och fältrad), så innehållet krymper istället för att trycka ut sidan.
5. **Global spärr i src/index.css** — `input, textarea, select { max-width: 100%; }` som extra skydd.

## Verifiering
- Bygglogg ren.
- Playwright i mobilt viewport (390px) mot Auth, ResetPassword och dashboard-dialoger: inget horisontellt scroll/överflöd (`scrollWidth <= clientWidth`).
