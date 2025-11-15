import { useState } from "react";
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
  const [collapsingSegments, setCollapsingSegments] = useState<Set<number>>(new Set());
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
    <div className={cn("flex flex-col gap-2 text-2xl", className)}>
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
                  "px-4 py-2 rounded-full transition-all duration-300 w-fit",
                  isCurrent && "bg-primary/20 text-primary font-semibold scale-105 animate-pulse",
                  !isCurrent && isIncorrect && "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-300 font-medium scale-95 opacity-70",
                  !isCurrent && !isIncorrect && isHesitated && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300 font-medium scale-95 opacity-70",
                  !isCurrent && !isIncorrect && !isHesitated && isSpoken && "bg-muted/30 text-foreground/30 opacity-50 scale-95",
                  !isCurrent && !isIncorrect && !isHesitated && !isSpoken && "bg-muted/10 text-foreground/80"
                )}
              >
                {word}
              </div>
            );
          });
        } else {
          // Check if this segment is completed
          const isCompleted = completedSegments.has(segmentIndex);
          const isCollapsing = collapsingSegments.has(segmentIndex);
          
          // Don't render if completed (fully disappeared)
          if (isCompleted && !isCollapsing) {
            return null;
          }
          
          // Count how many words in this segment have been spoken
          const spokenCount = segment.words.filter(word => 
            spokenWords.has(word.toLowerCase().replace(/[^\w]/g, ''))
          ).length;
          const allSpoken = spokenCount === segment.words.length;
          
          // Check if this is the current bracket (next to be spoken)
          // A bracket is current if any of its words are the current word being awaited
          const isCurrentBracket = isRecording && segment.words.some(word => {
            const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
            return currentWord === cleanWord;
          });
          
          // Trigger completion sequence when all words are spoken
          if (allSpoken && !isCompleted && !isCollapsing && isRecording) {
            // Play click sound
            const audio = new Audio('data:audio/wav;base64,UklGRhYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
            audio.play().catch(e => console.log('Audio play failed:', e));
            
            // Start collapsing animation
            setCollapsingSegments(prev => new Set([...prev, segmentIndex]));
            
            // Collapse to empty bracket after 300ms
            setTimeout(() => {
              // Mark as completed and notify parent after another 800ms
              setTimeout(() => {
                setCollapsingSegments(prev => {
                  const updated = new Set(prev);
                  updated.delete(segmentIndex);
                  return updated;
                });
                onSegmentComplete?.(segmentIndex);
              }, 800);
            }, 300);
          }
          
          return (
            <div
              key={segmentIndex}
              className={cn(
                "px-4 py-2 rounded-full border-2 transition-all duration-300 w-fit",
                isCollapsing && allSpoken && "border-green-500 bg-green-50 dark:bg-green-900/20 scale-95",
                !isCollapsing && allSpoken && "border-green-500 bg-green-50 dark:bg-green-900/20",
                !isCollapsing && !allSpoken && isCurrentBracket && "border-primary bg-primary/10 animate-pulse",
                !isCollapsing && !allSpoken && !isCurrentBracket && "border-muted-foreground/40 bg-muted/20"
              )}
            >
              <span className="font-mono text-sm">
                {isCollapsing && allSpoken ? (
                  // Empty bracket state - green and collapsing
                  <span className="text-green-600 dark:text-green-400 font-semibold animate-fade-out">
                    [ ]
                  </span>
                ) : spokenCount === 0 ? (
                  // No words spoken yet - show empty bracket
                  <span className={cn(
                    "text-muted-foreground/50",
                    isCurrentBracket && "text-primary font-semibold"
                  )}>
                    [ ]
                  </span>
                ) : spokenCount < segment.words.length ? (
                  // Partial progress - show spoken words with ellipsis
                  <>
                    <span className="text-muted-foreground/50">[ </span>
                    {segment.words.map((word, wordIndex) => {
                      const globalIndex = segment.startIndex + wordIndex;
                      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
                      const isSpoken = spokenWords.has(cleanWord);
                      const isIncorrect = incorrectWords.has(cleanWord);
                      const isHesitated = hesitatedWords.has(cleanWord);
                      const isCurrent = isRecording && currentWord === cleanWord;
                      
                      if (!isSpoken && !isCurrent) return null;
                      
                      return (
                        <span key={globalIndex}>
                          <span
                            className={cn(
                              "transition-all duration-300",
                              isIncorrect && "text-destructive font-medium",
                              isHesitated && !isIncorrect && "text-yellow-600 dark:text-yellow-400 font-medium",
                              isCurrent && "text-primary font-semibold",
                              isSpoken && !isIncorrect && !isHesitated && !isCurrent && "text-foreground/70"
                            )}
                          >
                            {word}
                          </span>
                          {wordIndex < segment.words.length - 1 && isSpoken && ' '}
                        </span>
                      );
                    })}
                    <span className="text-muted-foreground/50">…</span>
                    <span className="text-muted-foreground/50"> ]</span>
                  </>
                ) : (
                  // All words spoken - show full bracket
                  <>
                    <span className="text-muted-foreground/50">[ </span>
                    {segment.words.map((word, wordIndex) => {
                      const globalIndex = segment.startIndex + wordIndex;
                      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
                      const isIncorrect = incorrectWords.has(cleanWord);
                      const isHesitated = hesitatedWords.has(cleanWord);
                      
                      return (
                        <span key={globalIndex}>
                          <span
                            className={cn(
                              "transition-all duration-300 text-green-600 dark:text-green-400 font-medium",
                              isIncorrect && "text-destructive",
                              isHesitated && !isIncorrect && "text-yellow-600 dark:text-yellow-400"
                            )}
                          >
                            {word}
                          </span>
                          {wordIndex < segment.words.length - 1 && ' '}
                        </span>
                      );
                    })}
                    <span className="text-muted-foreground/50"> ]</span>
                  </>
                )}
              </span>
            </div>
          );
        }
      })}
    </div>
  );
};

export default BracketedTextDisplay;
