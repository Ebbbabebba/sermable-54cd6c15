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
  const visibleCount = Math.ceil((visibilityPercent / 100) * totalWords);
  
  // Calculate which words should be visible (evenly distributed)
  const visibleIndices = new Set<number>();
  if (visibilityPercent >= 100) {
    // All words visible
    for (let i = 0; i < totalWords; i++) {
      visibleIndices.add(i);
    }
  } else if (visibilityPercent > 0) {
    // Distribute visible words evenly throughout the text
    const step = totalWords / visibleCount;
    for (let i = 0; i < visibleCount; i++) {
      visibleIndices.add(Math.floor(i * step));
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
          // Hidden segment - show [] indicator
          const spokenCount = segment.words.filter(word => 
            spokenWords.has(word.toLowerCase().replace(/[^\w]/g, ''))
          ).length;
          const allSpoken = spokenCount === segment.words.length;
          
          const isCurrentBracket = isRecording && segment.words.some(word => {
            const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
            return currentWord === cleanWord;
          });
          
          return (
            <div
              key={segmentIndex}
              className={cn(
                "px-4 py-2 rounded-full border-2 transition-all duration-300 flex items-center whitespace-nowrap",
                allSpoken && "border-green-500 bg-green-50 dark:bg-green-900/20",
                !allSpoken && isCurrentBracket && "border-primary bg-primary/10 animate-pulse",
                !allSpoken && !isCurrentBracket && "border-muted-foreground/40 bg-muted/20"
              )}
            >
              <span className="font-mono text-sm text-muted-foreground/50">
                [ ]
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
