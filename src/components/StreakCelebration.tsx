import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";

interface StreakCelebrationProps {
  streak: number;
  onClose: () => void;
}

const StreakCelebration = ({ streak, onClose }: StreakCelebrationProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-card border-2 border-primary rounded-2xl shadow-2xl px-8 py-6"
        >
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 10, 0],
                scale: [1, 1.1, 1.1, 1.1, 1]
              }}
              transition={{ duration: 0.5, repeat: 2 }}
            >
              <Flame className="h-12 w-12 text-orange-500" fill="currentColor" />
            </motion.div>
            <div>
              <div className="text-2xl font-bold">
                {streak} Day Streak!
              </div>
              <div className="text-sm text-muted-foreground">
                Keep it up! 🎉
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StreakCelebration;
