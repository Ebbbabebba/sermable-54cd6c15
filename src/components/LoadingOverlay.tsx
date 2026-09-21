import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  isVisible: boolean;
}

type SupportedLanguage = "en" | "sv" | "de" | "fr" | "es" | "it" | "pt";

const ICON_WAIT_MS = 1000;
const FACT_WAIT_MS = 5000;
const FACT_ROTATION_MS = 5200;
const FACT_MIN_VISIBLE_MS = 3000;

const loadingCopy: Record<SupportedLanguage, { label: string; facts: string[] }> = {
  en: {
    label: "Did you know?",
    facts: [
      "The human brain can juggle roughly four separate chunks of information at once.",
      "Sleep helps the brain move memories from short-term storage into long-term storage.",
      "Every time you recall a memory, your brain rebuilds it — and may change it slightly.",
      "Ancient Greeks used the 'method of loci' to remember long lists by imagining a familiar building.",
      "Spaced repetition works with the brain's 'forgetting curve' to make learning stick.",
      "Smells can trigger powerful memories because the nose connects directly to the memory center.",
      "Teaching something to someone else is one of the best ways to strengthen your own memory.",
      "Writing notes by hand activates more brain regions than typing them.",
      "Chewing gum while studying may improve later recall — though scientists still debate why.",
      "Walking through a familiar place in your mind can help you remember lists in order.",
    ],
  },
  sv: {
    label: "Visste du att?",
    facts: [
      "Hjärnan kan hantera ungefär fyra separata informationsbitar samtidigt.",
      "Sömn hjälper hjärnan att flytta minnen från korttidslagring till långtidslagring.",
      "Varje gång du återkallar ett minne bygger hjärnan om det — och kan förändra det lite.",
      "De gamla grekerna använde 'loci-metoden' för att minnas långa listor genom att föreställa sig en bekant byggnad.",
      "Spridd repetition fungerar med hjärnans glömskekurva för att göra inlärningen bestående.",
      "Lukter kan väcka starka minnen eftersom näsan kopplar direkt till minnescentrum.",
      "Att lära något för någon annan är ett av de bästa sätten att stärka ditt eget minne.",
      "Att skriva anteckningar för hand aktiverar fler hjärnregioner än att skriva på dator.",
      "Att tugga tuggummi under studier kan förbättra senare minne — även om forskare fortfarande diskuterar varför.",
      "Att vandra genom en bekant plats i tankarna kan hjälpa dig att komma ihåg listor i ordning.",
    ],
  },
  de: {
    label: "Schon gewusst?",
    facts: [
      "Das menschliche Gehirn kann etwa vier separate Informationsbrocken gleichzeitig verarbeiten.",
      "Schlaf hilft dem Gehirn, Erinnerungen vom Kurzzeit- ins Langzeitgedächtnis zu verschieben.",
      "Jedes Mal, wenn du dich erinnerst, baut das Gehirn die Erinnerung neu auf – und kann sie leicht verändern.",
      "Die alten Griechen nutzten die 'Methode des Loci', um lange Listen mit einem vertrauten Gebäude zu merken.",
      "Spaced Repetition arbeitet mit der Vergessenskurve des Gehirns, damit Lernen haftet.",
      "Gerüche können starke Erinnerungen auslösen, weil die Nase direkt mit dem Gedächtniszentrum verbunden ist.",
      "Etwas jemand anderem beizubringen, ist eine der besten Möglichkeiten, das eigene Gedächtnis zu stärken.",
      "Handgeschriebene Notizen aktivieren mehr Gehirnregionen als getippte.",
      "Kaugummi beim Lernen kann die spätere Erinnerung verbessern – warum, darüber streiten Forscher noch.",
      "Sich einen vertrauten Ort vorzustellen, kann helfen, Listen in Reihenfolge zu merken.",
    ],
  },
  fr: {
    label: "Le saviez-vous ?",
    facts: [
      "Le cerveau humain peut gérer environ quatre blocs d'information à la fois.",
      "Le sommeil aide le cerveau à transférer les souvenirs de la mémoire à court terme vers la mémoire à long terme.",
      "Chaque fois que vous vous souvenez de quelque chose, votre cerveau reconstruit le souvenir — et peut le modifier légèrement.",
      "Les Grecs anciens utilisaient la 'méthode des loci' pour mémoriser de longues listes en imaginant un bâtiment familier.",
      "La répétition espacée suit la courbe de l'oubli du cerveau pour ancrer l'apprentissage.",
      "Les odeurs peuvent déclencher des souvenirs puissants car le nez est directement relié au centre de la mémoire.",
      "Enseigner quelque chose à quelqu'un d'autre est l'un des meilleurs moyens de renforcer sa propre mémoire.",
      "Écrire à la main active plus de régions cérébrales que taper au clavier.",
      "Mâcher du chewing-gum en étudiant peut améliorer le souvenir plus tard — les scientifiques débattent encore de la raison.",
      "Se promener mentalement dans un endroit familier peut aider à se souvenir de listes dans l'ordre.",
    ],
  },
  es: {
    label: "¿Sabías que?",
    facts: [
      "El cerebro humano puede manejar aproximadamente cuatro fragmentos de información a la vez.",
      "El sueño ayuda al cerebro a mover recuerdos de la memoria a corto plazo a la memoria a largo plazo.",
      "Cada vez que recuerdas algo, tu cerebro lo reconstruye — y puede cambiarlo ligeramente.",
      "Los griegos antiguos usaban el 'método de los loci' para memorizar largas listas imaginando un edificio familiar.",
      "La repetición espaciada trabaja con la curva del olvido del cerebro para que el aprendizaje perdure.",
      "Los olores pueden desencadenar recuerdos poderosos porque la nariz se conecta directamente con el centro de la memoria.",
      "Enseñar algo a otra persona es una de las mejores formas de fortalecer tu propia memoria.",
      "Escribir a mano activa más regiones cerebrales que escribir en el teclado.",
      "Masticar chicle mientras estudias puede mejorar la memoria más tarde — aunque los científicos aún debaten por qué.",
      "Pasear mentalmente por un lugar familiar puede ayudarte a recordar listas en orden.",
    ],
  },
  it: {
    label: "Lo sapevi?",
    facts: [
      "Il cervello umano riesce a gestire circa quattro blocchi di informazione alla volta.",
      "Il sonno aiuta il cervello a spostare i ricordi dalla memoria a breve termine a quella a lungo termine.",
      "Ogni volta che richiami un ricordo, il cervello lo ricostruisce — e può modificarlo leggermente.",
      "Gli antichi Greci usavano il 'metodo dei loci' per memorizzare lunghe liste immaginando un edificio familiare.",
      "La ripetizione spaziata sfrutta la curva dell'oblio del cervello per rendere l'apprendimento duraturo.",
      "Gli odori possono scatenare ricordi potenti perché il naso è collegato direttamente al centro della memoria.",
      "Insegnare qualcosa a qualcun altro è uno dei modi migliori per rafforzare la propria memoria.",
      "Scrivere a mano attiva più aree del cervello rispetto a digitare.",
      "Masticare gomma da masticare mentre studi può migliorare la memoria in seguito — anche se gli scienziati ancora discutono il perché.",
      "Passeggiare mentalmente in un luogo familiare può aiutare a ricordare liste in ordine.",
    ],
  },
  pt: {
    label: "Sabias que?",
    facts: [
      "O cérebro humano consegue gerir cerca de quatro blocos de informação de cada vez.",
      "O sono ajuda o cérebro a mover memórias da memória de curto prazo para a de longo prazo.",
      "Cada vez que recordas algo, o cérebro reconstrói a memória — e pode alterá-la ligeiramente.",
      "Os antigos gregos usavam o 'método dos loci' para memorizar listas longas imaginando um edifício familiar.",
      "A repetição espaçada trabalha com a curva do esquecimento do cérebro para fixar a aprendizagem.",
      "Os cheiros podem desencadear memórias poderosas porque o nariz liga diretamente ao centro da memória.",
      "Ensinar algo a outra pessoa é uma das melhores formas de fortalecer a própria memória.",
      "Escrever à mão ativa mais regiões do cérebro do que digitar.",
      "Mastigar chiclete enquanto estuda pode melhorar a memória mais tarde — embora os cientistas ainda discutam porquê.",
      "Caminhar mentalmente por um lugar familiar pode ajudar a lembrar listas por ordem.",
    ],
  },
};

