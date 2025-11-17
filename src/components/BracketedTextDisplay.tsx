import { cn } from "@/lib/utils";
import "./SpeechTrainingLine.css";

interface BracketedTextDisplayProps {
  text: string;
  visibilityPercent: number;
  spokenWordsIndices?: Set<number>;
  hesitatedWordsIndices?: Set<number>;
  currentWordIndex?: number;
  isRecording: boolean;
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
  spokenWordsIndices = new Set(),
  hesitatedWordsIndices = new Set(),
  currentWordIndex = -1,
  isRecording,
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


  return (
    <div className={cn("speech-line flex flex-wrap gap-1 items-center", className)}>
      {segments.map((segment, segmentIndex) => {
        if (segment.isVisible) {
          // Show individual words inline with circles
          return segment.words.map((word, wordIndex) => {
            const globalIndex = segment.startIndex + wordIndex;
            const isSpoken = spokenWordsIndices.has(globalIndex);
            const isHesitated = hesitatedWordsIndices.has(globalIndex);
            const isCurrent = isRecording && currentWordIndex === globalIndex;
            
            return (
              <span
                key={globalIndex}
                className={cn(
                  "word-block relative inline-flex items-center justify-center",
                  "before:content-[''] before:absolute before:inset-0 before:rounded-full before:border before:border-muted-foreground/30",
                  isCurrent && "current-word before:border-primary before:border-2",
                  !isCurrent && isHesitated && "word-yellow before:border-yellow-500",
                  !isCurrent && !isHesitated && isSpoken && "past-word word-gray before:border-muted-foreground/20",
                  !isCurrent && !isHesitated && !isSpoken && "word-gray before:border-muted-foreground/30"
                )}
              >
                {word}
              </span>
            );
          });
        } else {
          // Hidden segment - show bracket with spoken words appearing inside
          const spokenIndicesInSegment = segment.words
            .map((_, idx) => segment.startIndex + idx)
            .filter(idx => spokenWordsIndices.has(idx));
          
          const hesitatedIndicesInSegment = segment.words
            .map((_, idx) => segment.startIndex + idx)
            .filter(idx => hesitatedWordsIndices.has(idx));
          
          const spokenWordsInSegment = spokenIndicesInSegment.map(idx => words[idx]);
          const hesitatedWordsInSegment = hesitatedIndicesInSegment.map(idx => words[idx]);
          
          const allSpoken = spokenWordsInSegment.length === segment.words.length;
          const hasErrors = hesitatedWordsInSegment.length > 0;
          
          // Determine what to show in the bracket
          let bracketContent = "";
          let bracketState: "empty" | "filling" | "complete" | "errors" = "empty";
          
          if (allSpoken && !hasErrors) {
            // All words spoken correctly - show empty green bracket
            bracketContent = "";
            bracketState = "complete";
          } else if (hasErrors && spokenWordsInSegment.length === segment.words.length) {
            // All words attempted but some had errors - show only error words
            bracketContent = hesitatedWordsInSegment.join(" ");
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
          
          const isCurrentBracket = isRecording && segment.words.some((_, idx) => {
            const globalIdx = segment.startIndex + idx;
            return currentWordIndex === globalIdx;
          });
          
          return (
            <div
              key={segmentIndex}
              className={cn(
                "px-4 py-2 rounded-full transition-all duration-300 flex items-center gap-1 whitespace-nowrap",
                bracketState === "complete" && "bg-green-50 dark:bg-green-900/20 border-2 border-green-500 animate-[scale-in_0.3s_ease-out]",
                bracketState === "errors" && "bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-500 animate-[scale-in_0.3s_ease-out]",
                bracketState === "filling" && "bg-primary/10 border-2 border-primary/40",
                bracketState === "empty" && isCurrentBracket && "bg-primary/10 border-2 border-primary animate-pulse",
                bracketState === "empty" && !isCurrentBracket && "bg-muted/20 border-2 border-muted-foreground/40"
              )}
            >
              <span className={cn(
                "font-mono text-sm",
                bracketState === "complete" && "text-green-600 dark:text-green-400",
                bracketState === "errors" && "text-yellow-600 dark:text-yellow-400",
                bracketState === "filling" && "text-primary",
                bracketState === "empty" && "text-muted-foreground/50"
              )}>
                [
              </span>
              {bracketContent && (
                <span className={cn(
                  "text-base px-1",
                  bracketState === "complete" && "text-green-600 dark:text-green-400",
                  bracketState === "errors" && "text-yellow-900 dark:text-yellow-300",
                  bracketState === "filling" && "text-primary"
                )}>
                  {bracketContent}
                </span>
              )}
              <span className={cn(
                "font-mono text-sm",
                bracketState === "complete" && "text-green-600 dark:text-green-400",
                bracketState === "errors" && "text-yellow-600 dark:text-yellow-400",
                bracketState === "filling" && "text-primary",
                bracketState === "empty" && "text-muted-foreground/50"
              )}>
                ]
              </span>
            </div>
          );
        }
      })}
    </div>
  );
};

export default BracketedTextDisplay;
