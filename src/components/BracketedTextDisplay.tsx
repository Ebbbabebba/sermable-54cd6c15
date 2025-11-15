import { cn } from "@/lib/utils";

interface BracketedTextDisplayProps {
  text: string;
  visibilityPercent: number;
  spokenWords?: Set<string>;
  incorrectWords?: Set<string>;
  hesitatedWords?: Set<string>;
  completedSegments?: Set<number>;
  currentWord?: string;
  isRecording: boolean;
  onSegmentComplete?: (segmentIndex: number) => void;
  className?: string;
}

// Common simple words to hide first
const SIMPLE_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'that', 'this', 'these', 'those', 'it', 'its', 'as', 'if', 'then', 'than',
  'so', 'very', 'just', 'can', 'your', 'my', 'our', 'their', 'his', 'her'
]);

const BracketedTextDisplay = ({ 
  text, 
  visibilityPercent, 
  spokenWords = new Set(),
  incorrectWords = new Set(),
  hesitatedWords = new Set(),
  completedSegments = new Set(),
  currentWord = "",
  isRecording,
  onSegmentComplete,
  className 
}: BracketedTextDisplayProps) => {
  const words = text.split(/\s+/).filter(w => w.trim());
  const totalWords = words.length;
  
  // Calculate which words should be visible based on importance
  const visibleIndices = new Set<number>();
  
  if (visibilityPercent >= 100) {
    // All words visible
    for (let i = 0; i < totalWords; i++) {
      visibleIndices.add(i);
    }
  } else if (visibilityPercent > 0) {
    // Prioritize hiding simple words first
    const wordScores = words.map((word, index) => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      const isSimple = SIMPLE_WORDS.has(cleanWord);
      
      // Simple words get lower scores (hidden first)
      // Important words get higher scores (kept visible longer)
      return {
        index,
        score: isSimple ? 1 : 3,
        word
      };
    });
    
    // Sort by score (highest first) and take top percentage
    const visibleCount = Math.ceil((visibilityPercent / 100) * totalWords);
    const sortedWords = wordScores.sort((a, b) => b.score - a.score);
    
    for (let i = 0; i < visibleCount && i < sortedWords.length; i++) {
      visibleIndices.add(sortedWords[i].index);
    }
  }

  // Group words into segments of visible/hidden
  const segments: Array<{ words: string[], isVisible: boolean, startIndex: number }> = [];
  let currentSegment: string[] = [];
  let currentSegmentVisible = visibleIndices.has(0);
  let segmentStartIndex = 0;

  words.forEach((word, index) => {
    const shouldBeVisible = visibleIndices.has(index);
    
    if (shouldBeVisible !== currentSegmentVisible) {
      // Save current segment and start new one
      if (currentSegment.length > 0) {
        segments.push({ 
          words: currentSegment, 
          isVisible: currentSegmentVisible,
          startIndex: segmentStartIndex
        });
      }
      currentSegment = [word];
      currentSegmentVisible = shouldBeVisible;
      segmentStartIndex = index;
    } else {
      currentSegment.push(word);
    }
  });
  
  // Add final segment
  if (currentSegment.length > 0) {
    segments.push({ 
      words: currentSegment, 
      isVisible: currentSegmentVisible,
      startIndex: segmentStartIndex
    });
  }

  // Find extra words that were spoken but not in original text
  const allOriginalWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));
  const extraSpokenWords = Array.from(incorrectWords).filter(word => !allOriginalWords.has(word));

  return (
    <div className={cn("flex flex-wrap gap-2 text-2xl items-center", className)}>
      {segments.map((segment, segmentIndex) => {
        if (segment.isVisible) {
          // Show individual words as pills
          return segment.words.map((word, wordIndex) => {
            const globalIndex = segment.startIndex + wordIndex;
            const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
            const isSpoken = spokenWords.has(cleanWord);
            const isIncorrect = incorrectWords.has(cleanWord);
            const isHesitated = hesitatedWords.has(cleanWord);
            const isCurrent = isRecording && currentWord === cleanWord;
            
            return (
              <div
                key={globalIndex}
                className={cn(
                  "px-4 py-2 rounded-full transition-all duration-300 flex items-center whitespace-nowrap",
                  isCurrent && "bg-primary/20 text-primary font-semibold scale-105 animate-pulse",
                  !isCurrent && isIncorrect && "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-300 font-medium scale-95 opacity-70",
                  !isCurrent && !isIncorrect && isHesitated && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300 font-medium scale-95 opacity-70",
                  !isCurrent && !isIncorrect && !isHesitated && isSpoken && "bg-muted/30 text-foreground/30 opacity-50 scale-95",
                  !isCurrent && !isIncorrect && !isHesitated && !isSpoken && "bg-muted/20 text-foreground/80 border border-muted-foreground/20"
                )}
              >
                <span>{word}</span>
              </div>
            );
          });
        } else {
          // Hidden segment - show bracket with spoken words appearing inside
          const spokenWordsInSegment = segment.words.filter(word => 
            spokenWords.has(word.toLowerCase().replace(/[^\w]/g, ''))
          );
          const incorrectWordsInSegment = segment.words.filter(word => 
            incorrectWords.has(word.toLowerCase().replace(/[^\w]/g, ''))
          );
          const hesitatedWordsInSegment = segment.words.filter(word => 
            hesitatedWords.has(word.toLowerCase().replace(/[^\w]/g, ''))
          );
          
          const allSpoken = spokenWordsInSegment.length === segment.words.length;
          const hasErrors = incorrectWordsInSegment.length > 0 || hesitatedWordsInSegment.length > 0;
          
          // Determine what to show in the bracket
          let bracketContent = "";
          let bracketState: "empty" | "filling" | "complete" | "errors" = "empty";
          
          if (allSpoken && !hasErrors) {
            // All words spoken correctly - show empty green bracket
            bracketContent = "";
            bracketState = "complete";
          } else if (hasErrors && spokenWordsInSegment.length === segment.words.length) {
            // All words attempted but some had errors - show only error words
            bracketContent = [...incorrectWordsInSegment, ...hesitatedWordsInSegment].join(" ");
            bracketState = "errors";
          } else if (spokenWordsInSegment.length > 0) {
            // Some words spoken - show them
            bracketContent = spokenWordsInSegment.join(" ");
            bracketState = "filling";
          } else {
            // No words spoken yet - empty blue pulsing bracket
            bracketContent = "";
            bracketState = "empty";
          }
          
          const isCurrentBracket = isRecording && segment.words.some(word => {
            const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
            return currentWord === cleanWord;
          });
          
          return (
            <div
              key={segmentIndex}
              className={cn(
                "px-4 py-2 rounded-full transition-all duration-300 flex items-center gap-1 whitespace-nowrap",
                bracketState === "complete" && "bg-green-50 dark:bg-green-900/20 border-2 border-green-500 animate-[scale-in_0.3s_ease-out]",
                bracketState === "errors" && hesitatedWordsInSegment.length > 0 && "bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-500 animate-[scale-in_0.3s_ease-out]",
                bracketState === "errors" && incorrectWordsInSegment.length > 0 && "bg-red-100 dark:bg-red-900/30 border-2 border-red-500 animate-[scale-in_0.3s_ease-out]",
                bracketState === "filling" && "bg-primary/10 border-2 border-primary/40",
                bracketState === "empty" && isCurrentBracket && "bg-primary/10 border-2 border-primary animate-pulse",
                bracketState === "empty" && !isCurrentBracket && "bg-muted/20 border-2 border-muted-foreground/40"
              )}
            >
              <span className={cn(
                "font-mono text-sm",
                bracketState === "complete" && "text-green-600 dark:text-green-400",
                bracketState === "errors" && hesitatedWordsInSegment.length > 0 && "text-yellow-600 dark:text-yellow-400",
                bracketState === "errors" && incorrectWordsInSegment.length > 0 && "text-red-600 dark:text-red-400",
                bracketState === "filling" && "text-primary",
                bracketState === "empty" && "text-muted-foreground/50"
              )}>
                [
              </span>
              {bracketContent && (
                <span className={cn(
                  "text-base px-1",
                  bracketState === "complete" && "text-green-600 dark:text-green-400",
                  bracketState === "errors" && hesitatedWordsInSegment.length > 0 && "text-yellow-900 dark:text-yellow-300",
                  bracketState === "errors" && incorrectWordsInSegment.length > 0 && "text-red-900 dark:text-red-300",
                  bracketState === "filling" && "text-primary"
                )}>
                  {bracketContent}
                </span>
              )}
              <span className={cn(
                "font-mono text-sm",
                bracketState === "complete" && "text-green-600 dark:text-green-400",
                bracketState === "errors" && hesitatedWordsInSegment.length > 0 && "text-yellow-600 dark:text-yellow-400",
                bracketState === "errors" && incorrectWordsInSegment.length > 0 && "text-red-600 dark:text-red-400",
                bracketState === "filling" && "text-primary",
                bracketState === "empty" && "text-muted-foreground/50"
              )}>
                ]
              </span>
            </div>
          );
        }
      })}
      
      {/* Show extra words spoken that aren't in the original text */}
      {extraSpokenWords.map((word, index) => (
        <div
          key={`extra-${index}`}
          className="px-4 py-2 rounded-full transition-all duration-300 flex items-center gap-2 whitespace-nowrap bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-300 font-medium scale-95 opacity-70"
        >
          <span className="text-red-600 dark:text-red-400 font-mono text-sm">✗</span>
          <span>{word}</span>
        </div>
      ))}
    </div>
  );
};

export default BracketedTextDisplay;
