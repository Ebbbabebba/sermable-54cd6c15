import { AnimatePresence } from "framer-motion";
import { useAudienceReactions } from "./useAudienceReactions";
import type { Environment } from "./types";
import { useEffect } from "react";
import { Audience3DScene } from "./Audience3DScene";

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
        <Audience3DScene
          environment={environment}
          audienceState={audienceState}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
};
