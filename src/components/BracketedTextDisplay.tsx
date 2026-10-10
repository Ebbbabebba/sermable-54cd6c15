import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import "./SpeechTrainingLine.css";
import { Check, Circle, Eye, Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { stripPropCueMarkers } from "@/utils/propCues";

// Phrase data from speech_phrases table for chunk-based recall visualization
export interface PhraseInfo {
  startIndex: number;
  endIndex: number;
  timesMissed: number;
  timesCorrect: number;
}

interface BracketedTextDisplayProps {
  text: string;
  hiddenWordIndices?: Set<number>; // Use this instead of visibilityPercent when provided
  visibilityPercent?: number; // Fallback if hiddenWordIndices not provided
  spokenWordsIndices?: Set<number>;
  hesitatedWordsIndices?: Set<number>;
  missedWordsIndices?: Set<number>;
  currentWordIndex?: number;
  isRecording: boolean;
  className?: string;
  onPeekWord?: (index: number) => void;
  hintingWordIndex?: number;
  hintLevel?: 0 | 1 | 2 | 3;
  // Chunk-based recall: phrases with high times_missed are "problem phrases"
  problemPhrases?: PhraseInfo[];
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

// Group words into natural phrases based on punctuation
const groupIntoNaturalPhrases = (words: string[]): { startIndex: number; endIndex: number }[] => {
  const phrases: { startIndex: number; endIndex: number }[] = [];
  let phraseStart = 0;
  
  words.forEach((word, index) => {
    // Check if word ends with punctuation that marks a phrase boundary
    const endsWithPause = /[,;:\-–—]$/.test(word);
    const endsWithSentence = /[.!?]$/.test(word);
    
    // Create phrase boundary at punctuation or every 4-6 words for natural rhythm
    const phraseLength = index - phraseStart + 1;
    const shouldBreak = endsWithPause || endsWithSentence || phraseLength >= 5;
    
    if (shouldBreak || index === words.length - 1) {
      phrases.push({ startIndex: phraseStart, endIndex: index });
      phraseStart = index + 1;
    }
  });
  
  return phrases;
};

const BracketedTextDisplay = ({ 
  text, 
  hiddenWordIndices,
  visibilityPercent = 100, 
  spokenWordsIndices = new Set(),
  hesitatedWordsIndices = new Set(),
  missedWordsIndices = new Set(),
  currentWordIndex = -1,
  isRecording,
  className,
  onPeekWord,
  hintingWordIndex = -1,
  hintLevel = 0,
  problemPhrases = []
}: BracketedTextDisplayProps) => {
  const [peekedBrackets, setPeekedBrackets] = useState<Set<number>>(new Set());
  const [expandedBrackets, setExpandedBrackets] = useState<Set<number>>(new Set());
  
  // Defensive cleanup: raw storage text may still contain invisible prop-cue
  // metadata, but it must never appear as a word in any practice view.
  const words = stripPropCueMarkers(text).split(/\s+/).filter(w => w.trim());
  const totalWords = words.length;
  
  // Build a map of word indices to their problem phrase info (for chunk-based recall visualization)
  const problemPhraseMap = useMemo(() => {
    const map = new Map<number, { timesMissed: number; isInProblemPhrase: boolean }>();
    problemPhrases.forEach(phrase => {
      // Only highlight phrases with 2+ misses as "problem" areas
      if (phrase.timesMissed >= 2) {
        for (let i = phrase.startIndex; i <= phrase.endIndex; i++) {
          map.set(i, { timesMissed: phrase.timesMissed, isInProblemPhrase: true });
        }
      }
    });
    return map;
  }, [problemPhrases]);
  
  // Calculate which words should be visible
  // Use hiddenWordIndices if provided, otherwise fall back to visibilityPercent calculation
  const visibleIndices = new Set<number>();
  
  if (hiddenWordIndices && hiddenWordIndices.size > 0) {
    // Use provided hidden indices - all words NOT in hiddenWordIndices are visible
    for (let i = 0; i < totalWords; i++) {
      if (!hiddenWordIndices.has(i)) {
        visibleIndices.add(i);
      }
    }
    console.log('📊 Using hiddenWordIndices, visible:', [...visibleIndices], 'hidden:', [...hiddenWordIndices]);
  } else if (visibilityPercent >= 100) {
    // All words visible
    for (let i = 0; i < totalWords; i++) {
      visibleIndices.add(i);
    }
  } else if (visibilityPercent > 0) {
    // Calculate based on visibility percent and word importance
    const SECTION_COUNT = 10;
    const sectionSize = Math.ceil(totalWords / SECTION_COUNT);
    const visibleCount = Math.ceil((visibilityPercent / 100) * totalWords);
    const visiblePerSection = Math.ceil(visibleCount / SECTION_COUNT);
    
    for (let sectionIndex = 0; sectionIndex < SECTION_COUNT; sectionIndex++) {
      const sectionStart = sectionIndex * sectionSize;
      const sectionEnd = Math.min(sectionStart + sectionSize, totalWords);
      
      const sectionWords = [];
      for (let i = sectionStart; i < sectionEnd; i++) {
        const word = words[i];
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
        const isSimple = SIMPLE_WORDS.has(cleanWord);
        sectionWords.push({ index: i, score: isSimple ? 1 : 3, word });
      }
      
      sectionWords.sort((a, b) => b.score - a.score);
      for (let i = 0; i < Math.min(visiblePerSection, sectionWords.length); i++) {
        visibleIndices.add(sectionWords[i].index);
      }
    }
  }

  // Group words into segments
  const segments: Array<{ words: string[], isVisible: boolean, startIndex: number }> = [];
  let currentSegment: string[] = [];
  let currentSegmentVisible = visibleIndices.has(0);
  let segmentStartIndex = 0;

  words.forEach((word, index) => {
    const shouldBeVisible = visibleIndices.has(index);
    if (shouldBeVisible !== currentSegmentVisible) {
      if (currentSegment.length > 0) {
        segments.push({ words: currentSegment, isVisible: currentSegmentVisible, startIndex: segmentStartIndex });
      }
      currentSegment = [word];
      currentSegmentVisible = shouldBeVisible;
      segmentStartIndex = index;
    } else {
      currentSegment.push(word);
    }
  });
  if (currentSegment.length > 0) {
    segments.push({ words: currentSegment, isVisible: currentSegmentVisible, startIndex: segmentStartIndex });
  }

  // Split large hidden segments into smaller chunks
  const MAX_WORDS_PER_BRACKET = 4;
  const finalSegments: Array<{ words: string[], isVisible: boolean, startIndex: number }> = [];
  
  segments.forEach(segment => {
    if (!segment.isVisible && segment.words.length > MAX_WORDS_PER_BRACKET) {
      for (let i = 0; i < segment.words.length; i += MAX_WORDS_PER_BRACKET) {
        const chunkWords = segment.words.slice(i, i + MAX_WORDS_PER_BRACKET);
        finalSegments.push({ words: chunkWords, isVisible: false, startIndex: segment.startIndex + i });
      }
    } else {
      finalSegments.push(segment);
    }
  });

  // Tap to peek handler
  const handleBracketTap = useCallback((segmentIndex: number, startIndex: number) => {
    if (peekedBrackets.has(segmentIndex)) {
      // Double tap - expand fully
      setExpandedBrackets(prev => new Set([...prev, segmentIndex]));
      // Mark these words as peeked (will be yellow)
      if (onPeekWord) {
        const segment = finalSegments[segmentIndex];
        segment.words.forEach((_, idx) => onPeekWord(startIndex + idx));
      }
    } else {
      // Single tap - show first letters
      setPeekedBrackets(prev => new Set([...prev, segmentIndex]));
    }
  }, [peekedBrackets, finalSegments, onPeekWord]);

  // Get hint text for a word
  const getWordHint = (word: string, level: number) => {
    if (level === 1) return word.slice(0, 1) + "___";
    if (level === 2) return word.slice(0, Math.ceil(word.length / 2)) + "...";
    return word;
  };

  // Group words into natural phrases for smoother highlighting
  const naturalPhrases = useMemo(() => groupIntoNaturalPhrases(words), [words]);
  
  // Find which phrase the current word belongs to
  const currentPhraseIndex = useMemo(() => {
    if (currentWordIndex < 0) return -1;
    return naturalPhrases.findIndex(
      phrase => currentWordIndex >= phrase.startIndex && currentWordIndex <= phrase.endIndex
    );
  }, [currentWordIndex, naturalPhrases]);

  return (
    <div className={cn("speech-line s-c5 s-cb s-dm s-ib s-ip", className)}>
      {finalSegments.map((segment, segmentIndex) => {
        if (segment.isVisible) {
          return segment.words.map((word, wordIndex) => {
            const globalIndex = segment.startIndex + wordIndex;
            const isSpoken = spokenWordsIndices.has(globalIndex);
            const isHesitated = hesitatedWordsIndices.has(globalIndex);
            const isMissed = missedWordsIndices.has(globalIndex);
            const isCurrent = isRecording && currentWordIndex === globalIndex;
            const isHinting = hintingWordIndex === globalIndex && hintLevel > 0;
            
            // Check if this word is in a problem phrase (chunk-based recall)
            const problemPhraseInfo = problemPhraseMap.get(globalIndex);
            const isInProblemPhrase = problemPhraseInfo?.isInProblemPhrase || false;
            
            // Check if this word is in the current phrase (for phrase-based highlighting)
            const wordPhraseIndex = naturalPhrases.findIndex(
              phrase => globalIndex >= phrase.startIndex && globalIndex <= phrase.endIndex
            );
            const isInCurrentPhrase = isRecording && wordPhraseIndex === currentPhraseIndex && currentPhraseIndex >= 0;
            const isPhraseSpoken = isInCurrentPhrase && naturalPhrases[wordPhraseIndex] && 
              spokenWordsIndices.has(naturalPhrases[wordPhraseIndex].startIndex);
            
            return (
              <TooltipProvider key={globalIndex}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.span
                      layout="position"
                      layoutId={`word-${globalIndex}`}
                      transition={{ 
                        layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
                        opacity: { duration: 0.5, ease: "easeOut" }
                      }}
                      className={cn(
                        "word-block s-pd s-i3",
                        // Smooth fade transition for all states
                        "s-wr s-bq s-bu",
                        // Problem phrase indicator (chunk-based recall) - subtle underline
                        isInProblemPhrase && !isRecording && "s-6w s-74 s-7m",
                        // Current word - gentle pulse, no scale change for stability
                        isCurrent && "current-word-gentle",
                        // Current phrase highlight (soft background)
                        !isCurrent && isInCurrentPhrase && !isSpoken && "phrase-highlight",
                        // Error states
                        !isCurrent && isMissed && "word-red",
                        !isCurrent && !isMissed && isHesitated && "word-yellow",
                        // Spoken words fade out smoothly
                        !isCurrent && !isMissed && !isHesitated && isSpoken && "word-spoken",
                        // Unspoken words
                        !isCurrent && !isMissed && !isHesitated && !isSpoken && !isInCurrentPhrase && "word-upcoming"
                      )}
                    >
                      {word}
                      {/* Inline hint for current word */}
                      <AnimatePresence>
                        {isHinting && (
                          <motion.span
                            initial={{ opacity: 0, y: -20, scale: 0.8 }}
                            animate={{ opacity: 1, y: -35, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.9 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className={cn(
                              "s-26 s-iu s-8 s-yb s-or s-oz s-qh s-v9 s-d3 s-yf",
                              hintLevel === 1 && "s-5g s-uw s-6l s-7s",
                              hintLevel === 2 && "s-6c s-vm s-8x s-6l s-89",
                              hintLevel >= 3 && "s-6d s-vo s-6n s-8a s-qx"
                            )}
                          >
                            <Lightbulb className="s-i2 s-xp s-fw s-ln" />
                            {getWordHint(word, hintLevel)}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.span>
                  </TooltipTrigger>
                  {(isMissed || isHesitated || isInProblemPhrase) && (
                    <TooltipContent side="top" className="s-vj">
                      {isMissed ? "Skipped or incorrect" : 
                       isHesitated ? "Hesitated here" :
                       `Focus area (missed ${problemPhraseInfo?.timesMissed || 0}x)`}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          });
        } else {
          // Hidden segment - interactive bracket
          const visibleErrorWords: Array<{ word: string, globalIndex: number, isMissed: boolean, isHesitated: boolean }> = [];
          
          segment.words.forEach((word, idx) => {
            const globalIdx = segment.startIndex + idx;
            const isMissed = missedWordsIndices.has(globalIdx);
            const isHesitated = hesitatedWordsIndices.has(globalIdx);
            if (isMissed || isHesitated) {
              visibleErrorWords.push({ word, globalIndex: globalIdx, isMissed, isHesitated });
            }
          });
          
          const processedCount = segment.words.filter((_, idx) => {
            const globalIdx = segment.startIndex + idx;
            return spokenWordsIndices.has(globalIdx) || hesitatedWordsIndices.has(globalIdx) || missedWordsIndices.has(globalIdx);
          }).length;
          
          const allProcessed = processedCount === segment.words.length;
          const hasErrors = visibleErrorWords.length > 0;
          const isPeeked = peekedBrackets.has(segmentIndex);
          const isExpanded = expandedBrackets.has(segmentIndex);
          
          let bracketState: "empty" | "filling" | "complete" | "error" | "peeked" | "expanded" = "empty";
          
          if (isExpanded) bracketState = "expanded";
          else if (isPeeked) bracketState = "peeked";
          else if (allProcessed && !hasErrors) bracketState = "complete";
          else if (hasErrors) bracketState = "error";
          else if (processedCount > 0) bracketState = "filling";
          
          const isCurrentBracket = isRecording && segment.words.some((_, idx) => currentWordIndex === segment.startIndex + idx);
          const currentWordInBracket = isCurrentBracket ? currentWordIndex - segment.startIndex : -1;
          
          // Check if any word in this bracket is being hinted
          const hintingWordInBracket = segment.words.findIndex((_, idx) => hintingWordIndex === segment.startIndex + idx);
          const hasHintingWord = hintingWordInBracket !== -1 && hintLevel > 0;

          // Check if this bracket contains problem phrase words (chunk-based recall)
          const bracketProblemPhraseInfo = segment.words.reduce((acc, _, idx) => {
            const info = problemPhraseMap.get(segment.startIndex + idx);
            if (info && info.isInProblemPhrase) {
              return { isInProblemPhrase: true, timesMissed: Math.max(acc.timesMissed, info.timesMissed) };
            }
            return acc;
          }, { isInProblemPhrase: false, timesMissed: 0 });

          return (
            <motion.div
              key={segmentIndex}
              layout
              onClick={() => !isRecording && handleBracketTap(segmentIndex, segment.startIndex)}
              className={cn(
                "bracket-container s-or s-p3 s-qo s-wr s-bp s-c5 s-ib s-dn s-8m s-qq s-pd",
                // Problem phrase indicator for brackets (chunk-based recall)
                bracketProblemPhraseInfo.isInProblemPhrase && !isRecording && "s-pm s-pv s-ps",
                bracketState === "complete" && "s-4y s-6n s-7c s-qw s-qy",
                bracketState === "error" && "s-54 s-6n s-7l",
                bracketState === "filling" && "s-5f s-6n s-7t",
                bracketState === "peeked" && "s-6e s-6n s-89",
                bracketState === "expanded" && "s-6f s-6n s-87",
                bracketState === "empty" && isCurrentBracket && "bracket-active s-5g s-6o s-7n s-r4 s-r2 s-qp",
                bracketState === "empty" && !isCurrentBracket && "s-53 s-6n s-7k s-hi s-h6",
                hasHintingWord && "s-pm s-q4 s-pt"
              )}
              title={bracketProblemPhraseInfo.isInProblemPhrase ? `Focus area (missed ${bracketProblemPhraseInfo.timesMissed}x)` : undefined}
            >
              {/* Hint bubble for hidden word */}
              <AnimatePresence>
                {hasHintingWord && hintLevel > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -15, scale: 0.9 }}
                    animate={{ opacity: 1, y: -45, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={cn(
                      "s-26 s-iu s-8 s-w1 s-os s-p3 s-qh s-d3 s-yg s-yb",
                      hintLevel === 1 && "s-5c s-ux",
                      hintLevel === 2 && "s-6b s-vo",
                      hintLevel >= 3 && "s-6d s-vo s-uk s-r4 s-6n s-8a"
                    )}
                  >
                    <Lightbulb className="s-i2 s-xt s-fz s-lo" />
                    {getWordHint(segment.words[hintingWordInBracket], hintLevel)}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Peek indicator */}
              {!isRecording && bracketState === "empty" && !isCurrentBracket && (
                <Eye className="s-xp s-fw s-un s-26 s-w2 s-pf" />
              )}
              
              {bracketState === "complete" && (
                <Check className="s-xt s-fz s-ue s-8s" />
              )}
              {bracketState === "filling" && (
                <Circle className="s-xp s-fw s-uw s-30" />
              )}
              
              
              {/* Content based on state */}
              {bracketState === "empty" && !isPeeked && !isExpanded && (
                <span className={cn(
                  "s-c5 s-ib s-dl",
                  isCurrentBracket && "s-uw s-d3"
                )}>
                  {isCurrentBracket ? (
                    // Show dots for words, highlight current
                    segment.words.map((_, idx) => (
                      <motion.span
                        key={idx}
                        animate={idx === currentWordInBracket ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className={cn(
                          "s-xk s-fs s-qe",
                          idx === currentWordInBracket ? "s-5c" : "s-52"
                        )}
                      />
                    ))
                  ) : (
                    <span className="s-vj s-d0 s-57 s-op s-ox s-qe">
                      {segment.words.length}
                    </span>
                  )}
                </span>
              )}
              
              {bracketState === "peeked" && (
                <span className="s-vj s-d0 s-vl s-8y s-c5 s-dl">
                  {segment.words.map((word, idx) => (
                    <span key={idx} className="s-6f s-om s-ox s-q8">
                      {word.slice(0, 2)}...
                    </span>
                  ))}
                </span>
              )}
              
              {bracketState === "expanded" && (
                <span className="s-v9 s-d0 s-vm s-8x s-c5 s-dm s-cb">
                  {segment.words.map((word, idx) => (
                    <span key={idx} className="s-6h s-op s-ox s-q8 s-6l s-89">
                      {word}
                    </span>
                  ))}
                </span>
              )}
              
              {bracketState === "filling" && (
                <span className="s-vj s-d3 s-uw">
                  {processedCount}/{segment.words.length}
                </span>
              )}
              
              {visibleErrorWords.length > 0 && bracketState === "error" && (
                <div className="s-c5 s-ib s-dl s-cb">
                  {visibleErrorWords.map((errorWord, idx) => (
                    <TooltipProvider key={`${errorWord.globalIndex}-${idx}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(
                            "s-v9 s-op s-ox s-q8 s-d3",
                            errorWord.isMissed && "s-5q s-v3 s-8v s-6l s-7x",
                            !errorWord.isMissed && "s-6g s-vm s-8y s-6l s-89"
                          )}>
                            {errorWord.word}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="s-vj">
                          {errorWord.isMissed ? "Missed" : "Hesitated"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              )}
              
            </motion.div>
          );
        }
      })}
    </div>
  );
};

export default BracketedTextDisplay;