const LoadingOverlay = ({ isVisible }: LoadingOverlayProps) => {
  const { i18n } = useTranslation();
  const [phase, setPhase] = useState<"blank" | "icon" | "rich">("blank");
  const [factIndex, setFactIndex] = useState(0);
  const richStartedAtRef = useRef<number | null>(null);
  const language = i18n.resolvedLanguage?.split("-")[0] as SupportedLanguage | undefined;
  const copy = loadingCopy[language ?? "en"] ?? loadingCopy.en;

  const initialFact = useMemo(() => Math.floor(Math.random() * copy.facts.length), [copy.facts.length]);

  useEffect(() => {
    if (!isVisible) {
      // Reset for the next load, unless the fact card is lingering.
      setPhase((prev) => (prev === "rich" ? prev : "blank"));
      return;
    }

    setFactIndex(initialFact);

    const iconTimer = setTimeout(() => setPhase("icon"), ICON_WAIT_MS);
    const factTimer = setTimeout(() => setPhase("rich"), FACT_WAIT_MS);
    return () => {
      clearTimeout(iconTimer);
      clearTimeout(factTimer);
    };
  }, [copy.facts.length, isVisible, initialFact]);

  // Track when the "Did you know?" card first appears.
  useEffect(() => {
    if (phase === "rich") {
      if (richStartedAtRef.current === null) richStartedAtRef.current = Date.now();
    } else {
      richStartedAtRef.current = null;
    }
  }, [phase]);

  // If loading finishes while the fact card is up, keep it visible for at
  // least FACT_MIN_VISIBLE_MS so it never flashes and disappears.
  useEffect(() => {
    if (isVisible || phase !== "rich") return;
    const startedAt = richStartedAtRef.current ?? Date.now();
    const remaining = Math.max(0, FACT_MIN_VISIBLE_MS - (Date.now() - startedAt));
    const lingerTimer = setTimeout(() => {
      setPhase("blank");
      richStartedAtRef.current = null;
    }, remaining);
    return () => clearTimeout(lingerTimer);
  }, [isVisible, phase]);

  useEffect(() => {
    if (phase !== "rich") return;
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % copy.facts.length);
    }, FACT_ROTATION_MS);
    return () => clearInterval(interval);
  }, [copy.facts.length, phase]);

  // Stay mounted (and visible) while the fact card is lingering after
  // loading finished; fade out smoothly instead of vanishing instantly.
  const shown = isVisible || phase === "rich";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: shown ? 1 : 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`fixed inset-0 z-[80] flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background/95 px-6 ${
        shown ? "" : "pointer-events-none"
      }`}
    >
      <AnimatePresence>
        {(phase === "icon" || phase === "rich") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-sm flex-col items-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            </div>

            {phase === "rich" && (
              <div className="mt-8 rounded-3xl border border-primary/10 bg-card/80 px-6 py-5 text-center shadow-lg backdrop-blur-sm">
                <span className="block text-xs font-bold uppercase tracking-wide text-primary">{copy.label}</span>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={factIndex}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-2 text-sm leading-relaxed text-muted-foreground"
                  >
                    {copy.facts[factIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LoadingOverlay;
