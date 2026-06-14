import { useRef, useCallback, useState } from 'react';

interface TempoStats {
  wordIntervals: number[];       // All word-to-word intervals (last 50)
  sentencePauses: number[];      // Pauses after sentence endings (last 20)
  shortWordIntervals: number[];  // Intervals for 1-3 char words
  longWordIntervals: number[];   // Intervals for 8+ char words
  totalWordsProcessed: number;
}

interface AdaptiveThresholdOptions {
  wordLength: number;
  isAfterSentence: boolean;
  isFirstWord: boolean;
  sentenceStartExtraMs?: number;
}

interface UseAdaptiveTempoReturn {
  // Record a new word timing
  recordWordTiming: (intervalMs: number, wordLength: number, isAfterSentence: boolean) => void;
  
  // Get adaptive hesitation threshold for current word
  getAdaptiveThreshold: (options: AdaptiveThresholdOptions) => number;
  
  // Get adaptive hint delays. Pass masteryConfidence (0..1) to apply "desirable
  // difficulty" — higher confidence = longer wait before hints (forces retrieval).
  getAdaptiveHintDelays: (options: AdaptiveThresholdOptions, masteryConfidence?: number) => { initialDelay: number; stepDelay: number };
  
  // Current learning phase: 'calibration' | 'learning' | 'adapted'
  phase: 'calibration' | 'learning' | 'adapted';
  
  // Current speaking tempo in words per minute (0 if not enough data)
  tempoWPM: number;
  
  // Reset all stats (call when starting new session)
  reset: () => void;
  
  // Get current median interval (for display/debugging)
  medianInterval: number;
}

// Statistical helpers
const calculateMedian = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const calculateStdDev = (arr: number[], mean?: number): number => {
  if (arr.length < 2) return 0;
  const avg = mean ?? arr.reduce((a, b) => a + b, 0) / arr.length;
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / arr.length);
};

const calculatePercentile = (arr: number[], percentile: number): number => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

// Phase thresholds
const CALIBRATION_WORDS = 5;   // First 5 words: use generous defaults (faster adaptation)
const LEARNING_WORDS = 20;     // 5-20 words: blend defaults with statistics
const SLIDING_WINDOW = 50;     // Keep last 50 intervals for adaptive calculation

// Default generous thresholds (used during calibration)
const DEFAULT_THRESHOLD_FIRST_WORD = 3000;  // 3s for very first word
const DEFAULT_THRESHOLD_NORMAL = 1500;      // 1.5s for other words
const DEFAULT_THRESHOLD_SENTENCE = 3500;    // 3.5s after sentence

