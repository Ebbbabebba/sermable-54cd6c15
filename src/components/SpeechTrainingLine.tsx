import { useEffect, useState, useRef } from 'react';
import './SpeechTrainingLine.css';

interface WordStatus {
  text: string;
  status: 'gray' | 'red' | 'yellow';
  pulse?: boolean;
  delay?: number;
}

interface SpeechTrainingLineProps {
  expectedText: string;
  websocketUrl: string;
  hesitationThreshold?: number; // seconds
  firstWordHesitationThreshold?: number; // seconds
}

export default function SpeechTrainingLine({ 
  expectedText, 
  websocketUrl,
  hesitationThreshold = 2,
  firstWordHesitationThreshold = 4
}: SpeechTrainingLineProps) {
  const [words, setWords] = useState<WordStatus[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const expectedWords = expectedText.trim().split(/\s+/);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const lastWordTimeRef = useRef<number>(Date.now());
  const hesitationTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setWords(expectedWords.map((w) => ({ text: w, status: 'gray' })));

    const ws = new WebSocket(websocketUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Handle interim transcriptions for word progression
      if (data.type === 'transcription_interim') {
        handleInterimTranscription(data.words);
      }
      
      // Process final transcriptions for error highlighting
      if (data.type === 'transcription_final') {
        handleFinalTranscription(data.words);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Start hesitation timer for first word
    const threshold = firstWordHesitationThreshold;
    hesitationTimerRef.current = setTimeout(() => {
      setWords(prev => prev.map((w, i) => 
        i === 0 ? { ...w, status: 'yellow', pulse: true } : w
      ));
    }, threshold * 1000);

    return () => {
      if (hesitationTimerRef.current) {
        clearTimeout(hesitationTimerRef.current);
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [expectedText, websocketUrl, firstWordHesitationThreshold]);

  const handleInterimTranscription = (spokenWords: string[]) => {
    const spokenCount = spokenWords.length;
    const newIndex = Math.min(spokenCount, expectedWords.length);
    
    // Moving to a new word
    if (newIndex > currentWordIndex) {
      // Clear hesitation timer
      if (hesitationTimerRef.current) {
        clearTimeout(hesitationTimerRef.current);
        hesitationTimerRef.current = null;
      }
      
      // Check if previous word was correct
      if (currentWordIndex < expectedWords.length && spokenWords[currentWordIndex]) {
        const spokenWord = spokenWords[currentWordIndex];
        const expectedWord = expectedWords[currentWordIndex];
        
        if (!isCorrectWord(spokenWord, expectedWord)) {
          // Mark as red immediately
          setWords(prev => prev.map((w, i) => 
            i === currentWordIndex ? { ...w, status: 'red', pulse: true } : w
          ));
        }
      }
      
      setCurrentWordIndex(newIndex);
      lastWordTimeRef.current = Date.now();
      
      // Start hesitation timer for new word
      if (newIndex < expectedWords.length) {
        const threshold = newIndex === 0 ? firstWordHesitationThreshold : hesitationThreshold;
        hesitationTimerRef.current = setTimeout(() => {
          setWords(prev => prev.map((w, i) => 
            i === newIndex ? { ...w, status: 'yellow', pulse: true } : w
          ));
        }, threshold * 1000);
      }
    }
  };

  const handleFinalTranscription = (spokenWords: string[]) => {
    // Clear any pending hesitation timer
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
    
    // Mark any remaining unspoken words as red
    setWords(prev => prev.map((w, i) => {
      if (i >= spokenWords.length) {
        return { ...w, status: 'red', pulse: true };
      }
      return w;
    }));
    
    // Reset for next session
    setCurrentWordIndex(0);
    lastWordTimeRef.current = Date.now();
  };


  const isCorrectWord = (spoken: string, expected: string): boolean => 
    spoken.toLowerCase() === expected.toLowerCase();

  const isAlmostWord = (spoken: string, expected: string): boolean => {
    const lev = levenshtein(spoken.toLowerCase(), expected.toLowerCase());
    return lev <= 2;
  };

  const levenshtein = (a: string, b: string): number => {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1)
        );
      }
    }
    return matrix[b.length][a.length];
  };

  return (
    <div className="speech-line">
      {words.map((w, i) => {
        const isCurrentWord = i === currentWordIndex;
        const isPastWord = i < currentWordIndex;
        
        return (
          <span
            key={i}
            className={`word-block word-${w.status} ${
              isCurrentWord ? 'current-word' : ''
            } ${isPastWord ? 'past-word' : ''}`}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}
