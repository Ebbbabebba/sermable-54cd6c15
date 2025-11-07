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
      previousTranscriptLength.current = transcribedWords.length;

      const now = Date.now();

      setWordStates((prevStates) => {
        if (prevStates.length === 0) return prevStates;

        const targetWords = prevStates.map((ws) => normalizeText(ws.text));
        const updatedStates = [...prevStates];

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

          // Check if current words match
          const similarity = getWordSimilarity(transcribedWord, targetWord);

          if (similarity >= 0.5) {
            // MATCH - determine performance status based on similarity and timing
            const timeAtWord = wordTimestamps.current.get(scriptPosition);
            const tookTooLong = timeAtWord ? now - timeAtWord >= 4000 : false;

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

            updatedStates[scriptPosition] = {
              ...updatedStates[scriptPosition],
              spoken: true,
              revealed: true,
              isCurrent: false,
              performanceStatus,
            };

            wordTimestamps.current.delete(scriptPosition);
            lastSpokenIndexRef.current = scriptPosition;

            // Move both positions forward
            newWordIdx++;
            scriptPosition++;
          } else {
            // NO MATCH - check if transcribed word matches ahead in script (skip detection)
            let matchFound = false;

            // Look ahead up to 5 words in script - only mark as MISSED if 2+ words skipped
            for (let lookAhead = 1; lookAhead <= 5 && scriptPosition + lookAhead < targetWords.length; lookAhead++) {
              const similarity = getWordSimilarity(transcribedWord, targetWords[scriptPosition + lookAhead]);

              if (similarity >= 0.5) {
                // Mark skipped words as MISSED only if 2+ words were skipped
                if (lookAhead >= 2) {
                  console.log(
                    `❌ SKIP: User jumped from "${updatedStates[scriptPosition].text}" to "${updatedStates[scriptPosition + lookAhead].text}" (${lookAhead} words skipped)`,
                  );

                  for (let skipIdx = scriptPosition; skipIdx < scriptPosition + lookAhead; skipIdx++) {
                    if (!updatedStates[skipIdx].spoken) {
                      console.log(`  ❌ "${updatedStates[skipIdx].text}" marked as MISSED`);
                      updatedStates[skipIdx] = {
                        ...updatedStates[skipIdx],
                        spoken: false,
                        revealed: true,
                        performanceStatus: "missed",
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
                const tookTooLong = timeAtWord ? now - timeAtWord >= 4000 : false;

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

        // Track timing for current word
        if (currentIdx !== -1 && !wordTimestamps.current.has(currentIdx)) {
          wordTimestamps.current.set(currentIdx, now);
        }

        if (currentIdx !== -1) {
          setCurrentWordIndex(currentIdx);
          currentWordIndexRef.current = currentIdx;
        }

        // Update current indicator
        return updatedStates.map((state, idx) => ({
          ...state,
          isCurrent: idx === currentIdx && currentIdx !== -1 && !state.spoken,
        }));
      });
    }, 10); // Process every 10ms for minimal latency

    return () => clearInterval(intervalId);
  }, [isRecording, transcription]);

  // Handle recording state changes
  useEffect(() => {
    const setupRecording = async () => {
      if (isRecording && transcriberRef.current) {
        console.log("🎤 Starting OpenAI realtime transcription");
        wordTimestamps.current.clear();
        accumulatedTranscript.current = "";
        previousTranscriptLength.current = 0; // Reset processed word count
        setWordStates((prevStates) =>
          prevStates.map((state) => ({
            ...state,
            spoken: false,
            isCurrent: false,
            revealed: !keywordMode || state.isKeyword || state.manuallyRevealed,
            performanceStatus: undefined,
            timeToSpeak: 0,
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
    const base = "inline-block px-3 py-1.5 mx-1 my-1 rounded-md font-medium transition-all duration-50 ease-linear";

    // Priority order: Current (reading now) > Missed > Hesitated > Correct > Default

    // Current word being READ - bright blue highlight (shows while reading)
    // This appears BEFORE any correctness evaluation
    if (word.isCurrent && isRecording && !word.spoken) {
      return cn(base, "bg-blue-500 text-white scale-110 shadow-lg ring-4 ring-blue-400/60 animate-pulse font-bold");
    }

    // AFTER word is fully spoken and confirmed by OpenAI:

    // Missed/Skipped - RED (word was skipped based on final transcript)
    // This applies to hidden words too!
    if (word.performanceStatus === "missed") {
      return cn(base, "bg-red-500 text-white shadow-sm line-through");
    }

    // Hesitated - ORANGE (took 4+ seconds, confirmed by final transcript)
    // This applies to hidden words too!
    if (word.performanceStatus === "hesitated") {
      return cn(base, "bg-orange-500 text-white shadow-sm");
    }

    // Correct - GREEN (spoken correctly, confirmed by final transcript)
    if (word.spoken && word.performanceStatus === "correct") {
      return cn(base, "bg-green-500 text-white shadow-md");
    }

    // In keyword mode, hidden words show as "..." - can be clicked when not recording
    if (keywordMode && !word.isKeyword && !word.manuallyRevealed && !word.spoken && !isRecording) {
      return cn(
        base,
        "bg-muted text-muted-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground",
        "text-center min-w-[60px]",
      );
    }

    // Default - unspoken word (no evaluation yet)
    return cn(base, "bg-muted/50 text-muted-foreground");
  };

  const renderWordContent = (word: WordState, index: number) => {
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
      {isRecording && (
        <div className="mb-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium text-center">
            🎤 Listening - Speak clearly and words will light up as you go
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-1 leading-loose">
        {wordStates.map((word, index) => {
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
            <span
              key={index}
              data-word-index={index}
              className={getWordClassName(word, index)}
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
          );
        })}
      </div>
    </div>
  );
};

export default EnhancedWordTracker;
