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
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const lastWordTimeRef = useRef<number>(Date.now());
  const wordTimingsRef = useRef<number[]>([]);

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

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [expectedText, websocketUrl]);

  const handleInterimTranscription = (spokenWords: string[]) => {
    // Update word progression in real-time - all stay gray
    const spokenCount = spokenWords.length;
    const newIndex = Math.min(spokenCount, expectedWords.length);
    
    // Track timing when moving to a new word
    if (newIndex > currentWordIndex) {
      const now = Date.now();
      const timeSinceLastWord = (now - lastWordTimeRef.current) / 1000;
      wordTimingsRef.current.push(timeSinceLastWord);
      lastWordTimeRef.current = now;
    }
    
    setCurrentWordIndex(newIndex);
  };

  const handleFinalTranscription = (spokenWords: string[]) => {
    setIsProcessing(true);
    const updated = diffWords(spokenWords, expectedWords);
    
    // Reset all words to gray first
    setWords(expectedWords.map(w => ({ text: w, status: 'gray' })));
    
    // Apply red and yellow highlights with staggered delays
    updated.forEach((word, index) => {
      if ((word.status === 'red' || word.status === 'yellow') && word.delay !== undefined) {
        setTimeout(() => {
          setWords(prev => prev.map((w, i) => 
            i === index ? { text: word.text, status: word.status, pulse: true } : w
          ));
        }, word.delay);
      }
    });
    
    // Reset timing trackers
    lastWordTimeRef.current = Date.now();
    wordTimingsRef.current = [];
    
    setTimeout(() => setIsProcessing(false), 1200);
  };

  const diffWords = (spoken: string[], expected: string[]): WordStatus[] => {
    const newWords: WordStatus[] = [];
    let spokenIndex = 0;
    let redWordCount = 0;

    expected.forEach((exp, expectedIndex) => {
      const spokenWord = spoken[spokenIndex];
      const wordTiming = wordTimingsRef.current[expectedIndex];

      // Check if user hesitated too long
      const threshold = expectedIndex === 0 ? firstWordHesitationThreshold : hesitationThreshold;
      const hesitated = wordTiming !== undefined && wordTiming > threshold;

      // Word not spoken - mark as red with delay
      if (!spokenWord) {
        newWords.push({ 
          text: exp, 
          status: 'red', 
          pulse: true,
          delay: 600 + (redWordCount * 150)
        });
        redWordCount++;
        return;
      }

      // Exact match
      if (isCorrectWord(spokenWord, exp)) {
        // Check if hesitated
        if (hesitated) {
          newWords.push({ 
            text: exp, 
            status: 'yellow', 
            pulse: true,
            delay: 600 + (redWordCount * 150)
          });
          redWordCount++;
        } else {
          newWords.push({ text: exp, status: 'gray' });
        }
        spokenIndex++;
      } else if (isAlmostWord(spokenWord, exp)) {
        // Almost correct - mark as yellow with delay
        newWords.push({ 
          text: exp, 
          status: 'yellow', 
          pulse: true,
          delay: 600 + (redWordCount * 150)
        });
        redWordCount++;
        spokenIndex++;
      } else {
        // Incorrect word - mark as red with delay
        newWords.push({ 
          text: exp, 
          status: 'red', 
          pulse: true,
          delay: 600 + (redWordCount * 150)
        });
        redWordCount++;
        spokenIndex++;
      }
    });

    return newWords;
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
        const isCurrentWord = i === currentWordIndex && !isProcessing;
        const isPastWord = i < currentWordIndex;
        
        return (
          <span
            key={i}
            className={`word-block word-${w.status} ${w.pulse ? 'pulse' : ''} ${
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
