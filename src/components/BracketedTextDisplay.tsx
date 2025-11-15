import { cn } from "@/lib/utils";

interface BracketedTextDisplayProps {
  text: string;
  visibilityPercent: number;
  spokenWords?: Set<string>;
  currentWord?: string;
  isRecording: boolean;
  className?: string;
}

const BracketedTextDisplay = ({ 
  text, 
  visibilityPercent, 
  spokenWords = new Set(),
  currentWord = "",
  isRecording,
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

  const getWordStyle = (word: string, wordIndex: number) => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    
    if (!cleanWord) return "text-foreground/80";
    
    if (isRecording && currentWord === cleanWord) {
      return "bg-primary/20 text-primary font-semibold scale-105 animate-pulse";
    }
    
    if (isRecording && spokenWords.has(cleanWord)) {
      return "bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-300 font-medium";
    }
    
    return "text-foreground/80";
  };

  return (
    <div className={cn("prose prose-lg max-w-none leading-relaxed", className)}>
      {segments.map((segment, segmentIndex) => {
        if (segment.isVisible) {
          // Show individual words
          return (
            <span key={segmentIndex}>
              {segment.words.map((word, wordIndex) => {
                const globalIndex = segment.startIndex + wordIndex;
                return (
                  <span
                    key={globalIndex}
                    className={cn(
                      "inline-block px-1 rounded transition-all duration-200",
                      getWordStyle(word, globalIndex)
                    )}
                  >
                    {word}
                  </span>
                );
              })}
              {' '}
            </span>
          );
        } else {
          // Show as bracket
          const bracketContent = segment.words.join(' ');
          const allSpoken = segment.words.every(word => 
            spokenWords.has(word.toLowerCase().replace(/[^\w]/g, ''))
          );
          const someSpoken = segment.words.some(word => 
            spokenWords.has(word.toLowerCase().replace(/[^\w]/g, ''))
          );
          
          return (
            <span
              key={segmentIndex}
              className={cn(
                "inline-block px-3 py-1 mx-1 rounded-lg border-2 transition-all duration-300",
                isRecording && allSpoken && "border-green-500 bg-green-50 dark:bg-green-900/20",
                isRecording && someSpoken && !allSpoken && "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 animate-pulse",
                !isRecording && "border-muted-foreground/30 bg-muted/30",
                isRecording && !someSpoken && "border-muted-foreground/40 bg-muted/40"
              )}
              title={bracketContent}
            >
              <span className="text-muted-foreground/60 font-mono text-sm">
                [ {segment.words.length} {segment.words.length === 1 ? 'word' : 'words'} ]
              </span>
            </span>
          );
        }
      })}
    </div>
  );
};

export default BracketedTextDisplay;
