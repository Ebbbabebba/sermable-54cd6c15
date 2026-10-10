import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface StreakCelebrationProps {
  streak: number;
  onClose: () => void;
}

const StreakCelebration = ({ streak, onClose }: StreakCelebrationProps) => {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="s-c4 s-i5 s-yh s-c5 s-ib s-ig s-40 s-3h"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 50 }}
          transition={{ type: "spring", damping: 15, stiffness: 300 }}
          className="s-4b s-6n s-7n s-qa s-qr s-oo s-p0 s-u0 s-js s-m8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Animated flame */}
          <motion.div
            className="s-m9 s-k1 s-xo s-fv s-qe s-4s from-orange-400 to-red-500 s-c5 s-ib s-ig"
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
              <Flame className="s-fq s-xi s-vg" fill="currentColor" />
            </motion.div>
          </motion.div>
          
          {/* Streak number */}
          <motion.div 
            className="s-td s-cw s-uw s-jy"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", damping: 10 }}
          >
            {streak}
          </motion.div>
          
          <div className="s-t9 s-cx s-jy">
            {t("streak.title")}
          </div>

          <p className="s-ul s-k2">
            {t("streak.subtitle")}
          </p>
          
          {/* Big continue button */}
          <Button 
            onClick={onClose}
            size="lg"
            className="s-y7 s-uk s-cx s-p9 s-qo s-4t from-primary s-w0 s-hm s-i0"
          >
            {t("streak.button")}
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StreakCelebration;
