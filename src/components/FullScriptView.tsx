import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Mic, Square } from "lucide-react";

interface FullScriptViewProps {
  text: string;
  speechLanguage: string;
  onComplete: (durationSeconds: number) => void;
  onExit: () => void;
}

interface WordState {
  text: string;
  spoken: boolean;
}

const normalizeWord = (word: string): string => {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]/g, "");
};

const getWordSimilarity = (word1: string, word2: string): number => {
  const w1 = normalizeWord(word1);
  const w2 = normalizeWord(word2);
  
  if (w1 === w2) return 1.0;
  if (w1.length <= 2 || w2.length <= 2) return w1 === w2 ? 1.0 : 0.0;
  
  const maxLen = Math.max(w1.length, w2.length);
  const minLen = Math.min(w1.length, w2.length);
  if (minLen < maxLen * 0.7) return 0.0;
  
  if (w1.startsWith(w2) || w2.startsWith(w1)) return 0.9;
  
  let matches = 0;
  for (let i = 0; i < Math.min(w1.length, w2.length); i++) {
    if (w1[i] === w2[i]) matches++;
  }
  return matches / maxLen;
};

const getRecognitionLocale = (lang: string): string => {
  const localeMap: Record<string, string> = {
    'sv': 'sv-SE',
    'en': 'en-US',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-PT',
  };
  return localeMap[lang] || 'en-US';
};

export const FullScriptView = ({
  text,
  speechLanguage,
  onComplete,
  onExit,
}: FullScriptViewProps) => {
  const [wordStates, setWordStates] = useState<WordState[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const processedWordsRef = useRef<number>(0);

  // Initialize word states
  useEffect(() => {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    setWordStates(words.map(word => ({ text: word, spoken: false })));
    setCurrentWordIndex(0);
    processedWordsRef.current = 0;
  }, [text]);

  // Timer
  useEffect(() => {
    if (isRecording) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const processTranscript = useCallback((transcript: string) => {
    const spokenWords = transcript
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 0);
    
    // Only process new words
    const newWords = spokenWords.slice(processedWordsRef.current);
    if (newWords.length === 0) return;

    setWordStates(prev => {
      const updated = [...prev];
      let scriptPos = currentWordIndex;
      
      for (const spokenWord of newWords) {
        if (scriptPos >= updated.length) break;
        
        const targetWord = normalizeWord(updated[scriptPos].text);
        const similarity = getWordSimilarity(spokenWord, targetWord);
        
        if (similarity >= 0.7) {
          // Match - mark as spoken
          updated[scriptPos] = { ...updated[scriptPos], spoken: true };
          scriptPos++;
        } else {
          // Look ahead for match
          for (let lookAhead = 1; lookAhead <= 3 && scriptPos + lookAhead < updated.length; lookAhead++) {
            const futureWord = normalizeWord(updated[scriptPos + lookAhead].text);
            if (getWordSimilarity(spokenWord, futureWord) >= 0.7) {
              // Mark skipped words as spoken (no color marking)
              for (let i = scriptPos; i <= scriptPos + lookAhead; i++) {
                updated[i] = { ...updated[i], spoken: true };
              }
              scriptPos = scriptPos + lookAhead + 1;
              break;
            }
          }
        }
      }
      
      setCurrentWordIndex(scriptPos);
      return updated;
    });
    
    processedWordsRef.current = spokenWords.length;
  }, [currentWordIndex]);

  const startRecording = async () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.error("Speech recognition not supported");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = getRecognitionLocale(speechLanguage);
      
      recognition.onresult = (event: any) => {
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript + " ";
        }
        processTranscript(fullTranscript.trim());
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
      };

      recognition.onend = () => {
        // Restart if still recording
        if (isRecording && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.log("Recognition restart failed:", e);
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    onComplete(duration);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const spokenCount = wordStates.filter(w => w.spoken).length;
  const progress = wordStates.length > 0 ? Math.round((spokenCount / wordStates.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <X className="h-4 w-4 mr-2" />
          Exit
        </Button>
        
        <div className="text-center">
          <div className="text-2xl font-mono font-bold">{formatTime(elapsedTime)}</div>
          <div className="text-xs text-muted-foreground">{progress}% complete</div>
        </div>
        
        <div className="w-20" /> {/* Spacer for alignment */}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Script text */}
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-2xl md:text-3xl leading-relaxed font-medium">
            {wordStates.map((word, index) => (
              <span
                key={index}
                className={cn(
                  "inline-block mr-2 mb-1 transition-all duration-500",
                  word.spoken && "opacity-20",
                  index === currentWordIndex && isRecording && "font-bold"
                )}
              >
                {word.text}
              </span>
            ))}
          </p>
        </div>
      </ScrollArea>

      {/* Footer with controls */}
      <div className="p-6 border-t bg-background/95 backdrop-blur">
        <div className="flex justify-center">
          {!isRecording ? (
            <Button
              size="lg"
              onClick={startRecording}
              className="gap-2 px-8"
            >
              <Mic className="h-5 w-5" />
              Start Speaking
            </Button>
          ) : (
            <Button
              size="lg"
              variant="destructive"
              onClick={stopRecording}
              className="gap-2 px-8"
            >
              <Square className="h-5 w-5" />
              Stop & Finish
            </Button>
          )}
        </div>
        
        {isRecording && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Speak naturally. Words will fade as you say them.
          </p>
        )}
      </div>
    </div>
  );
};
