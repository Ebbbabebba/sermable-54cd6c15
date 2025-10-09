import { cn } from "@/lib/utils";

interface WordHighlighterProps {
  text: string;
  missedWords: string[];
  delayedWords: string[];
  className?: string;
}

const WordHighlighter = ({ text, missedWords, delayedWords, className }: WordHighlighterProps) => {
  // Split text into words while preserving punctuation and whitespace
  const words = text.split(/(\s+)/);

  const getWordStyle = (word: string) => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    
    if (missedWords.some(w => w.toLowerCase() === cleanWord)) {
      return "bg-destructive/20 text-destructive font-medium";
    }
    if (delayedWords.some(w => w.toLowerCase() === cleanWord)) {
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300 font-medium";
    }
    return "text-foreground/80";
  };

  return (
    <div className={cn("prose prose-lg max-w-none leading-relaxed", className)}>
      {words.map((word, index) => {
        if (/^\s+$/.test(word)) {
          return <span key={index}>{word}</span>;
        }
        
        return (
          <span
            key={index}
            className={cn(
              "inline-block px-1 rounded transition-colors",
              getWordStyle(word)
            )}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

export default WordHighlighter;
