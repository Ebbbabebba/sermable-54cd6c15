import { motion, AnimatePresence } from "framer-motion";
import { AudienceGrid } from "./AudienceGrid";
import { useAudienceReactions } from "./useAudienceReactions";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Environment } from "./types";
import { useEffect } from "react";

interface AudienceOverlayProps {
  isVisible: boolean;
  environment: Environment;
  onClose: () => void;
  // Optional: pass in word performance data for real-time reactions
  wordPerformance?: {
    status: 'correct' | 'hesitated' | 'missed' | 'skipped';
    timeToSpeak?: number;
  } | null;
}

export const AudienceOverlay = ({
  isVisible,
  environment,
  onClose,
  wordPerformance,
}: AudienceOverlayProps) => {
  const { 
    audienceState, 
    recordWordPerformance,
    resetAudienceState 
  } = useAudienceReactions();

  // Record word performance when it changes
  useEffect(() => {
    if (wordPerformance) {
      recordWordPerformance(wordPerformance);
    }
  }, [wordPerformance, recordWordPerformance]);

  // Reset when overlay becomes visible
  useEffect(() => {
    if (isVisible) {
      resetAudienceState();
    }
  }, [isVisible, resetAudienceState]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 z-50"
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Main content */}
          <motion.div
            className="w-full max-w-md mx-4"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25 }}
          >
            {/* Title */}
            <motion.div
              className="text-center mb-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-xl font-semibold">Your Audience</h2>
              <p className="text-sm text-muted-foreground">
                Practice speaking to a real audience
              </p>
            </motion.div>

            {/* Audience grid */}
            <AudienceGrid
              environment={environment}
              audienceState={audienceState}
              className="w-full aspect-square"
            />

            {/* Tips */}
            <motion.div
              className="mt-4 p-3 rounded-lg bg-muted/50 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <p className="text-xs text-muted-foreground">
                💡 Speak confidently and vary your tone to keep them engaged!
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
