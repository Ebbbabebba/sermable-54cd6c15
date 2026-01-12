import { motion, AnimatePresence } from "framer-motion";
import { Flame, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface FullSpeechRecallCelebrationProps {
  onStart: () => void;
  totalWords: number;
}

const FullSpeechRecallCelebration = ({ onStart, totalWords }: FullSpeechRecallCelebrationProps) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md"
      >
        {/* Animated fire particles in background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-4 h-4"
              initial={{
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 50,
                opacity: 0.8,
              }}
              animate={{
                y: -100,
                opacity: 0,
                scale: [1, 1.5, 0.5],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: "easeOut",
              }}
            >
              <Sparkles className="w-full h-full text-orange-400/60" />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 50 }}
          transition={{ type: "spring", damping: 15, stiffness: 300 }}
          className="relative bg-gradient-to-br from-orange-950/90 via-card to-amber-950/90 border-2 border-orange-500/50 rounded-3xl shadow-2xl shadow-orange-500/20 px-12 py-10 text-center max-w-md mx-4"
        >
          {/* Glowing ring effect */}
          <motion.div
            className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 rounded-3xl opacity-30 blur-lg"
            animate={{
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.02, 1],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative z-10">
            {/* Animated flame icon */}
            <div className="relative mx-auto mb-6">
              <motion.div
                className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-400 via-amber-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/50"
                animate={{
                  scale: [1, 1.1, 1],
                  boxShadow: [
                    "0 0 30px rgba(249, 115, 22, 0.5)",
                    "0 0 60px rgba(249, 115, 22, 0.7)",
                    "0 0 30px rgba(249, 115, 22, 0.5)",
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <motion.div
                  animate={{
                    rotate: [0, 5, -5, 5, 0],
                    y: [0, -3, 0],
                  }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                >
                  <Flame className="h-16 w-16 text-white drop-shadow-lg" fill="currentColor" />
                </motion.div>
              </motion.div>

              {/* Orbiting sparks */}
              {[0, 120, 240].map((rotation) => (
                <motion.div
                  key={rotation}
                  className="absolute top-1/2 left-1/2"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  style={{ transformOrigin: "0 0" }}
                >
                  <motion.div
                    style={{ rotate: rotation }}
                    className="absolute"
                  >
                    <Zap
                      className="w-5 h-5 text-amber-400"
                      style={{ transform: `translateX(50px) translateY(-10px)` }}
                    />
                  </motion.div>
                </motion.div>
              ))}
            </div>

            {/* Title */}
            <motion.h2
              className="text-3xl font-black bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 bg-clip-text text-transparent mb-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              🔥 Full Recall Mode
            </motion.h2>

            <motion.p
              className="text-orange-200/80 mb-2 text-lg font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {t('progressive.full_recall_subtitle', 'No script. Pure memory.')}
            </motion.p>

            <motion.p
              className="text-muted-foreground mb-8 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {t('progressive.full_recall_desc', 'You\'ve mastered all beats! Now recall the entire speech from memory.')}
              <br />
              <span className="text-orange-400/80 font-semibold">{totalWords} {t('common.words', 'words')}</span>
            </motion.p>

            {/* Big start button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                onClick={onStart}
                size="lg"
                className="w-full text-lg font-bold py-6 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:via-amber-600 hover:to-orange-600 text-white shadow-lg shadow-orange-500/30 border border-orange-400/30"
              >
                <Flame className="w-5 h-5 mr-2" />
                {t('progressive.begin_recall', 'Begin Full Recall')}
              </Button>
            </motion.div>

            <motion.p
              className="mt-4 text-xs text-orange-300/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {t('progressive.hint_available', 'Hints will appear if you pause for 3+ seconds')}
            </motion.p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FullSpeechRecallCelebration;
