import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Float } from '@react-three/drei';
import { Suspense, useRef, useEffect, useState } from 'react';
import { AnimatedAstronaut } from './AnimatedAstronaut';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Mic, RotateCcw } from 'lucide-react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

// Listening astronaut with reactive animations based on speech
const ListeningAstronaut = ({ isActive }: { isActive: boolean }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    if (groupRef.current) {
      // Base floating animation
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.2;
      
      // When listening actively, add subtle "engaged" movements
      if (isActive) {
        groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.08;
        groupRef.current.rotation.z = Math.sin(t * 0.4) * 0.03;
      } else {
        groupRef.current.rotation.y = Math.sin(t * 0.2) * 0.05;
        groupRef.current.rotation.z = 0;
      }
    }
  });
  
  return (
    <group ref={groupRef}>
      <AnimatedAstronaut />
    </group>
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
  onRestartNeeded,
  showRestartHint = false,
}: AstronautListeningViewProps) => {
  const words = text.split(/\s+/).filter(w => w.trim());
  const hasErrors = hesitatedIndices.size > 0 || missedIndices.size > 0;
  
  return (
    <div className="flex flex-col h-full relative">
      {/* Large astronaut taking center stage */}
      <div className="flex-1 relative min-h-[300px] max-h-[450px]">
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <pointLight position={[-5, 5, -5]} intensity={0.4} color="#7ba7c4" />
            <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
              <ListeningAstronaut isActive={isListening} />
            </Float>
            <Environment preset="night" />
          </Suspense>
        </Canvas>
        
        {/* Listening indicator */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 backdrop-blur-sm"
            >
              <Mic className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">Listening...</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Restart hint when errors occur */}
        <AnimatePresence>
          {showRestartHint && hasErrors && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 backdrop-blur-sm"
            >
              <RotateCcw className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-500">Missed a word - try again!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Invisible script at bottom - shows progress and reveals missed words */}
      <div className="px-4 pb-6 pt-2">
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/30 p-4 max-w-2xl mx-auto">
          <div className="flex flex-wrap gap-x-2 gap-y-1 justify-center leading-relaxed text-lg">
            {words.map((word, idx) => {
              const isSpoken = spokenIndices.has(idx);
              const isHesitated = hesitatedIndices.has(idx);
              const isMissed = missedIndices.has(idx);
              const isCurrent = idx === currentWordIndex;
              const isUpcoming = idx > currentWordIndex && !isSpoken;
              
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
