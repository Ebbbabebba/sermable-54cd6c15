import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PropCueRange } from "@/utils/propCues";

interface PropCueOverlayProps {
  cue: PropCueRange | null;
  className?: string;
}

/**
 * Floating prop-cue badge rendered ABOVE the manuscript while the speaker is
 * inside a `{{cue}}…{{/}}` range. Distinct warm colour so it doesn't get
 * confused with the primary stage-direction cue.
 */
const PropCueOverlay = ({ cue, className }: PropCueOverlayProps) => {
  return (
    <div
      className={cn(
        "pointer-events-none flex justify-center min-h-[2.25rem] w-full",
        className,
      )}
      aria-live="polite"
    >
      <AnimatePresence>
        {cue && (
          <motion.div
            key={`${cue.cue}-${cue.startWordIndex}`}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              boxShadow: [
                "0 0 0 0 hsl(var(--prop-cue-fg) / 0.0)",
                "0 0 24px 0 hsl(var(--prop-cue-fg) / 0.35)",
                "0 0 0 0 hsl(var(--prop-cue-fg) / 0.0)",
              ],
            }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{
              opacity: { duration: 0.3 },
              y: { duration: 0.3 },
              scale: { duration: 0.3 },
              boxShadow: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
            }}
            className="px-4 py-1.5 rounded-full text-sm md:text-base font-semibold tracking-wide uppercase backdrop-blur-sm"
            style={{
              backgroundColor: "hsl(var(--prop-cue-bg-strong))",
              color: "hsl(var(--prop-cue-fg))",
              border: "1px solid hsl(var(--prop-cue-fg) / 0.5)",
            }}
          >
            {cue.cue}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PropCueOverlay;
