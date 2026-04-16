import { Loader } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LoadingOverlayProps {
  isVisible: boolean;
}

const funFacts = [
  "Your brain has ~86 billion neurons — more than stars in the Milky Way!",
  "You consolidate memories during sleep. Naps count too!",
  "Spaced repetition can boost retention by up to 200%.",
  "Octopuses have 9 brains — one central and one in each arm.",
  "Music activates more parts of the brain than any other activity.",
  "Reading out loud improves memory by 25% compared to silent reading.",
  "A 20-minute walk can boost memory performance for hours.",
  "Caffeine doesn't create energy — it blocks the \"tired\" signal.",
  "Your short-term memory can hold about 7 items at once.",
  "REM sleep replays the day's learning at 10x speed.",
  "Ancient Greeks memorized speeches by placing ideas in imaginary rooms.",
  "Parrots don't just mimic — some understand over 100 words.",
  "Writing by hand activates deeper memory encoding than typing.",
  "Hermann Ebbinghaus discovered the forgetting curve in 1885.",
  "Your brain uses 20% of your body's energy despite being 2% of its weight.",
  "Testing yourself is more effective than re-reading — by a lot!",
  "Dolphins sleep with one eye open — half their brain stays awake.",
  "London taxi drivers grow larger hippocampi from memorizing streets.",
  "The best time to review? Right before you'd forget it.",
  "Memories aren't stored in one spot — they're spread across your brain.",
];

const LoadingOverlay = ({ isVisible }: LoadingOverlayProps) => {
  const [showFact, setShowFact] = useState(false);
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setShowFact(false);
      return;
    }

    // Pick a random starting fact
    setFactIndex(Math.floor(Math.random() * funFacts.length));

    // Show fact after 4 seconds
    const timer = setTimeout(() => setShowFact(true), 4000);
    return () => clearTimeout(timer);
  }, [isVisible]);

  // Rotate facts every 5 seconds once visible
  useEffect(() => {
    if (!showFact) return;
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % funFacts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [showFact]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-32 h-32">
        <div className="absolute inset-0 animate-[spin_1.5s_linear_infinite]">
          <Loader className="w-12 h-12 text-primary absolute top-0 left-1/2 -translate-x-1/2" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30 animate-pulse" />
      </div>

      <AnimatePresence mode="wait">
        {showFact && (
          <motion.p
            key={factIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="mt-8 max-w-xs text-center text-sm text-muted-foreground px-4"
          >
            {funFacts[factIndex]}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoadingOverlay;
