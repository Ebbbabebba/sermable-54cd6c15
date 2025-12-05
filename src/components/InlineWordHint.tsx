import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface InlineWordHintProps {
  word: string;
  hintLevel: 0 | 1 | 2 | 3; // 0=no hint, 1=first letter, 2=more letters, 3=full word
  isVisible: boolean;
  className?: string;
}

const InlineWordHint = ({ word, hintLevel, isVisible, className }: InlineWordHintProps) => {
  const getHintText = () => {
    if (hintLevel === 0 || !word) return "";
    if (hintLevel === 1) return word.slice(0, 1) + "___";
    if (hintLevel === 2) return word.slice(0, Math.ceil(word.length / 2)) + "...";
    return word;
  };

  const hintText = getHintText();

  return (
    <AnimatePresence>
      {isVisible && hintLevel > 0 && (
        <motion.span
          initial={{ opacity: 0, y: -10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 5, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-md text-sm font-medium",
            hintLevel === 1 && "bg-primary/10 text-primary border border-primary/30",
            hintLevel === 2 && "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/40",
            hintLevel === 3 && "bg-yellow-500/30 text-yellow-800 dark:text-yellow-300 border-2 border-yellow-500 font-bold",
            className
          )}
        >
          {hintText}
        </motion.span>
      )}
    </AnimatePresence>
  );
};

export default InlineWordHint;
