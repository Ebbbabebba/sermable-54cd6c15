import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RotateCcw } from 'lucide-react';

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

// 2D Animated Astronaut SVG Component
const AnimatedAstronaut2D = ({ isListening }: { isListening: boolean }) => {
  return (
    <motion.svg
      viewBox="0 0 200 280"
      className="w-full h-full max-w-[300px]"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      {/* Body */}
      <motion.ellipse
        cx="100"
        cy="180"
        rx="55"
        ry="70"
        fill="#e8dcc8"
        animate={{
          scaleY: isListening ? [1, 1.02, 1] : 1,
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Helmet */}
      <motion.circle
        cx="100"
        cy="85"
        r="50"
        fill="#e8dcc8"
        animate={{
          cy: isListening ? [85, 82, 85] : 85,
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Helmet ring */}
      <ellipse cx="100" cy="120" rx="52" ry="12" fill="#c9b89a" />
      
      {/* Visor */}
      <motion.ellipse
        cx="100"
        cy="80"
        rx="38"
        ry="32"
        fill="#1a1a2e"
        animate={{
          cy: isListening ? [80, 77, 80] : 80,
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Visor shine */}
      <ellipse cx="85" cy="70" rx="8" ry="5" fill="#3a3a5e" opacity="0.5" />
      
      {/* Left arm */}
      <motion.g
        animate={{
          rotate: isListening ? [0, 5, 0, -3, 0] : [0, 2, 0],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "45px", originY: "160px" }}
      >
        <ellipse cx="35" cy="170" rx="18" ry="28" fill="#e8dcc8" />
        <ellipse cx="20" cy="195" rx="14" ry="20" fill="#c9b89a" />
        <circle cx="12" cy="215" r="12" fill="#c9b89a" />
      </motion.g>
      
      {/* Right arm */}
      <motion.g
        animate={{
          rotate: isListening ? [0, -5, 0, 3, 0] : [0, -2, 0],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        style={{ originX: "155px", originY: "160px" }}
      >
        <ellipse cx="165" cy="170" rx="18" ry="28" fill="#e8dcc8" />
        <ellipse cx="180" cy="195" rx="14" ry="20" fill="#c9b89a" />
        <circle cx="188" cy="215" r="12" fill="#c9b89a" />
      </motion.g>
      
      {/* Chest panel */}
      <rect x="75" y="155" width="50" height="45" rx="5" fill="#d4c4a8" />
      
      {/* Sermable text */}
      <text x="100" y="172" textAnchor="middle" fontSize="8" fill="#333" fontWeight="500">
        sermable
      </text>
      
      {/* Control buttons */}
      <rect x="82" y="180" width="10" height="10" rx="2" fill="#c9b89a" />
      <motion.circle 
        cx="100" 
        cy="185" 
        r="5" 
        fill="#d66b4a"
        animate={{
          scale: isListening ? [1, 1.2, 1] : 1,
        }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      <circle cx="115" cy="185" r="5" fill="#7ba7c4" />
      
      {/* Waist ring */}
      <ellipse cx="100" cy="235" rx="58" ry="12" fill="#c9b89a" />
      
      {/* Left leg */}
      <motion.g
        animate={{
          rotate: isListening ? [0, 2, 0, -2, 0] : 0,
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "75px", originY: "240px" }}
      >
        <ellipse cx="70" cy="255" rx="16" ry="22" fill="#e8dcc8" />
        <ellipse cx="68" cy="280" rx="14" ry="18" fill="#c9b89a" />
      </motion.g>
      
      {/* Right leg */}
      <motion.g
        animate={{
          rotate: isListening ? [0, -2, 0, 2, 0] : 0,
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        style={{ originX: "125px", originY: "240px" }}
      >
        <ellipse cx="130" cy="255" rx="16" ry="22" fill="#e8dcc8" />
        <ellipse cx="132" cy="280" rx="14" ry="18" fill="#c9b89a" />
      </motion.g>
    </motion.svg>
  );
};

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
      
      {/* Large 2D animated astronaut */}
      <div className="flex-1 flex items-center justify-center relative">
        <motion.div
          className="w-[80%] max-w-[350px] h-auto"
          animate={{
            y: [0, -8, 0],
            rotate: [0, 1, 0, -1, 0],
          }}
          transition={{
            y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 6, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          <AnimatedAstronaut2D isListening={isListening} />
        </motion.div>
        
        {/* Listening audio bars */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              className="absolute bottom-2 left-1/2 -translate-x-1/2"
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
