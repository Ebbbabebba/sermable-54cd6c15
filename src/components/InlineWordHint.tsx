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
            "s-i4 s-ib s-op s-ox s-qi s-v9 s-d0",
            hintLevel === 1 && "s-5e s-uw s-6l s-7r",
            hintLevel === 2 && "s-6f s-vm s-8y s-6l s-88",
            hintLevel === 3 && "s-6h s-vn s-8x s-6n s-87 s-cx",
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
