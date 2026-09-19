import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

interface LoadingOverlayProps {
  isVisible: boolean;
}

type SupportedLanguage = "en" | "sv" | "de" | "fr" | "es" | "it" | "pt";

const loadingCopy: Record<SupportedLanguage, { label: string; status: string; facts: string[] }> = {
  en: {
    label: "Did you know?",
    status: "Preparing your speech…",
    facts: [
      "Saying a text aloud creates stronger memory traces than reading silently.",
      "Short, spaced practice sessions help memories last much longer.",
      "Sleep helps your brain consolidate what you practiced today.",
      "Your brain treats a well-rehearsed speech like a familiar song.",
      "Forgetting a little between sessions actually makes learning stick better.",
      "Teaching what you've learned to someone else deepens your own memory.",
      "Chunking information into small groups is how memory champions remember speeches.",
      "Movement while practicing can make words easier to recall later.",
      "Vivid mental images turn abstract lines into memorable scenes.",
      "Recalling just before you forget builds the strongest memory paths.",
    ],
  },
  sv: {
    label: "Visste du att?",
    status: "Förbereder ditt tal…",
    facts: [
      "Att säga texten högt skapar starkare minnesspår än tyst läsning.",
      "Korta övningar med mellanrum hjälper minnet att hålla längre.",
      "Sömn hjälper hjärnan att befästa det du har övat på idag.",
      "Hjärnan hanterar ett välrepeterat tal som en välbekant melodi.",
      "Att glömma lite mellan passen gör faktiskt inlärningen starkare.",
      "Att förklara något för någon annan gör ditt eget minne djupare.",
      "Minnesmästare delar upp information i små grupper för att lära sig tal.",
      "Att röra på sig medan du övar gör orden lättare att komma ihåg.",
      "Tydliga bilder i huvudet gör abstrakta meningar lättare att minnas.",
      "Att repetera precis innan du glömmer bygger de starkaste minnesbanorna.",
    ],
  },
  de: {
    label: "Schon gewusst?",
    status: "Dein Referat wird vorbereitet…",
    facts: [
      "Lautes Sprechen stärkt mehr Gedächtniswege als stilles Lesen.",
      "Kurze Übungen mit Pausen helfen Erinnerungen länger zu halten.",
      "Schlaf hilft deinem Gehirn, das heute Gelernte zu festigen.",
      "Dein Gehirn speichert ein gut eingeübtes Referat wie einen bekannten Song.",
      "Ein bisschen Vergessen zwischen den Sitzungen macht das Lernen fester.",
      "Wenn du etwas anderen erklärst, vertiefst du auch dein eigenes Gedächtnis.",
      "Gedächtnismeister teilen Reden in kleine Gruppen ein, um sie zu lernen.",
      "Bewegung beim Üben macht Wörter später leichter abrufbar.",
      "Lebhafte Bilder im Kopf verwandeln abstrakte Sätze in merkbare Szenen.",
      "Wiederholung kurz bevor du vergisst, baut die stärksten Gedächtnispfade.",
    ],
  },
  fr: {
    label: "Le saviez-vous ?",
    status: "Préparation de ton discours…",
    facts: [
      "Dire un texte à voix haute renforce davantage la mémoire que la lecture silencieuse.",
      "Des séances courtes et espacées aident les souvenirs à durer.",
      "Le sommeil aide votre cerveau à consolider ce que vous avez appris aujourd’hui.",
      "Votre cerveau traite un discours bien répété comme une chanson familière.",
      "Oublier un peu entre les séances rend l’apprentissage plus solide.",
      "Expliquer quelque chose à quelqu’un d’autre renforce votre propre mémoire.",
      "Les champions de mémoire divisent les discours en petits groupes pour les apprendre.",
      "Bouger pendant l’entraînement rend les mots plus faciles à retrouver.",
      "Des images vives transforment les phrases abstraites en scènes mémorables.",
      "Se souvenir juste avant d’oublier construit les meilleurs chemins de mémoire.",
    ],
  },
  es: {
    label: "¿Sabías que?",
    status: "Preparando tu discurso…",
    facts: [
      "Decir un texto en voz alta refuerza más vías de memoria que leer en silencio.",
      "Las prácticas cortas y espaciadas ayudan a recordar durante más tiempo.",
      "Dormir ayuda al cerebro a consolidar lo que has practicado hoy.",
      "Tu cerebro guarda un discurso bien ensayado como una canción conocida.",
      "Olvidar un poco entre sesiones hace que el aprendizaje sea más fuerte.",
      "Enseñar lo aprendido a otra persona profundiza tu propia memoria.",
      "Los campeones de la memoria dividen los discursos en pequeños grupos para aprenderlos.",
      "Moverse mientras practicas hace que las palabras sean más fáciles de recordar.",
      "Imágenes vívidas convierten frases abstractas en escenas memorables.",
      "Recordar justo antes de olvidar construye los caminos de memoria más fuertes.",
    ],
  },
  it: {
    label: "Lo sapevi?",
    status: "Preparazione del tuo discorso…",
    facts: [
      "Dire un testo ad alta voce rafforza più percorsi della memoria rispetto alla lettura silenziosa.",
      "Sessioni brevi e distanziate aiutano i ricordi a durare più a lungo.",
      "Il sonno aiuta il cervello a consolidare ciò che hai praticato oggi.",
      "Il tuo cervello tratta un discorso ben ripetuto come una canzone familiare.",
      "Dimenticare un po' tra le sessioni rende l'apprendimento più solido.",
      "Spiegare qualcosa a qualcun altro approfondisce la tua memoria.",
      "I campioni della memoria dividono i discorsi in piccoli gruppi per impararli.",
      "Muoversi durante la pratica rende le parole più facili da ricordare.",
      "Immagini vivide trasformano frasi astratte in scene memorabili.",
      "Ricordare poco prima di dimenticare costruisce i percorsi mnemonici più forti.",
    ],
  },
  pt: {
    label: "Sabias que?",
    status: "A preparar o teu discurso…",
    facts: [
      "Dizer um texto em voz alta fortalece mais caminhos da memória do que ler em silêncio.",
      "Sessões curtas e espaçadas ajudam as memórias a durar mais.",
      "O sono ajuda o cérebro a consolidar o que praticaste hoje.",
      "O teu cérebro guarda um discurso bem ensaiado como uma música conhecida.",
      "Esquecer um pouco entre sessões torna a aprendizagem mais forte.",
      "Ensinar o que aprendeste a outra pessoa aprofunda a tua própria memória.",
      "Campeões de memória dividem discursos em pequenos grupos para os aprender.",
      "Mover-te enquanto praticas torna as palavras mais fáceis de recordar.",
      "Imagens vívidas transformam frases abstratas em cenas memoráveis.",
      "Recordar logo antes de esquecer constrói os caminhos de memória mais fortes.",
    ],
  },
};

