import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

interface LoadingOverlayProps {
  isVisible: boolean;
}

type SupportedLanguage = "en" | "sv" | "de" | "fr" | "es" | "it" | "pt";

const loadingCopy: Record<SupportedLanguage, { label: string; status: string; facts: string[] }> = {
  en: { label: "Did you know?", status: "Getting things ready…", facts: ["Saying a text aloud strengthens more memory pathways than silent reading.", "Short, spaced practice sessions help memories last longer.", "Sleep helps your brain consolidate what you practiced today."] },
  sv: { label: "Visste du att?", status: "Gör allt redo…", facts: ["Att säga texten högt stärker fler minnesspår än tyst läsning.", "Korta övningar med mellanrum hjälper minnet att hålla längre.", "Sömn hjälper hjärnan att befästa det du har övat på idag."] },
  de: { label: "Schon gewusst?", status: "Alles wird vorbereitet…", facts: ["Lautes Sprechen stärkt mehr Gedächtniswege als stilles Lesen.", "Kurze Übungen mit Pausen helfen Erinnerungen länger zu halten.", "Schlaf hilft deinem Gehirn, das heute Gelernte zu festigen."] },
  fr: { label: "Le saviez-vous ?", status: "Préparation en cours…", facts: ["Dire un texte à voix haute renforce davantage la mémoire que la lecture silencieuse.", "Des séances courtes et espacées aident les souvenirs à durer.", "Le sommeil aide votre cerveau à consolider ce que vous avez appris aujourd’hui."] },
  es: { label: "¿Sabías que?", status: "Preparándolo todo…", facts: ["Decir un texto en voz alta refuerza más vías de memoria que leer en silencio.", "Las prácticas cortas y espaciadas ayudan a recordar durante más tiempo.", "Dormir ayuda al cerebro a consolidar lo que has practicado hoy."] },
  it: { label: "Lo sapevi?", status: "Preparazione in corso…", facts: ["Dire un testo ad alta voce rafforza più percorsi della memoria rispetto alla lettura silenziosa.", "Sessioni brevi e distanziate aiutano i ricordi a durare più a lungo.", "Il sonno aiuta il cervello a consolidare ciò che hai praticato oggi."] },
  pt: { label: "Sabias que?", status: "A preparar tudo…", facts: ["Dizer um texto em voz alta fortalece mais caminhos da memória do que ler em silêncio.", "Sessões curtas e espaçadas ajudam as memórias a durar mais.", "O sono ajuda o cérebro a consolidar o que praticaste hoje."] },
};

const LoadingOverlay = ({ isVisible }: LoadingOverlayProps) => {
  const { i18n } = useTranslation();
  const [showFact, setShowFact] = useState(false);
  const [factIndex, setFactIndex] = useState(0);
  const language = i18n.resolvedLanguage?.split("-")[0] as SupportedLanguage | undefined;
  const copy = loadingCopy[language ?? "en"] ?? loadingCopy.en;

  useEffect(() => {
    if (!isVisible) {
      setShowFact(false);
      return;
    }

    // Pick a random starting fact
    setFactIndex(Math.floor(Math.random() * copy.facts.length));

    // Show fact after 4 seconds
    const timer = setTimeout(() => setShowFact(true), 4000);
    return () => clearTimeout(timer);
  }, [copy.facts.length, isVisible]);

  // Rotate facts every 5 seconds once visible
  useEffect(() => {
    if (!showFact) return;
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % copy.facts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [copy.facts.length, showFact]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background/95 px-6 animate-fade-in">
      <div className="loading-mascot" aria-hidden="true">
        <span className="loading-mascot-ear loading-mascot-ear-left" />
        <span className="loading-mascot-ear loading-mascot-ear-right" />
        <span className="loading-mascot-face">
          <span className="loading-mascot-eye loading-mascot-eye-left" />
          <span className="loading-mascot-eye loading-mascot-eye-right" />
          <span className="loading-mascot-cheek loading-mascot-cheek-left" />
          <span className="loading-mascot-cheek loading-mascot-cheek-right" />
          <span className="loading-mascot-smile" />
        </span>
        <span className="loading-mascot-body" />
      </div>
      <p className="mt-5 text-sm font-semibold text-foreground">{copy.status}</p>
      <div className="mt-3 flex h-2 w-36 overflow-hidden rounded-full bg-primary/15" aria-hidden="true">
        <span className="loading-progress-bar h-full w-1/2 rounded-full bg-primary" />
      </div>

      <div className="mt-8 min-h-28 w-full max-w-sm" aria-live="polite">
        <AnimatePresence mode="wait">
          {showFact && (
          <motion.div
            key={factIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="relative rounded-3xl border border-border/70 bg-card px-5 py-4 text-center shadow-sm"
          >
            <span className="block text-xs font-bold uppercase text-primary">{copy.label}</span>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{copy.facts[factIndex]}</p>
          </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LoadingOverlay;
