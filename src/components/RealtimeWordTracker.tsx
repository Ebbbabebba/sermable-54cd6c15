import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface RealtimeWordTrackerProps {
  text: string;
  isRecording: boolean;
  onTranscriptUpdate?: (transcript: string) => void;
  className?: string;
}

const RealtimeWordTracker = ({ 
  text, 
  isRecording, 
  onTranscriptUpdate,
  className 
}: RealtimeWordTrackerProps) => {
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());
  const [currentWord, setCurrentWord] = useState<string>("");
  const recognitionRef = useRef<any>(null);
  const words = text.split(/(\s+)/);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      
      if (onTranscriptUpdate) {
        onTranscriptUpdate(transcript);
      }

      // Extract words and mark as spoken
      const transcriptWords = transcript.toLowerCase().split(/\s+/);
      const newSpokenWords = new Set(spokenWords);
      
      transcriptWords.forEach(word => {
        const cleanWord = word.replace(/[^\w]/g, '');
        if (cleanWord) {
          newSpokenWords.add(cleanWord);
        }
      });
      
      setSpokenWords(newSpokenWords);
      
      // Track current word being spoken
      if (transcriptWords.length > 0) {
        setCurrentWord(transcriptWords[transcriptWords.length - 1].replace(/[^\w]/g, ''));
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording && recognitionRef.current) {
      setSpokenWords(new Set());
      setCurrentWord("");
      recognitionRef.current.start();
    } else if (!isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [isRecording]);

  const getWordStyle = (word: string) => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    
    if (!cleanWord) return "text-foreground/80";
    
    if (currentWord === cleanWord) {
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 font-medium scale-105";
    }
    
    if (spokenWords.has(cleanWord)) {
      return "bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-300 font-medium";
    }
    
    return "text-foreground/60";
  };

  return (
    <div className={cn("prose prose-lg max-w-none leading-relaxed", className)}>
      {words.map((word, index) => {
        if (/^\s+$/.test(word)) {
          return <span key={index}>{word}</span>;
        }
        
        return (
          <span
            key={index}
            className={cn(
              "inline-block px-1 rounded transition-all duration-200",
              getWordStyle(word)
            )}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

export default RealtimeWordTracker;