export function useAdaptiveTempo(): UseAdaptiveTempoReturn {
  const statsRef = useRef<TempoStats>({
    wordIntervals: [],
    sentencePauses: [],
    shortWordIntervals: [],
    longWordIntervals: [],
    totalWordsProcessed: 0,
  });
  
  const [phase, setPhase] = useState<'calibration' | 'learning' | 'adapted'>('calibration');
  const [tempoWPM, setTempoWPM] = useState(0);
  const [medianInterval, setMedianInterval] = useState(0);
  
  const recordWordTiming = useCallback((intervalMs: number, wordLength: number, isAfterSentence: boolean) => {
    const stats = statsRef.current;
    
    // Only record reasonable intervals (50ms to 10s)
    if (intervalMs < 50 || intervalMs > 10000) return;
    
    // Add to general intervals
    stats.wordIntervals.push(intervalMs);
    if (stats.wordIntervals.length > SLIDING_WINDOW) {
      stats.wordIntervals.shift();
    }
    
    // Add to sentence pauses if applicable
    if (isAfterSentence) {
      stats.sentencePauses.push(intervalMs);
      if (stats.sentencePauses.length > 20) {
        stats.sentencePauses.shift();
      }
    }
    
    // Categorize by word length
    if (wordLength <= 3) {
      stats.shortWordIntervals.push(intervalMs);
      if (stats.shortWordIntervals.length > 30) stats.shortWordIntervals.shift();
    } else if (wordLength >= 8) {
      stats.longWordIntervals.push(intervalMs);
      if (stats.longWordIntervals.length > 30) stats.longWordIntervals.shift();
    }
    
    stats.totalWordsProcessed++;
    
    // Update phase
    if (stats.totalWordsProcessed < CALIBRATION_WORDS) {
      setPhase('calibration');
    } else if (stats.totalWordsProcessed < LEARNING_WORDS) {
      setPhase('learning');
    } else {
      setPhase('adapted');
    }
    
    // Calculate tempo WPM (if we have enough data)
    if (stats.wordIntervals.length >= 5) {
      const avgInterval = stats.wordIntervals.reduce((a, b) => a + b, 0) / stats.wordIntervals.length;
      const wpm = avgInterval > 0 ? Math.round(60000 / avgInterval) : 0;
      setTempoWPM(wpm);
      setMedianInterval(calculateMedian(stats.wordIntervals));
    }
  }, []);
  
  const getAdaptiveThreshold = useCallback((options: AdaptiveThresholdOptions): number => {
    const { wordLength, isAfterSentence, isFirstWord, sentenceStartExtraMs = 0 } = options;
    const stats = statsRef.current;
    
    // Phase 1: Calibration - use generous defaults
    if (stats.totalWordsProcessed < CALIBRATION_WORDS) {
      let threshold = isFirstWord ? DEFAULT_THRESHOLD_FIRST_WORD : DEFAULT_THRESHOLD_NORMAL;
      if (isAfterSentence) threshold = DEFAULT_THRESHOLD_SENTENCE;
      return threshold + sentenceStartExtraMs;
    }
    
    // Choose relevant intervals based on context
    let relevantIntervals = isAfterSentence && stats.sentencePauses.length >= 3
      ? stats.sentencePauses
      : stats.wordIntervals;
    
    // Use word-length specific intervals if we have enough data
    if (wordLength <= 3 && stats.shortWordIntervals.length >= 5) {
      relevantIntervals = stats.shortWordIntervals;
    } else if (wordLength >= 8 && stats.longWordIntervals.length >= 5) {
      relevantIntervals = stats.longWordIntervals;
    }
    
    const median = calculateMedian(relevantIntervals);
    const stdDev = calculateStdDev(relevantIntervals, median);
    
    // Phase 2: Learning - blend defaults with statistics (50/50)
    if (stats.totalWordsProcessed < LEARNING_WORDS) {
      const defaultThreshold = isAfterSentence ? DEFAULT_THRESHOLD_SENTENCE : 
                              isFirstWord ? DEFAULT_THRESHOLD_FIRST_WORD : 
                              DEFAULT_THRESHOLD_NORMAL;
      const adaptiveThreshold = median + (1.5 * stdDev);
      const blended = (defaultThreshold + adaptiveThreshold) / 2;
      
      // Apply word length modifier
      let modifier = 1.0;
      if (wordLength <= 3) modifier = 0.7;
      else if (wordLength >= 8) modifier = 1.5;
      
      // Clamp to wider range to support very slow and very fast speakers
      return Math.max(300, Math.min(7000, blended * modifier)) + sentenceStartExtraMs;
    }
    
    // Phase 3: Full adaptation
    // Threshold = median + 1.5 * stdDev (captures ~93% of natural variation)
    let threshold = median + (1.5 * stdDev);
    
    // Word length modifiers (wider range to forgive long words / reward short ones)
    if (wordLength <= 3) threshold *= 0.7;       // Short words: expect faster
    else if (wordLength >= 8) threshold *= 1.5;  // Long words: allow more time
    
    // Burst mode: if last 3 intervals are all very fast (<300ms), the user is
    // mid-burst — relax threshold so we don't yellow-flag rapid chunks.
    if (stats.wordIntervals.length >= 3) {
      const last3 = stats.wordIntervals.slice(-3);
      if (last3.every(i => i < 300)) {
        threshold = Math.min(threshold, median * 1.2);
      }
    }
    
    // Sentence-start gets extra time
    if (isAfterSentence) {
      // Use P90 of sentence pauses if available, otherwise add buffer
      if (stats.sentencePauses.length >= 3) {
        const p90 = calculatePercentile(stats.sentencePauses, 90);
        threshold = Math.max(threshold, p90);
      } else {
        threshold *= 1.5;
      }
    }
    
    // First word of session always gets generous time
    if (isFirstWord) {
      threshold = Math.max(threshold, 2500);
    }
    
    // Clamp to wider range (200ms to 7s) — supports both rapid and slow talkers
    return Math.max(200, Math.min(7000, threshold)) + sentenceStartExtraMs;
  }, []);
  
  
  const getAdaptiveHintDelays = useCallback((options: AdaptiveThresholdOptions, masteryConfidence: number = 0): { initialDelay: number; stepDelay: number } => {
    const stats = statsRef.current;
    const threshold = getAdaptiveThreshold(options);
    
    // Step delay is based on median interval (faster speakers get faster hint progression)
    const median = stats.wordIntervals.length >= 5 
      ? calculateMedian(stats.wordIntervals) 
      : 500;
    
    // Desirable difficulty: scale up wait time as confidence grows.
    // 0% confidence → 1.0x, 100% confidence → 2.0x. This forces the learner
    // to actually retrieve the word instead of being rescued instantly.
    const difficultyMultiplier = 1 + Math.max(0, Math.min(1, masteryConfidence));
    
    const initialDelay = Math.min(2500, threshold * difficultyMultiplier);
    
    // Step delay: ~50-70% of median, also scaled by difficulty, clamped 350–1500ms
    const stepDelay = Math.max(350, Math.min(1500, median * 0.6 * difficultyMultiplier));
    
    return { initialDelay, stepDelay };
  }, [getAdaptiveThreshold]);
  
  const reset = useCallback(() => {
    statsRef.current = {
      wordIntervals: [],
      sentencePauses: [],
      shortWordIntervals: [],
      longWordIntervals: [],
      totalWordsProcessed: 0,
    };
    setPhase('calibration');
    setTempoWPM(0);
    setMedianInterval(0);
  }, []);
  
  return {
    recordWordTiming,
    getAdaptiveThreshold,
    getAdaptiveHintDelays,
    phase,
    tempoWPM,
    reset,
    medianInterval,
  };
}
