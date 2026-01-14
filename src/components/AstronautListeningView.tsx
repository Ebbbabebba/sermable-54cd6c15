import { Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Mic, RotateCcw } from 'lucide-react';
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
  onRestartNeeded,
  showRestartHint = false,
}: AstronautListeningViewProps) => {
  const words = text.split(/\s+/).filter(w => w.trim());
  const hasErrors = hesitatedIndices.size > 0 || missedIndices.size > 0;
  
  // Subtle bobbing animation state
  const [bobPhase, setBobPhase] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setBobPhase(prev => prev + 0.05);
    }, 50);
    return () => clearInterval(interval);
  }, []);
  
  const bobY = Math.sin(bobPhase) * 8;
  const tiltZ = Math.sin(bobPhase * 0.7) * 2;
  
  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* FaceTime-style phone frame */}
      <div className="flex-1 flex items-center justify-center p-6 min-h-[300px]">
        <motion.div 
          className="relative"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Phone frame */}
          <div className="relative bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[2.5rem] p-2 shadow-2xl shadow-black/50">
            {/* Inner screen */}
            <div className="relative bg-black rounded-[2rem] overflow-hidden w-64 h-80 sm:w-72 sm:h-96">
              {/* Status bar with name */}
              <div className="absolute top-0 left-0 right-0 z-10 flex justify-center pt-4">
                <motion.div 
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-sm"
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.div 
                    className="w-2.5 h-2.5 rounded-full bg-emerald-500"
                    animate={{ 
                      scale: isListening ? [1, 1.2, 1] : 1,
                      opacity: isListening ? [1, 0.7, 1] : 0.5 
                    }}
                    transition={{ 
                      duration: 1, 
                      repeat: isListening ? Infinity : 0 
                    }}
                  />
                  <span className="text-white font-medium text-sm">Sermable</span>
                </motion.div>
              </div>
              
              {/* Astronaut image with subtle animations */}
              <motion.div 
                className="absolute inset-0 flex items-center justify-center"
                animate={{
                  y: bobY,
                  rotate: tiltZ,
                }}
                transition={{ type: "tween", duration: 0.05 }}
              >
                <img 
                  src={astronautImage} 
                  alt="Listening astronaut"
                  className="w-full h-full object-contain scale-125 mt-8"
                />
              </motion.div>
              
              {/* Listening pulse effect */}
              <AnimatePresence>
                {isListening && (
                  <motion.div
                    className="absolute bottom-8 left-1/2 -translate-x-1/2"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="w-1 bg-white rounded-full"
                          animate={{
                            height: [8, 24, 8],
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
            
            {/* Phone notch/dynamic island */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full" />
          </div>
          
          {/* Decorative stars/sparkles around the phone */}
          <motion.div 
            className="absolute -top-4 -right-4 text-primary text-2xl"
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 15, 0],
              opacity: [0.6, 1, 0.6]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ✦
          </motion.div>
          <motion.div 
            className="absolute -bottom-2 -left-6 text-primary/60 text-xl"
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.4, 0.8, 0.4]
            }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
          >
            ✦
          </motion.div>
        </motion.div>
      </div>
      
      {/* Restart hint when errors occur */}
      <AnimatePresence>
        {showRestartHint && hasErrors && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 backdrop-blur-sm z-20"
          >
            <RotateCcw className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-500">Missed a word - try again!</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Invisible script at bottom - shows progress and reveals missed words */}
      <div className="px-4 pb-6 pt-2">
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/30 p-4 max-w-2xl mx-auto">
          <div className="flex flex-wrap gap-x-2 gap-y-1 justify-center leading-relaxed text-lg">
            {words.map((word, idx) => {
              const isSpoken = spokenIndices.has(idx);
              const isHesitated = hesitatedIndices.has(idx);
              const isMissed = missedIndices.has(idx);
              const isCurrent = idx === currentWordIndex;
              
              // Words are invisible by default, appear when spoken or failed
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
                    // Invisible/faded state for unspoken words
                    !shouldShow && "text-muted-foreground/20",
                    // Spoken correctly - appears green
                    isSpoken && !isHesitated && !isMissed && "text-emerald-500",
                    // Hesitated (yellow)
                    isHesitated && !isMissed && "text-amber-500 font-semibold",
                    // Missed (red)
                    isMissed && "text-red-500 font-bold",
                    // Current word hint
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
