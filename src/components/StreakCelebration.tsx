import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StreakCelebrationProps {
  streak: number;
  onClose: () => void;
}

const StreakCelebration = ({ streak, onClose }: StreakCelebrationProps) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 50 }}
          transition={{ type: "spring", damping: 15, stiffness: 300 }}
          className="bg-card border-2 border-primary rounded-3xl shadow-2xl px-12 py-10 text-center max-w-sm mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Animated flame */}
          <motion.div
            className="mx-auto mb-6 w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center"
            animate={{ 
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              animate={{ 
                rotate: [0, 5, -5, 5, 0],
              }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <Flame className="h-14 w-14 text-white" fill="currentColor" />
            </motion.div>
          </motion.div>
          
          {/* Streak number */}
          <motion.div 
            className="text-6xl font-black text-primary mb-2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", damping: 10 }}
          >
            {streak}
          </motion.div>
          
          <div className="text-2xl font-bold mb-2">
            Day Streak! 🔥
          </div>
          
          <p className="text-muted-foreground mb-8">
            You're on fire! Keep practicing every day to maintain your streak.
          </p>
          
          {/* Big continue button */}
          <Button 
            onClick={onClose}
            size="lg"
            className="w-full text-lg font-bold py-6 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            🎉 Yay!
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StreakCelebration;
