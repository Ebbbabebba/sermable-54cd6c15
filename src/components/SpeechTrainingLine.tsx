import { useEffect, useState, useRef } from 'react';
import './SpeechTrainingLine.css';

interface WordStatus {
  text: string;
  status: 'gray' | 'red';
  pulse?: boolean;
  delay?: number;
}

interface SpeechTrainingLineProps {
  expectedText: string;
  websocketUrl: string;
}

export default function SpeechTrainingLine({ expectedText, websocketUrl }: SpeechTrainingLineProps) {
  const [words, setWords] = useState<WordStatus[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const expectedWords = expectedText.trim().split(/\s+/);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setWords(expectedWords.map((w) => ({ text: w, status: 'gray' })));

    const ws = new WebSocket(websocketUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Only process final transcriptions
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

  const handleFinalTranscription = (spokenWords: string[]) => {
    setIsProcessing(true);
    const updated = diffWords(spokenWords, expectedWords);
    
    // Apply words with delays for red highlighting
    setWords(updated.map(w => ({ ...w, status: 'gray' }))); // Start all as gray
    
    // Then apply red highlights with delays
    updated.forEach((word, index) => {
      if (word.status === 'red') {
        const delay = word.delay || 0;
        setTimeout(() => {
          setWords(prev => prev.map((w, i) => 
            i === index ? { ...w, status: 'red', pulse: true } : w
          ));
        }, delay);
      }
    });
    
    setTimeout(() => setIsProcessing(false), 1000);
  };

  const diffWords = (spoken: string[], expected: string[]): WordStatus[] => {
    const newWords: WordStatus[] = [];
    let spokenIndex = 0;
    let redWordCount = 0;

    expected.forEach((exp) => {
      const spokenWord = spoken[spokenIndex];

      // Word not spoken - mark as red with delay
      if (!spokenWord) {
        newWords.push({ 
          text: exp, 
          status: 'red', 
          pulse: true,
          delay: 600 + (redWordCount * 150) // Staggered delay
        });
        redWordCount++;
        return;
      }

      // Exact match or almost correct - stay gray
      if (isCorrectWord(spokenWord, exp) || isAlmostWord(spokenWord, exp)) {
        newWords.push({ text: exp, status: 'gray' });
        spokenIndex++;
      } else {
        // Incorrect word - mark as red with delay
        newWords.push({ 
          text: exp, 
          status: 'red', 
          pulse: true,
          delay: 600 + (redWordCount * 150) // Staggered delay
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
      {words.map((w, i) => (
        <span key={i} className={`word-block word-${w.status} ${w.pulse ? 'pulse' : ''}`}>
          {w.text}
        </span>
      ))}
    </div>
  );
}
