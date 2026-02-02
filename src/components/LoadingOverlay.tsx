import { useState, useEffect } from "react";
import { Loader, Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

interface LoadingOverlayProps {
  isVisible: boolean;
}

const LoadingOverlay = ({ isVisible }: LoadingOverlayProps) => {
  const { t } = useTranslation();
  const [factIndex, setFactIndex] = useState(0);

  // Memory science facts for engagement during loading
  const memoryFacts = [
    t('loading_facts.sleep_consolidation', 'Sleep consolidates 40% more memories than staying awake'),
    t('loading_facts.spaced_repetition', 'Spaced repetition can improve retention by 200%'),
    t('loading_facts.rem_rehearsal', 'Your brain rehearses learned material during REM sleep'),
    t('loading_facts.testing_effect', 'Testing yourself is more effective than re-reading'),
    t('loading_facts.morning_recall', 'Morning recall strengthens overnight memory consolidation'),
    t('loading_facts.active_recall', 'Active recall creates stronger neural pathways than passive review'),
    t('loading_facts.forgetting_curve', 'The forgetting curve drops 70% after 24 hours without review'),
    t('loading_facts.chunking', 'Breaking content into 3-4 item chunks improves recall by 50%'),
    t('loading_facts.interleaving', 'Mixing different topics during study improves long-term retention'),
    t('loading_facts.emotion_memory', 'Emotional engagement makes memories up to 10x stronger'),
    t('loading_facts.physical_exercise', 'Physical exercise before learning boosts memory formation'),
    t('loading_facts.elaboration', 'Connecting new info to existing knowledge strengthens memories'),
  ];

  // Rotate facts every 3 seconds
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % memoryFacts.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isVisible, memoryFacts.length]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      {/* Animated loader */}
      <div className="relative w-32 h-32 mb-8">
        <div className="absolute inset-0 animate-[spin_1.5s_linear_infinite]">
          <Loader className="w-12 h-12 text-primary absolute top-0 left-1/2 -translate-x-1/2" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Brain className="h-8 w-8 text-primary/60" />
        </div>
      </div>

      {/* Memory facts section */}
      <div className="flex flex-col items-center gap-3 max-w-md px-6 text-center">
        <p className="text-xs font-medium text-primary/70 uppercase tracking-wider">
          {t('loading_facts.did_you_know', 'Did you know?')}
        </p>
        
        <AnimatePresence mode="wait">
          <motion.p
            key={factIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="text-sm text-muted-foreground leading-relaxed"
          >
            💡 {memoryFacts[factIndex]}
          </motion.p>
        </AnimatePresence>

        {/* Progress dots */}
        <div className="flex gap-1.5 mt-2">
          {memoryFacts.slice(0, 5).map((_, idx) => (
            <div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                idx === factIndex % 5 ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
