import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { RealtimeTranscriber } from "@/utils/RealtimeTranscription";

interface EnhancedWordTrackerProps {
  text: string;
  isRecording: boolean;
  transcription?: string;
  revealSpeed: number;
  showWordOnPause: boolean;
  animationStyle?: string;
  keywordMode: boolean;
  onTranscriptUpdate?: (transcript: string) => void;
  className?: string;
}

interface WordState {
  text: string;
  spoken: boolean;
  isCurrent: boolean;
  revealed: boolean;
  isKeyword: boolean;
  manuallyRevealed: boolean;
  performanceStatus?: "correct" | "hesitated" | "missed";
  timeToSpeak?: number;
  hidden: boolean; // Word has faded out and replaced with dots
  partialProgress: number; // 0-1, how much of the word has been spoken
  showAsHint: boolean; // Show word as hint after delay
  inLiquidColumn?: boolean; // Part of liquid column animation
  liquidError?: boolean; // Word was spoken incorrectly in liquid column
}

const normalizeNordic = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/[öø]/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/[^\wåäöæøéèêëàáâãäüïîôûùúñçšž\s]/gi, ""); // Keep spaces!
};

// Calculate word similarity score (0-1) for pronunciation matching
const getWordSimilarity = (word1: string, word2: string): number => {
  const w1 = normalizeNordic(word1);
  const w2 = normalizeNordic(word2);

  // Exact match
  if (w1 === w2) return 1.0;

  // Very short words must match exactly (2 chars or less)
  if (w1.length <= 2 || w2.length <= 2) {
    return w1 === w2 ? 1.0 : 0.0;
  }

  // Prefix matching for truncated words - minimum 80% length match
  const maxLen = Math.max(w1.length, w2.length);
  const minLen = Math.min(w1.length, w2.length);
  if (minLen / maxLen >= 0.8) {
    if (w1.startsWith(w2) || w2.startsWith(w1)) return 0.9;
  }

  // Character-by-character similarity
  let matches = 0;
  const compareLength = Math.min(w1.length, w2.length);
  for (let i = 0; i < compareLength; i++) {
    if (w1[i] === w2[i]) matches++;
  }

  return matches / Math.max(w1.length, w2.length);
};

// Check if words are similar enough to be considered a match
const isSimilarWord = (word1: string, word2: string): boolean => {
  return getWordSimilarity(word1, word2) >= 0.5; // 50% threshold for any match
};

const isKeywordWord = (word: string): boolean => {
  const cleanWord = word.toLowerCase().replace(/[^\w]/g, "");
  return cleanWord.length > 5 || /[A-Z]/.test(word) || /[.!?]/.test(word);
};

