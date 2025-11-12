import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";

interface StreakCelebrationProps {
  currentStreak: number;
  show: boolean;
  onHide: () => void;
}

const StreakCelebration = ({ currentStreak, show, onHide }: StreakCelebrationProps) => {
  useEffect(() => {
    if (show && currentStreak > 0) {
      const timer = setTimeout(() => {
        onHide();
      }, 3000); // Auto-hide after 3 seconds

      return () => clearTimeout(timer);
    }
  }, [show, currentStreak, onHide]);

  if (currentStreak === 0) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ type: "spring", damping: 15 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className="bg-card border border-warning/20 shadow-lg rounded-2xl px-8 py-6 flex items-center gap-4">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            >
              <Flame className="h-10 w-10 text-warning" />
            </motion.div>
            <div>
              <p className="text-2xl font-bold">
                You're on a {currentStreak}-day streak!
              </p>
              <p className="text-sm text-muted-foreground">Keep it up!</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StreakCelebration;
