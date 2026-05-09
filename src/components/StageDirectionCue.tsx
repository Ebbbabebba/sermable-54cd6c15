import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface StageDirectionCueProps {
  /** Active direction text(s), or empty/undefined when none. */
  directions?: string[] | null;
  className?: string;
}

/**
 * Floating cue rendered ABOVE the manuscript. Shows the currently-active
 * stage direction (parsed from `(...)` in the script) and fades out as soon
 * as the speaker advances to the next word.
 */
const StageDirectionCue = ({ directions, className }: StageDirectionCueProps) => {
  const active = directions && directions.length > 0;
  return (
    <div
      className={cn(
        "pointer-events-none flex justify-center min-h-[2.5rem] w-full",
        className,
      )}
      aria-live="polite"
    >
      <AnimatePresence>
        {active && (
          <motion.div
            key={directions!.join("|")}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm md:text-base italic font-medium shadow-sm backdrop-blur-sm"
          >
            {directions!.map((d, i) => (
              <span key={i}>
                {i > 0 && " · "}
                {d}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StageDirectionCue;

/**
 * Given a map of `afterWordIndex -> direction texts` and the current word
 * index, returns the directions that should currently float above the manuscript.
 *
 * Behaviour: a direction with `afterWordIndex = N` becomes active the moment
 * the speaker has finished word N (i.e. `currentWordIndex === N + 1`) and
 * disappears once they say the next word.
 *
 * Special case: directions placed before the very first word use
 * `afterWordIndex = -1` and are active while `currentWordIndex === 0`.
 */
export const getActiveDirections = (
  directionsByAfterIndex: Map<number, string[]>,
  currentWordIndex: number,
): string[] => directionsByAfterIndex.get(currentWordIndex - 1) ?? [];