const EnhancedWordTracker = ({
  text,
  isRecording,
  transcription = "",
  revealSpeed,
  showWordOnPause,
  animationStyle,
  keywordMode,
  onTranscriptUpdate,
  className,
}: EnhancedWordTrackerProps) => {
  const [wordStates, setWordStates] = useState<WordState[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const currentWordIndexRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const revealTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpokenIndexRef = useRef(-1);
  const wordTimestamps = useRef<Map<number, number>>(new Map()); // Track when each word position was reached
  const transcriberRef = useRef<RealtimeTranscriber | null>(null);
  const accumulatedTranscript = useRef<string>("");
  const previousTranscriptLength = useRef<number>(0); // Track how many words we've processed
  const hiddenWordTimers = useRef<Map<number, number>>(new Map()); // Track 3s hint timers for hidden words
  const hesitationTimers = useRef<Map<number, number>>(new Map()); // Track 2s hesitation timers
  const [forgottenWordPopup, setForgottenWordPopup] = useState<{
    wordIndex: number;
    isAnimating: boolean;
  } | null>(null);
  const pauseDetectionTimer = useRef<NodeJS.Timeout | null>(null);
  const lastProgressTime = useRef<number>(Date.now());
  const lastWordIndex = useRef<number>(-1);
  const [liquidColumn, setLiquidColumn] = useState<{
    start: number;
    end: number;
    progress: number; // 0-100
  } | null>(null);
  const liquidAnimationRef = useRef<number | null>(null);
  const liquidPausedRef = useRef<boolean>(false);

  useEffect(() => {
    currentWordIndexRef.current = currentWordIndex;
  }, [currentWordIndex]);

  // Initialize word states from text
  useEffect(() => {
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    const initialStates: WordState[] = words.map((word) => ({
      text: word,
      spoken: false,
      isCurrent: false,
      revealed: !keywordMode || isKeywordWord(word),
      isKeyword: isKeywordWord(word),
      manuallyRevealed: false,
      performanceStatus: undefined,
      timeToSpeak: 0,
      hidden: false,
      partialProgress: 0,
      showAsHint: false,
    }));
    setWordStates(initialStates);
    setCurrentWordIndex(0);
    currentWordIndexRef.current = 0;
    lastSpokenIndexRef.current = -1;
  }, [text, keywordMode]);

  // Removed duplicate transcript processing - only use interval-based processing below

  // Initialize OpenAI Realtime transcription
  useEffect(() => {
    const transcriber = new RealtimeTranscriber(
      (transcriptText, isFinal) => {
        if (isFinal) {
          console.log("📝 FINAL transcript received:", transcriptText);
          // DON'T accumulate - OpenAI sends COMPLETE transcript each time
          accumulatedTranscript.current = transcriptText;

          console.log("📝 Current transcript:", accumulatedTranscript.current);

          // Update parent component with full transcript
          if (onTranscriptUpdate) {
            onTranscriptUpdate(accumulatedTranscript.current);
          }
        }
        // IGNORE interim transcripts for coloring - they cause premature coloring
      },
      (error) => {
        console.error("❌ Transcription error:", error);
      },
    );

    transcriberRef.current = transcriber;

    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.disconnect();
      }
    };
  }, [onTranscriptUpdate]);

  // Process ONLY NEW words from final transcripts
  useEffect(() => {
    if (!isRecording) return;

    const intervalId = setInterval(() => {
      // Use the transcription prop if available (from Web Speech API), otherwise use OpenAI realtime
      const transcript = transcription || accumulatedTranscript.current;
      if (!transcript || transcript.trim() === "") return;

      const normalizeText = (text: string) => normalizeNordic(text.toLowerCase().replace(/[^\w\s]/g, ""));

      const transcribedWords = normalizeText(transcript)
        .split(/\s+/)
        .filter((w) => w.length > 0);

      // ONLY process NEW words that weren't in previous transcript
      if (transcribedWords.length <= previousTranscriptLength.current) {
        return; // No new words to process
      }

      const newWords = transcribedWords.slice(previousTranscriptLength.current);
      console.log("📝 NEW words to process:", newWords.join(" "));
      
      const now = Date.now();

      setWordStates((prevStates) => {
        if (prevStates.length === 0) return prevStates;

        const targetWords = prevStates.map((ws) => normalizeText(ws.text));
        const updatedStates = [...prevStates];
        
        // Update partial progress for hidden words
        for (let i = 0; i < updatedStates.length; i++) {
          if (updatedStates[i].hidden && !updatedStates[i].spoken) {
            const targetWord = targetWords[i];
            const lastNewWord = newWords[newWords.length - 1] || "";
            
            // Calculate how much of the word has been spoken
            if (lastNewWord.length > 0) {
              const similarity = getWordSimilarity(lastNewWord, targetWord);
              if (similarity > 0.3) {
                // User is speaking this word - update progress
                const progress = Math.min(lastNewWord.length / targetWord.length, 0.99);
                updatedStates[i] = { ...updatedStates[i], partialProgress: progress };
                
                // Clear hesitation timer since user is actively speaking
                const timer = hesitationTimers.current.get(i);
                if (timer) {
                  clearTimeout(timer);
                  hesitationTimers.current.delete(i);
                }
                
                // Start new hesitation timer (2s)
                const hesitationTimer = setTimeout(() => {
                  setWordStates((states) => {
                    const updated = [...states];
                    if (i < updated.length && updated[i].hidden && !updated[i].spoken) {
                      // Show remaining part of word after 2s hesitation
                      updated[i] = { ...updated[i], showAsHint: true };
                    }
                    return updated;
                  });
                }, 2000) as unknown as number;
                hesitationTimers.current.set(i, hesitationTimer);
              }
            }
          }
        }
        
        previousTranscriptLength.current = transcribedWords.length;

        // Find where we are in the script (first unspoken word)
        let scriptPosition = 0;
        for (let i = 0; i < updatedStates.length; i++) {
          if (!updatedStates[i].spoken && updatedStates[i].performanceStatus !== "missed") {
            scriptPosition = i;
            break;
          }
        }

        // Match NEW transcribed words to script words STRICTLY in order
        let newWordIdx = 0;

        while (newWordIdx < newWords.length && scriptPosition < targetWords.length) {
          const transcribedWord = newWords[newWordIdx];
          const targetWord = targetWords[scriptPosition];
          const currentWord = updatedStates[scriptPosition];

          // Check if current words match
          const similarity = getWordSimilarity(transcribedWord, targetWord);

          if (similarity >= 0.5) {
            // MATCH - determine performance status based on similarity and timing
            const timeAtWord = wordTimestamps.current.get(scriptPosition);
            const tookTooLong = timeAtWord ? now - timeAtWord >= 2000 : false;

            let performanceStatus: "correct" | "hesitated" | "missed";

            // Pronunciation quality check (65% threshold for "correct")
            if (similarity >= 0.65) {
              performanceStatus = tookTooLong ? "hesitated" : "correct";
              console.log(
                `✅ "${updatedStates[scriptPosition].text}" spoken ${tookTooLong ? "with timing hesitation" : "correctly"}`,
              );
            } else {
              // Minor pronunciation issue (50-65% similarity) - soft feedback
              performanceStatus = "hesitated";
              console.log(
                `⚠️ "${updatedStates[scriptPosition].text}" spoken with minor pronunciation variation (${Math.round(similarity * 100)}% match)`,
              );
            }

            // Check if this word was shown in forgotten popup
            const wasForgotten = forgottenWordPopup?.wordIndex === scriptPosition;
            
            // If word was forgotten, mark as hesitated regardless of timing
            if (wasForgotten) {
              performanceStatus = "hesitated";
              console.log(`⚠️ "${updatedStates[scriptPosition].text}" was forgotten and shown in popup`);
            }

            updatedStates[scriptPosition] = {
              ...updatedStates[scriptPosition],
              spoken: true,
              revealed: true,
              isCurrent: false,
              performanceStatus,
              hidden: true, // Mark as hidden after speaking (will fade out)
              partialProgress: 1,
              showAsHint: false,
            };

            // Clear any timers for this word
            const hintTimer = hiddenWordTimers.current.get(scriptPosition);
            if (hintTimer) {
              clearTimeout(hintTimer);
              hiddenWordTimers.current.delete(scriptPosition);
            }
            const hesTimer = hesitationTimers.current.get(scriptPosition);
            if (hesTimer) {
              clearTimeout(hesTimer);
              hesitationTimers.current.delete(hesTimer);
            }

            wordTimestamps.current.delete(scriptPosition);
            lastSpokenIndexRef.current = scriptPosition;
            
            // Trigger popup reintegration animation if this word was in popup
            if (wasForgotten) {
              setForgottenWordPopup({ wordIndex: scriptPosition, isAnimating: true });
              setTimeout(() => {
                setForgottenWordPopup(null);
              }, 800); // Animation duration
            }
            
            // Check if we're in a liquid column and just completed it
            if (liquidColumn && scriptPosition === liquidColumn.end) {
              console.log('🌊 Liquid column complete - fading out');
              // Fade out liquid column
              setTimeout(() => {
                setLiquidColumn(null);
                if (liquidAnimationRef.current) {
                  cancelAnimationFrame(liquidAnimationRef.current);
                  liquidAnimationRef.current = null;
                }
              }, 300);
            } else if (liquidColumn && scriptPosition >= liquidColumn.start && scriptPosition <= liquidColumn.end) {
              // Continue filling liquid column
              console.log('🌊 Continuing liquid fill');
              liquidPausedRef.current = false;
            }

            // Move both positions forward
            newWordIdx++;
            scriptPosition++;
          } else {
            // NO MATCH - check if this is a hidden word that should block progression
            if (currentWord.hidden && !currentWord.spoken) {
              console.log(`🛑 BLOCKED: Current word "${currentWord.text}" is hidden - waiting for user to say it`);
              
              // If in liquid column and wrong word spoken, freeze that part yellow
              if (liquidColumn && scriptPosition >= liquidColumn.start && scriptPosition <= liquidColumn.end) {
                updatedStates[scriptPosition] = {
                  ...updatedStates[scriptPosition],
                  liquidError: true,
                  performanceStatus: "hesitated"
                };
              }
              
              // Don't advance - wait for popup to trigger or user to say the word
              // Skip this transcribed word as it doesn't match the required hidden word
              newWordIdx++;
              continue;
            }
            
            // NO MATCH - check if transcribed word matches ahead in script (skip detection)
            let matchFound = false;

            // Look ahead up to 5 words in script - only mark visible words as MISSED if 2+ words skipped
            for (let lookAhead = 1; lookAhead <= 5 && scriptPosition + lookAhead < targetWords.length; lookAhead++) {
              const similarity = getWordSimilarity(transcribedWord, targetWords[scriptPosition + lookAhead]);

              if (similarity >= 0.5) {
                // Mark skipped words - but NEVER mark hidden words as "missed", only as "hesitated"
                if (lookAhead >= 2) {
                  console.log(
                    `⚠️ SKIP: User jumped from "${updatedStates[scriptPosition].text}" to "${updatedStates[scriptPosition + lookAhead].text}" (${lookAhead} words skipped)`,
                  );

                  for (let skipIdx = scriptPosition; skipIdx < scriptPosition + lookAhead; skipIdx++) {
                    if (!updatedStates[skipIdx].spoken) {
                      // Hidden words are ALWAYS marked as "hesitated" (yellow), never "missed" (red)
                      const skipStatus = updatedStates[skipIdx].hidden ? "hesitated" : "missed";
                      console.log(`  ${skipStatus === "missed" ? "❌" : "⚠️"} "${updatedStates[skipIdx].text}" marked as ${skipStatus.toUpperCase()}`);
                      updatedStates[skipIdx] = {
                        ...updatedStates[skipIdx],
                        spoken: false,
                        revealed: true,
                        performanceStatus: skipStatus,
                      };
                      wordTimestamps.current.delete(skipIdx);
                    }
                  }
                } else {
                  // Just 1 word ahead - might be transcription timing, don't mark as missed
                  console.log(`⚠️ Jumped 1 word ahead (possible transcription timing), not marking as missed`);
                }

                // Color the matched word based on pronunciation quality
                const timeAtWord = wordTimestamps.current.get(scriptPosition + lookAhead);
                const tookTooLong = timeAtWord ? now - timeAtWord >= 2000 : false;

                let performanceStatus: "correct" | "hesitated" | "missed";
                if (similarity >= 0.65) {
                  performanceStatus = tookTooLong ? "hesitated" : "correct";
                } else {
                  performanceStatus = "hesitated"; // Minor pronunciation issue
                }

                updatedStates[scriptPosition + lookAhead] = {
                  ...updatedStates[scriptPosition + lookAhead],
                  spoken: true,
                  revealed: true,
                  isCurrent: false,
                  performanceStatus,
                };

                wordTimestamps.current.delete(scriptPosition + lookAhead);
                lastSpokenIndexRef.current = scriptPosition + lookAhead;

                scriptPosition = scriptPosition + lookAhead + 1;
                newWordIdx++;
                matchFound = true;
                break;
              }
            }

            // If no match found ahead, it might be transcription error - just move to next transcribed word
            if (!matchFound) {
              console.log(`⚠️ No match for "${transcribedWord}" - possible transcription error, not marking as skip`);
              newWordIdx++;
            }
          }
        }

        // Find current word position (next unspoken word)
        let currentIdx = -1;
        for (let i = 0; i < updatedStates.length; i++) {
          if (!updatedStates[i].spoken && updatedStates[i].performanceStatus !== "missed") {
            currentIdx = i;
            break;
          }
        }

        // Check if we need to start a liquid column
        if (currentIdx !== -1 && currentIdx < updatedStates.length && !liquidColumn) {
          // Check if next word after current is hidden
          const nextIdx = currentIdx + 1;
          if (nextIdx < updatedStates.length && updatedStates[nextIdx].hidden && !updatedStates[nextIdx].spoken) {
            // Find end of hidden word sequence
            let endIdx = nextIdx;
            while (endIdx < updatedStates.length && updatedStates[endIdx].hidden && !updatedStates[endIdx].spoken) {
              endIdx++;
            }
            endIdx--; // Back to last hidden word
            
            console.log(`🌊 Starting liquid column from ${nextIdx} to ${endIdx}`);
            setLiquidColumn({ start: nextIdx, end: endIdx, progress: 0 });
            liquidPausedRef.current = false;
            
            // Mark words as in liquid column
            for (let i = nextIdx; i <= endIdx; i++) {
              updatedStates[i] = { ...updatedStates[i], inLiquidColumn: true };
            }
          }
        }

        // Track timing for current word and start hint timer if hidden
        if (currentIdx !== -1 && !wordTimestamps.current.has(currentIdx)) {
          wordTimestamps.current.set(currentIdx, now);
          
          // If this word is hidden and not yet spoken, start 3s hint timer
          if (updatedStates[currentIdx].hidden && !hiddenWordTimers.current.has(currentIdx)) {
            const timer = setTimeout(() => {
              setWordStates((states) => {
                const updated = [...states];
                if (currentIdx < updated.length && !updated[currentIdx].spoken) {
                  updated[currentIdx] = { ...updated[currentIdx], showAsHint: true };
                }
                return updated;
              });
            }, 3000) as unknown as number;
            hiddenWordTimers.current.set(currentIdx, timer);
          }
        }

        if (currentIdx !== -1) {
          setCurrentWordIndex(currentIdx);
          currentWordIndexRef.current = currentIdx;
          
          // Update last progress time when position changes
          if (currentIdx !== lastWordIndex.current) {
            lastProgressTime.current = now;
            lastWordIndex.current = currentIdx;
          }
        }

        // Update current indicator
        return updatedStates.map((state, idx) => ({
          ...state,
          isCurrent: idx === currentIdx && currentIdx !== -1 && !state.spoken,
        }));
      });
    }, 10); // Process every 10ms for minimal latency

    return () => clearInterval(intervalId);
  }, [isRecording, transcription, liquidColumn]);
  
  // Liquid column animation
  useEffect(() => {
    if (!liquidColumn || !isRecording) return;
    
    const animate = () => {
      if (liquidPausedRef.current) return;
      
      setLiquidColumn(prev => {
        if (!prev) return null;
        const newProgress = prev.progress + 1.5; // Adjust speed
        if (newProgress >= 100) {
          liquidPausedRef.current = true;
          return { ...prev, progress: 100 };
        }
        return { ...prev, progress: newProgress };
      });
      
      liquidAnimationRef.current = requestAnimationFrame(animate);
    };
    
    liquidAnimationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (liquidAnimationRef.current) {
        cancelAnimationFrame(liquidAnimationRef.current);
      }
    };
  }, [liquidColumn, isRecording]);

  // Pause detection for forgotten words
  useEffect(() => {
    if (!isRecording) {
      if (pauseDetectionTimer.current) {
        clearTimeout(pauseDetectionTimer.current);
        pauseDetectionTimer.current = null;
      }
      return;
    }

    const checkForPause = () => {
      const now = Date.now();
      const timeSinceProgress = now - lastProgressTime.current;
      const currentIdx = currentWordIndexRef.current;

      // Check if current word is hidden and user has paused
      if (currentIdx >= 0 && currentIdx < wordStates.length) {
        const currentWord = wordStates[currentIdx];
        
        // Only trigger for hidden words that haven't been spoken
        if (currentWord.hidden && !currentWord.spoken && !forgottenWordPopup) {
          // Determine pause threshold based on position
          const isStartOfSentence = currentIdx === 0 || wordStates[currentIdx - 1]?.text.match(/[.!?]$/);
          const pauseThreshold = isStartOfSentence ? 4000 : 2000;

          if (timeSinceProgress >= pauseThreshold) {
            console.log(`⚠️ Forgotten word detected: "${currentWord.text}" (paused ${timeSinceProgress}ms)`);
            
            // Pause liquid animation
            liquidPausedRef.current = true;
            
            setForgottenWordPopup({ wordIndex: currentIdx, isAnimating: false });
            
            // Mark the word as hesitated (forgotten) immediately
            setWordStates((prevStates) => {
              const updated = [...prevStates];
              updated[currentIdx] = {
                ...updated[currentIdx],
                performanceStatus: "hesitated",
                revealed: true,
                showAsHint: true
              };
              return updated;
            });
            
            lastProgressTime.current = now; // Reset to avoid repeated triggers
          } else if (timeSinceProgress > 500) {
            // User is pausing but not yet at threshold - pause liquid
            liquidPausedRef.current = true;
          } else {
            // User is speaking - resume liquid
            liquidPausedRef.current = false;
          }
        }
      }

      pauseDetectionTimer.current = setTimeout(checkForPause, 500) as unknown as NodeJS.Timeout;
    };

    pauseDetectionTimer.current = setTimeout(checkForPause, 500) as unknown as NodeJS.Timeout;

    return () => {
      if (pauseDetectionTimer.current) {
        clearTimeout(pauseDetectionTimer.current);
        pauseDetectionTimer.current = null;
      }
    };
  }, [isRecording, wordStates, forgottenWordPopup]);

  // Handle recording state changes
  useEffect(() => {
    const setupRecording = async () => {
      if (isRecording && transcriberRef.current) {
        console.log("🎤 Starting OpenAI realtime transcription");
        wordTimestamps.current.clear();
        hiddenWordTimers.current.clear();
        hesitationTimers.current.clear();
        accumulatedTranscript.current = "";
        previousTranscriptLength.current = 0; // Reset processed word count
        lastProgressTime.current = Date.now();
        lastWordIndex.current = -1;
        setForgottenWordPopup(null);
        setLiquidColumn(null);
        if (liquidAnimationRef.current) {
          cancelAnimationFrame(liquidAnimationRef.current);
          liquidAnimationRef.current = null;
        }
        liquidPausedRef.current = false;
        setWordStates((prevStates) =>
          prevStates.map((state) => ({
            ...state,
            spoken: false,
            isCurrent: false,
            revealed: !keywordMode || state.isKeyword || state.manuallyRevealed,
            performanceStatus: undefined,
            timeToSpeak: 0,
            hidden: false,
            partialProgress: 0,
            showAsHint: false,
          })),
        );
        setCurrentWordIndex(0);
        currentWordIndexRef.current = 0;
        lastSpokenIndexRef.current = -1;

        try {
          await transcriberRef.current.connect();
          await transcriberRef.current.startRecording();
        } catch (error) {
          console.error("Error starting transcription:", error);
        }
      } else if (!isRecording && transcriberRef.current) {
        console.log("⏹️ Stopping transcription");
        transcriberRef.current.disconnect();
        
        // Clear all timers
        hiddenWordTimers.current.forEach((timer) => clearTimeout(timer));
        hiddenWordTimers.current.clear();
        hesitationTimers.current.forEach((timer) => clearTimeout(timer));
        hesitationTimers.current.clear();
      }
    };

    setupRecording();
  }, [isRecording, keywordMode]);

  // Tap to reveal individual word
  const handleWordTap = useCallback(
    (index: number) => {
      if (!keywordMode || isRecording) return;

      setWordStates((prev) => {
        const updated = [...prev];
        if (index >= 0 && index < updated.length && !updated[index].isKeyword) {
          updated[index] = {
            ...updated[index],
            manuallyRevealed: true,
            revealed: true,
          };
        }
        return updated;
      });
    },
    [keywordMode, isRecording],
  );

  // Auto-scroll to current word
  useEffect(() => {
    if (currentWordIndex >= 0 && scrollContainerRef.current) {
      const currentElement = scrollContainerRef.current.querySelector(`[data-word-index="${currentWordIndex}"]`);
      if (currentElement) {
        currentElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentWordIndex]);

  const getWordClassName = (word: WordState, index: number) => {
    const base = "inline-block px-3 py-1.5 mx-1 my-1 rounded-md font-medium transition-all duration-500 ease-in-out";

    // Hidden word shown as hint (after 3s delay or 2s hesitation)
    if (word.showAsHint && word.hidden && !word.spoken) {
      return cn(base, "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/40 animate-pulse");
    }

    // Hidden word with pulsing blue dots
    if (word.hidden && !word.spoken && !word.showAsHint) {
      return cn(base, "bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse min-w-[80px] text-center");
    }

    // Current word being spoken - blue pulse animation
    if (word.isCurrent && isRecording && !word.spoken) {
      return cn(base, "bg-blue-500/20 text-blue-600 dark:text-blue-400 scale-110 animate-pulse font-semibold border border-blue-500/40");
    }

    // AFTER word is spoken and faded:

    // Missed/Skipped - RED, fades to dots
    if (word.performanceStatus === "missed" && word.hidden) {
      return cn(base, "bg-red-500/20 text-red-600 dark:text-red-400 border-b-2 border-red-500/40 opacity-60");
    }

    // Hesitated - YELLOW, fades to dots
    if (word.performanceStatus === "hesitated" && word.hidden) {
      return cn(base, "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-500/40 opacity-60");
    }

    // Correct - gray fade out (no blue, no pulse)
    if (word.spoken && word.performanceStatus === "correct" && word.hidden) {
      return cn(base, "bg-muted/30 text-muted-foreground/40 opacity-40");
    }

    // In keyword mode, hidden words show as "..." - can be clicked when not recording
    if (keywordMode && !word.isKeyword && !word.manuallyRevealed && !word.spoken && !isRecording) {
      return cn(
        base,
        "bg-muted text-muted-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground",
        "text-center min-w-[60px]",
      );
    }

    // Default - unspoken word (gray background)
    return cn(base, "bg-muted/50 text-muted-foreground");
  };

  const renderWordContent = (word: WordState, index: number) => {
    // Show hint after delay or hesitation
    if (word.showAsHint && word.hidden && !word.spoken) {
      return word.text;
    }

    // Hidden word - show progressive dots based on partial progress
    if (word.hidden && !word.spoken && !word.showAsHint) {
      const wordLength = word.text.length;
      const dotsToShow = Math.ceil(wordLength * word.partialProgress);
      const dotsRemaining = Math.max(3, wordLength - dotsToShow);
      
      // Show filled portion + remaining dots
      if (dotsToShow > 0 && word.partialProgress > 0.1) {
        const filledPortion = word.text.substring(0, dotsToShow);
        const dots = ".".repeat(dotsRemaining);
        return `${filledPortion}${dots}`;
      }
      
      // Default: show dots representing word length (min 3, max word length)
      return ".".repeat(Math.min(Math.max(3, wordLength), 12));
    }

    // In keyword mode, check if this is the start of a hidden word group
    if (keywordMode && !word.isKeyword && !word.manuallyRevealed) {
      // If word has performance status (missed/hesitated/correct), show actual word
      if (word.performanceStatus) {
        return word.text;
      }

      // This is a hidden word without status - check if it's the first in a group
      // If previous word is also hidden, we should have been skipped in render
      // So if we're here, we're the first in the group - show "..."
      return "...";
    }
    return word.text;
  };

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "relative min-h-[200px] max-h-[600px] overflow-y-auto p-8 rounded-lg bg-background/50 backdrop-blur-sm",
        className,
      )}
    >
      {/* Forgotten Word Popup */}
      {forgottenWordPopup && forgottenWordPopup.wordIndex < wordStates.length && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center pointer-events-none",
            forgottenWordPopup.isAnimating && "animate-fade-out"
          )}
          style={{
            animation: forgottenWordPopup.isAnimating 
              ? "shrinkToPosition 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards"
              : "none"
          }}
        >
          <div
            className={cn(
              "bg-yellow-500 text-black font-bold rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-800",
              forgottenWordPopup.isAnimating 
                ? "opacity-0 scale-50" 
                : "opacity-100 scale-100"
            )}
            style={{
              fontSize: "clamp(2rem, 5vw, 4rem)",
              padding: "3rem 4rem",
              minHeight: "33vh",
              minWidth: "300px",
              maxWidth: "80vw"
            }}
          >
            {wordStates[forgottenWordPopup.wordIndex].text}
          </div>
        </div>
      )}

      {isRecording && (
        <div className="mb-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium text-center">
            🎤 Listening - Speak clearly and words will light up as you go
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-1 leading-loose relative">
        {wordStates.map((word, index) => {
          // Render liquid column if this is the first word in the column
          const isLiquidStart = liquidColumn && index === liquidColumn.start;
          const isInLiquidColumn = liquidColumn && index >= liquidColumn.start && index <= liquidColumn.end;
          
          // Hide word in text flow if it's currently in the popup (not animating back yet)
          if (forgottenWordPopup && forgottenWordPopup.wordIndex === index && !forgottenWordPopup.isAnimating) {
            return (
              <span
                key={index}
                data-word-index={index}
                className="inline-block px-3 py-1.5 mx-1 my-1 opacity-0"
                style={{
                  fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)",
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                }}
              >
                {word.text}
              </span>
            );
          }

          // Check if this word should be part of a hidden group (before performance status)
          const isPartOfHiddenGroup = keywordMode && !word.isKeyword && !word.manuallyRevealed;

          // Skip rendering if this is a hidden word that's part of a group (not the first in the group)
          // BUT only if it doesn't have a performance status (which needs individual rendering)
          if (isPartOfHiddenGroup && !word.performanceStatus && index > 0) {
            const prevWord = wordStates[index - 1];
            const prevIsPartOfHiddenGroup = keywordMode && !prevWord.isKeyword && !prevWord.manuallyRevealed;
            if (prevIsPartOfHiddenGroup && !prevWord.performanceStatus) {
              return null; // Skip this word, it's part of the previous "..." group
            }
          }

          return (
            <span key={index} className="relative inline-block">
              {/* Liquid column overlay */}
              {isLiquidStart && (
                <div className="absolute inset-0 z-10 pointer-events-none" style={{
                  width: `calc(100% * ${liquidColumn.end - liquidColumn.start + 1} + ${(liquidColumn.end - liquidColumn.start) * 0.5}rem)`,
                }}>
                  <div className="liquid-column-container h-full">
                    <div 
                      className={cn(
                        "liquid-fill h-full transition-all",
                        word.liquidError && "liquid-error"
                      )}
                      style={{ 
                        width: `${liquidColumn.progress}%`,
                        transition: liquidPausedRef.current ? 'none' : 'width 0.1s linear'
                      }}
                    />
                  </div>
                </div>
              )}
              
              <span
                data-word-index={index}
                className={cn(
                  getWordClassName(word, index),
                  isInLiquidColumn && !word.spoken && "invisible",
                  !isInLiquidColumn && word.isCurrent && !word.spoken && "animate-pulse text-primary scale-110"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleWordTap(index);
                }}
                style={{
                  fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)",
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                }}
              >
                {renderWordContent(word, index)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default EnhancedWordTracker;
