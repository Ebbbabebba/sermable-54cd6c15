import { useEffect, useState, useRef } from 'react';
import './SpeechTrainingLine.css';

interface WordStatus {
  text: string;
  status: 'gray' | 'yellow' | 'red' | 'pending';
  pulse?: boolean;
}

interface SpeechTrainingLineProps {
  expectedText: string;
  websocketUrl: string;
}

export default function SpeechTrainingLine({ expectedText, websocketUrl }: SpeechTrainingLineProps) {
  const [words, setWords] = useState<WordStatus[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const expectedWords = expectedText.trim().split(/\s+/);
  const lastInterimWordRef = useRef<string | null>(null);

  useEffect(() => {
    setWords(expectedWords.map((w) => ({ text: w, status: 'gray' })));

    const ws = new WebSocket(websocketUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'transcription_interim') {
        lastInterimWordRef.current = data.words[data.words.length - 1];
        handleInterimUpdate();
      }
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

  const handleInterimUpdate = () => {
    setWords((prev) => {
      return prev.map((word) => {
        if (word.status === 'pending') {
          return { ...word, status: 'gray' };
        }
        return word;
      });
    });
  };

  const handleFinalTranscription = (spokenWords: string[]) => {
    const updated = diffWords(spokenWords, expectedWords);
    setWords(updated);
  };

  const diffWords = (spoken: string[], expected: string[]): WordStatus[] => {
    const newWords: WordStatus[] = [];
    let spokenIndex = 0;

    expected.forEach((exp, i) => {
      const spokenWord = spoken[spokenIndex];

      if (!spokenWord) {
        newWords.push({ text: exp, status: 'red', pulse: true });
        return;
      }

      if (isCorrectWord(spokenWord, exp)) {
        newWords.push({ text: exp, status: 'gray', pulse: false });
        spokenIndex++;
      } else if (isAlmostWord(spokenWord, exp)) {
        newWords.push({ text: exp, status: 'yellow', pulse: false });
        spokenIndex++;
        setTimeout(() => {
          setWords((prev) => prev.map((w, idx) => (idx === i ? { ...w, status: 'gray' } : w)));
        }, 900);
      } else {
        newWords.push({ text: exp, status: 'red', pulse: true });
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
