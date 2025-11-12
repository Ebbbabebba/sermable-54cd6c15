import { cn } from "@/lib/utils";

interface WordHighlighterProps {
  text: string;
  missedWords: string[];
  delayedWords: string[];
  connectorWords?: string[];
  className?: string;
}

const WordHighlighter = ({ text, missedWords, delayedWords, connectorWords = [], className }: WordHighlighterProps) => {
  // Split text into words while preserving punctuation and whitespace
  const words = text.split(/(\s+)/);

  // Track which instances of missed/delayed words we've already marked
  const missedWordCount = new Map<string, number>();
  const delayedWordCount = new Map<string, number>();
  
  // Count how many times each word appears in missed/delayed arrays
  missedWords.forEach(w => {
    const cleanWord = w.toLowerCase();
    missedWordCount.set(cleanWord, (missedWordCount.get(cleanWord) || 0) + 1);
  });
  
  delayedWords.forEach(w => {
    const cleanWord = w.toLowerCase();
    delayedWordCount.set(cleanWord, (delayedWordCount.get(cleanWord) || 0) + 1);
  });

  const getWordStyle = (word: string, wordIndex: number) => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    
    // Check if this instance should be marked as missed
    const missedCount = missedWordCount.get(cleanWord);
    if (missedCount && missedCount > 0) {
      missedWordCount.set(cleanWord, missedCount - 1);
      return "bg-destructive/20 text-destructive font-medium";
    }
    
    // Check if this instance should be marked as delayed
    const delayedCount = delayedWordCount.get(cleanWord);
    if (delayedCount && delayedCount > 0) {
      delayedWordCount.set(cleanWord, delayedCount - 1);
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300 font-medium";
    }
    
    if (connectorWords.some(w => w.toLowerCase() === cleanWord)) {
      return "text-muted-foreground/60 text-sm";
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
              getWordStyle(word, index)
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