const factsRotationMs = 5200;
const factRevealDelayMs = 1200;

const SnusCan = () => (
  <div className="snus-can" aria-hidden="true">
    <div className="snus-can-lid">
      <span className="snus-can-lip" />
      <span className="snus-can-logo">S</span>
    </div>
    <div className="snus-can-body">
      <span className="snus-can-stripe snus-can-stripe-1" />
      <span className="snus-can-stripe snus-can-stripe-2" />
      <span className="snus-can-stripe snus-can-stripe-3" />
    </div>
    <div className="snus-can-base" />
  </div>
);

const LoadingOverlay = ({ isVisible }: LoadingOverlayProps) => {
  const { i18n } = useTranslation();
  const [showFact, setShowFact] = useState(false);
  const [factIndex, setFactIndex] = useState(0);
  const language = i18n.resolvedLanguage?.split("-")[0] as SupportedLanguage | undefined;
  const copy = loadingCopy[language ?? "en"] ?? loadingCopy.en;

  const initialFact = useMemo(() => Math.floor(Math.random() * copy.facts.length), [copy.facts.length]);

  useEffect(() => {
    if (!isVisible) {
      setShowFact(false);
      return;
    }

    setFactIndex(initialFact);

    const timer = setTimeout(() => setShowFact(true), factRevealDelayMs);
    return () => clearTimeout(timer);
  }, [copy.facts.length, isVisible, initialFact]);

  useEffect(() => {
    if (!showFact) return;
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % copy.facts.length);
    }, factsRotationMs);
    return () => clearInterval(interval);
  }, [copy.facts.length, showFact]);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background/95 px-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center"
      >
        <SnusCan />
        <p className="mt-7 text-sm font-semibold text-foreground">{copy.status}</p>
      </motion.div>

      <div className="mt-5 flex h-2.5 w-40 overflow-hidden rounded-full bg-primary/15" aria-hidden="true">
        <span className="loading-progress-bar h-full w-1/2 rounded-full bg-primary" />
      </div>

      <div className="mt-10 min-h-32 w-full max-w-sm" aria-live="polite">
        <AnimatePresence mode="wait">
          {showFact && (
            <motion.div
              key={factIndex}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-3xl border border-primary/10 bg-card/80 px-6 py-5 text-center shadow-lg backdrop-blur-sm"
            >
              <span className="block text-xs font-bold uppercase tracking-wide text-primary">{copy.label}</span>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.facts[factIndex]}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default LoadingOverlay;
