import { cn } from "@/lib/utils";
import "./SpeechTrainingLine.css";

interface BracketedTextDisplayProps {
  text: string;
  visibilityPercent: number;
  spokenWordsIndices?: Set<number>;
  hesitatedWordsIndices?: Set<number>;
  missedWordsIndices?: Set<number>;
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
  missedWordsIndices = new Set(),
  currentWordIndex = -1,
  isRecording,
  className 
}: BracketedTextDisplayProps) => {
  const words = text.split(/\s+/).filter(w => w.trim());
  const totalWords = words.length;
  
  // Calculate which words should be visible based on importance
  // DISTRIBUTED across all sections of the script
  const visibleIndices = new Set<number>();
  
  if (visibilityPercent >= 100) {
    // All words visible
    for (let i = 0; i < totalWords; i++) {
      visibleIndices.add(i);
    }
  } else if (visibilityPercent > 0) {
    // Divide script into sections and distribute visible words evenly
    const SECTION_COUNT = 10; // Divide script into 10 sections
    const sectionSize = Math.ceil(totalWords / SECTION_COUNT);
    const visibleCount = Math.ceil((visibilityPercent / 100) * totalWords);
    const visiblePerSection = Math.ceil(visibleCount / SECTION_COUNT);
    
    // For each section, select the most important words to keep visible
    for (let sectionIndex = 0; sectionIndex < SECTION_COUNT; sectionIndex++) {
      const sectionStart = sectionIndex * sectionSize;
      const sectionEnd = Math.min(sectionStart + sectionSize, totalWords);
      
      // Score words within this section
      const sectionWords = [];
      for (let i = sectionStart; i < sectionEnd; i++) {
        const word = words[i];
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
        const isSimple = SIMPLE_WORDS.has(cleanWord);
        
        sectionWords.push({
          index: i,
          score: isSimple ? 1 : 3, // Simple words hidden first, important words kept longer
          word
        });
      }
      
      // Sort by score within this section and take top words
      sectionWords.sort((a, b) => b.score - a.score);
      
      // Add visible words from this section
      for (let i = 0; i < Math.min(visiblePerSection, sectionWords.length); i++) {
        visibleIndices.add(sectionWords[i].index);
      }
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
            const isMissed = missedWordsIndices.has(globalIndex);
            const isCurrent = isRecording && currentWordIndex === globalIndex;
            
            return (
              <span
                key={globalIndex}
                className={cn(
                  "word-block",
                  isCurrent && "current-word",
                  !isCurrent && isMissed && "word-red",
                  !isCurrent && !isMissed && isHesitated && "word-yellow",
                  !isCurrent && !isMissed && !isHesitated && isSpoken && "past-word",
                  !isCurrent && !isMissed && !isHesitated && !isSpoken && "word-gray"
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
          
          const missedIndicesInSegment = segment.words
            .map((_, idx) => segment.startIndex + idx)
            .filter(idx => missedWordsIndices.has(idx));
          
          const spokenWordsInSegment = spokenIndicesInSegment.map(idx => words[idx]);
          const hesitatedWordsInSegment = hesitatedIndicesInSegment.map(idx => words[idx]);
          const missedWordsInSegment = missedIndicesInSegment.map(idx => words[idx]);
          
          const allSpoken = spokenWordsInSegment.length === segment.words.length;
          const hasErrors = hesitatedWordsInSegment.length > 0 || missedWordsInSegment.length > 0;
          
          // Determine what to show in the bracket
          let bracketContent = "";
          let bracketState: "empty" | "filling" | "complete" | "errors" = "empty";
          
          if (allSpoken && !hasErrors) {
            // All words spoken correctly - bracket will turn green and disappear (don't render)
            return null;
          } else if (hasErrors) {
            // Some errors - show ONLY error words (hesitated in yellow, missed in red)
            const errorWords = [];
            // Check each word in segment for errors
            segment.words.forEach((word, idx) => {
              const globalIdx = segment.startIndex + idx;
              if (hesitatedWordsIndices.has(globalIdx)) {
                errorWords.push({ word, type: 'hesitated' });
              } else if (missedWordsIndices.has(globalIdx)) {
                errorWords.push({ word, type: 'missed' });
              }
            });
            
            if (errorWords.length > 0) {
              bracketState = "errors";
              // Render error words with individual colors
              bracketContent = errorWords.map(({ word, type }) => 
                `<span class="${type === 'hesitated' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}">${word}</span>`
              ).join(" ");
            } else {
              return null; // No errors to show
            }
          } else if (spokenWordsInSegment.length > 0) {
            // Some words spoken correctly - show them filling in
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
                bracketState === "errors" && "bg-muted/20 border-2 border-muted-foreground/40",
                bracketState === "filling" && "bg-primary/10 border-2 border-primary/40",
                bracketState === "empty" && isCurrentBracket && "bg-primary/10 border-2 border-primary animate-pulse",
                bracketState === "empty" && !isCurrentBracket && "bg-muted/20 border-2 border-muted-foreground/40"
              )}
            >
              <span className={cn(
                "font-mono text-sm",
                bracketState === "errors" && "text-muted-foreground/50",
                bracketState === "filling" && "text-primary",
                bracketState === "empty" && "text-muted-foreground/50"
              )}>
                [
              </span>
              {bracketContent && (
                <span 
                  className={cn(
                    "text-base px-1",
                    bracketState === "filling" && "text-primary"
                  )}
                  dangerouslySetInnerHTML={bracketState === "errors" ? { __html: bracketContent } : undefined}
                >
                  {bracketState !== "errors" && bracketContent}
                </span>
              )}
              <span className={cn(
                "font-mono text-sm",
                bracketState === "errors" && "text-muted-foreground/50",
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
