import { cn } from "@/lib/utils";
import "./SpeechTrainingLine.css";
import { Check, Circle, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  // Split into sentences first to respect sentence boundaries
  const sentences = text.split(/([.!?]+)/).filter(s => s.trim());
  
  // Process sentences and words, preserving punctuation separately
  const words: string[] = [];
  const sentenceBreaks = new Set<number>(); // Track where sentences end
  
  sentences.forEach((sentence, idx) => {
    // Skip punctuation-only segments
    if (/^[.!?]+$/.test(sentence)) {
      return;
    }
    
    const sentenceWords = sentence.split(/\s+/).filter(w => w.trim());
    sentenceWords.forEach(word => words.push(word));
    
    // Mark the end of this sentence
    if (words.length > 0) {
      sentenceBreaks.add(words.length - 1);
    }
  });
  
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

  // Group words into segments of visible/hidden, respecting sentence boundaries
  const segments: Array<{ words: string[], isVisible: boolean, startIndex: number }> = [];
  let currentSegment: string[] = [];
  let currentSegmentVisible = visibleIndices.has(0);
  let segmentStartIndex = 0;

  words.forEach((word, index) => {
    const shouldBeVisible = visibleIndices.has(index);
    const isSentenceEnd = sentenceBreaks.has(index);
    
    // Force new segment at sentence boundaries (no dots in brackets)
    if (isSentenceEnd && currentSegment.length > 0) {
      currentSegment.push(word);
      segments.push({ 
        words: currentSegment, 
        isVisible: currentSegmentVisible,
        startIndex: segmentStartIndex
      });
      currentSegment = [];
      segmentStartIndex = index + 1;
      currentSegmentVisible = visibleIndices.has(index + 1);
    } else if (shouldBeVisible !== currentSegmentVisible) {
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

  // Split large hidden segments into smaller chunks (max 4 words per bracket)
  const MAX_WORDS_PER_BRACKET = 4;
  const finalSegments: Array<{ words: string[], isVisible: boolean, startIndex: number }> = [];
  
  segments.forEach(segment => {
    if (!segment.isVisible && segment.words.length > MAX_WORDS_PER_BRACKET) {
      // Split this hidden segment into smaller chunks
      for (let i = 0; i < segment.words.length; i += MAX_WORDS_PER_BRACKET) {
        const chunkWords = segment.words.slice(i, i + MAX_WORDS_PER_BRACKET);
        finalSegments.push({
          words: chunkWords,
          isVisible: false,
          startIndex: segment.startIndex + i
        });
      }
    } else {
      finalSegments.push(segment);
    }
  });


  return (
    <div className={cn("speech-line flex flex-wrap gap-1 items-center text-2xl", className)}>
      {finalSegments.map((segment, segmentIndex) => {
        if (segment.isVisible) {
          // Show individual words inline with circles
          return segment.words.map((word, wordIndex) => {
            const globalIndex = segment.startIndex + wordIndex;
            const isSpoken = spokenWordsIndices.has(globalIndex);
            const isHesitated = hesitatedWordsIndices.has(globalIndex);
            const isMissed = missedWordsIndices.has(globalIndex);
            const isCurrent = isRecording && currentWordIndex === globalIndex;
            
            return (
              <TooltipProvider key={globalIndex}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "word-block transition-all duration-300",
                        isCurrent && "current-word text-xl font-bold",
                        !isCurrent && isMissed && "word-red scale-95",
                        !isCurrent && !isMissed && isHesitated && "word-yellow scale-95",
                        !isCurrent && !isMissed && !isHesitated && isSpoken && "past-word opacity-40",
                        !isCurrent && !isMissed && !isHesitated && !isSpoken && "word-gray"
                      )}
                    >
                      {word}
                    </span>
                  </TooltipTrigger>
                  {(isMissed || isHesitated) && (
                    <TooltipContent side="top">
                      {isMissed ? (
                        <p className="text-xs text-red-600">❌ Skipped or incorrect</p>
                      ) : (
                        <p className="text-xs text-yellow-600">⚠️ Hesitated here</p>
                      )}
                    </TooltipContent>
                  )}
                  {isSpoken && !isMissed && !isHesitated && (
                    <TooltipContent side="top">
                      <p className="text-xs text-green-600">✓ Spoken correctly</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          });
        } else {
          // Hidden segment - only show words that are red (missed) or yellow (hesitated)
          // Words said correctly without support should remain hidden
          
          // Collect words that need to stay visible (red or yellow only)
          const visibleErrorWords: Array<{ word: string, globalIndex: number, isMissed: boolean, isHesitated: boolean }> = [];
          
          segment.words.forEach((word, idx) => {
            const globalIdx = segment.startIndex + idx;
            const isMissed = missedWordsIndices.has(globalIdx);
            const isHesitated = hesitatedWordsIndices.has(globalIdx);
            
            if (isMissed || isHesitated) {
              visibleErrorWords.push({ word, globalIndex: globalIdx, isMissed, isHesitated });
            }
          });
          
          // Count all processed words (including correctly spoken ones)
          const processedCount = segment.words.filter((_, idx) => {
            const globalIdx = segment.startIndex + idx;
            return spokenWordsIndices.has(globalIdx) || 
                   hesitatedWordsIndices.has(globalIdx) || 
                   missedWordsIndices.has(globalIdx);
          }).length;
          
          const allProcessed = processedCount === segment.words.length;
          const hasErrors = visibleErrorWords.length > 0;
          
          // Determine bracket state
          let bracketState: "empty" | "filling" | "complete" | "error" = "empty";
          
          if (allProcessed && !hasErrors) {
            // All words processed correctly - show empty green bracket
            bracketState = "complete";
          } else if (hasErrors) {
            // Some words have errors - show them
            bracketState = "error";
          } else if (processedCount > 0) {
            // Some words processed (correctly) - filling but nothing to show
            bracketState = "filling";
          } else {
            // No words processed yet - empty blue pulsing bracket
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
                "px-3 py-2 rounded-full transition-all duration-300 flex items-center gap-1.5 whitespace-nowrap relative group",
                bracketState === "complete" && "bg-green-50 dark:bg-green-900/20 border-2 border-green-500 hover:shadow-lg hover:shadow-green-500/20",
                bracketState === "error" && "bg-muted/20 border-2 border-muted-foreground/40 hover:shadow-lg hover:shadow-red-500/20",
                bracketState === "filling" && "bg-primary/10 border-2 border-primary/50 hover:shadow-lg hover:shadow-primary/30",
                bracketState === "empty" && isCurrentBracket && "bg-primary/10 border-4 border-primary shadow-lg shadow-primary/50 scale-105 animate-pulse",
                bracketState === "empty" && !isCurrentBracket && "bg-muted/20 border-2 border-muted-foreground/40"
              )}
            >
              {/* Visual separator for error brackets */}
              {bracketState === "error" && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md">
                  !
                </div>
              )}
              
              {/* Icon indicator for bracket state */}
              {bracketState === "complete" && (
                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400 animate-in zoom-in" />
              )}
              {bracketState === "filling" && (
                <Circle className="w-3 h-3 text-primary animate-pulse" />
              )}
              
              {/* Word count badge or progress indicator */}
              {bracketState === "empty" && (
                <span className={cn(
                  "text-xs font-semibold px-2 py-1 rounded-full",
                  isCurrentBracket ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {segment.words.length}
                </span>
              )}
              
              {bracketState === "filling" && (
                <span className={cn(
                  "text-xs font-semibold px-2 py-1 rounded-full bg-primary/20 text-primary"
                )}>
                  {processedCount}/{segment.words.length}
                </span>
              )}
              
              {/* Error words display with tooltips */}
              {visibleErrorWords.length > 0 && (
                <TooltipProvider>
                  <div className="flex items-center gap-1 flex-wrap">
                    {visibleErrorWords.map((errorWord, idx) => (
                      <Tooltip key={`${errorWord.globalIndex}-${idx}`}>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "text-sm px-1.5 py-0.5 rounded transition-all duration-300 cursor-help border-2",
                              errorWord.isMissed && "bg-red-500/20 text-red-700 dark:text-red-400 font-semibold border-red-500/40",
                              !errorWord.isMissed && errorWord.isHesitated && "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 font-semibold border-yellow-500/40"
                            )}
                          >
                            {errorWord.word}
                            {errorWord.isMissed && (
                              <AlertCircle className="inline-block w-3 h-3 ml-1" />
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {errorWord.isMissed ? (
                            <div className="space-y-1">
                              <p className="font-semibold text-red-600">❌ Missed Word</p>
                              <p className="text-xs">You skipped or didn't say this word correctly.</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="font-semibold text-yellow-600">⚠️ Hesitated Word</p>
                              <p className="text-xs">You paused too long or needed support to say this word.</p>
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    <span className={cn(
                      "text-xs font-semibold px-2 py-1 rounded-full ml-1",
                      visibleErrorWords.some(w => w.isMissed) && visibleErrorWords.some(w => w.isHesitated && !w.isMissed)
                        ? "bg-gradient-to-r from-red-500/30 to-yellow-500/30 text-red-700"
                        : visibleErrorWords.some(w => w.isMissed)
                        ? "bg-red-500/30 text-red-700"
                        : "bg-yellow-500/30 text-yellow-700"
                    )}>
                      {visibleErrorWords.length}
                    </span>
                  </div>
                </TooltipProvider>
              )}
            </div>
          );
        }
      })}
    </div>
  );
};

export default BracketedTextDisplay;
