import { motion, AnimatePresence } from "framer-motion";
import { Pause } from "lucide-react";

interface PauseCountdownOverlayProps {
  /** Seconds remaining (>= 0). Pass `null` to hide. */
  remainingSeconds: number | null;
  /** Total seconds of the original pause (for the ring fill). */
  totalSeconds: number;
}

/**
 * Full-screen dim with a large circular countdown shown while the speaker
 * takes a planned pause (`-` marker). The microphone is muted by the
 * caller for the same duration so noise/breathing can't trigger advance.
 */
export const PauseCountdownOverlay = ({
  remainingSeconds,
  totalSeconds,
}: PauseCountdownOverlayProps) => {
  const visible = remainingSeconds !== null;
  const safeTotal = Math.max(1, totalSeconds);
  const safeRemaining = remainingSeconds ?? 0;
  const progress = Math.max(0, Math.min(1, safeRemaining / safeTotal));
  const size = 240;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="pause-overlay"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-background/85 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-live="polite"
          role="status"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative flex items-center justify-center"
          >
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={stroke}
                opacity={0.4}
              />
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 100ms linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Pause className="h-7 w-7 text-primary" fill="currentColor" />
              <div className="text-6xl font-bold tabular-nums text-foreground">
                {Math.ceil(safeRemaining)}
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                pause
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
