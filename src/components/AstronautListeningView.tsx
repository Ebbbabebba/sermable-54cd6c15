import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RotateCcw } from 'lucide-react';
import astronautImage from '@/assets/astronaut.png';

interface AstronautListeningViewProps {
  text: string;
  currentWordIndex: number;
  spokenIndices: Set<number>;
  hesitatedIndices: Set<number>;
  missedIndices: Set<number>;
  isListening: boolean;
  onWordTap?: (idx: number) => void;
  onRestartNeeded?: () => void;
  showRestartHint?: boolean;
}

export const AstronautListeningView = ({
  text,
  currentWordIndex,
  spokenIndices,
  hesitatedIndices,
  missedIndices,
  isListening,
  onWordTap,
  showRestartHint = false,
}: AstronautListeningViewProps) => {
  const words = text.split(/\s+/).filter(w => w.trim());
  const hasErrors = hesitatedIndices.size > 0 || missedIndices.size > 0;
  
  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Status indicator */}
      <div className="flex justify-center pt-4 z-10">
        <motion.div 
          className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/30"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <motion.div 
            className="w-2.5 h-2.5 rounded-full bg-emerald-500"
            animate={{ 
              scale: isListening ? [1, 1.3, 1] : 1,
              opacity: isListening ? [1, 0.6, 1] : 0.5 
            }}
            transition={{ 
              duration: 1, 
              repeat: isListening ? Infinity : 0 
            }}
          />
          <span className="text-foreground font-medium text-sm">Sermable</span>
        </motion.div>
      </div>
      
      {/* Large astronaut */}
      <div className="flex-1 flex items-center justify-center relative -mt-8">
        <motion.img 
          src={astronautImage} 
          alt="Listening astronaut"
          className="w-[85%] max-w-[400px] h-auto object-contain"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            rotate: isListening ? [0, 1.5, 0, -1.5, 0] : 0,
          }}
          transition={{
            scale: { duration: 0.5 },
            opacity: { duration: 0.5 },
            rotate: { 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }
          }}
        />
        
        {/* Listening audio bars */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              className="absolute bottom-4 left-1/2 -translate-x-1/2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 bg-primary rounded-full"
                    animate={{
                      height: [8, 28, 8],
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Restart hint when errors occur */}
      <AnimatePresence>
        {showRestartHint && hasErrors && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 backdrop-blur-sm z-20"
          >
            <RotateCcw className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-500">Missed a word - try again!</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Invisible script at bottom */}
      <div className="px-4 pb-6 pt-2">
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/30 p-4 max-w-2xl mx-auto">
          <div className="flex flex-wrap gap-x-2 gap-y-1 justify-center leading-relaxed text-lg">
            {words.map((word, idx) => {
              const isSpoken = spokenIndices.has(idx);
              const isHesitated = hesitatedIndices.has(idx);
              const isMissed = missedIndices.has(idx);
              const isCurrent = idx === currentWordIndex;
              
              const shouldShow = isSpoken || isHesitated || isMissed;
              
              return (
                <motion.span
                  key={idx}
                  onClick={() => onWordTap?.(idx)}
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: shouldShow ? 1 : 0.15,
                    scale: isCurrent ? 1.05 : 1,
                  }}
                  className={cn(
                    "inline-block transition-all duration-200 cursor-pointer select-none",
                    !shouldShow && "text-muted-foreground/20",
                    isSpoken && !isHesitated && !isMissed && "text-emerald-500",
                    isHesitated && !isMissed && "text-amber-500 font-semibold",
                    isMissed && "text-red-500 font-bold",
                    isCurrent && !isSpoken && "text-muted-foreground/40 underline decoration-dotted"
                  )}
                >
                  {word}
                </motion.span>
              );
            })}
          </div>
          
          {/* Progress bar */}
          <div className="mt-4 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                hasErrors ? "bg-amber-500" : "bg-emerald-500"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${(spokenIndices.size / Math.max(words.length, 1)) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AstronautListeningView;
