import { useState, useCallback, useRef, useEffect } from "react";
import type { AudienceState } from "./types";

interface WordPerformance {
  status: 'correct' | 'hesitated' | 'missed' | 'skipped';
  timeToSpeak?: number;
}

interface UseAudienceReactionsOptions {
  windowSize?: number; // Number of words in rolling window
  hesitationThreshold?: number; // Seconds to count as hesitation
  monotoneThreshold?: number; // Variance threshold for monotone detection
}

export const useAudienceReactions = (options: UseAudienceReactionsOptions = {}) => {
  const {
    windowSize = 10,
    hesitationThreshold = 2000, // 2 seconds in ms
    monotoneThreshold = 500, // variance in timing
  } = options;

  const [audienceState, setAudienceState] = useState<AudienceState>({
    overallMood: 'neutral',
    recentAccuracy: 80,
    hesitationCount: 0,
    monotoneScore: 0,
    energyLevel: 50,
  });

  const recentWordsRef = useRef<WordPerformance[]>([]);
  const timingsRef = useRef<number[]>([]);

  // Calculate rolling accuracy from recent words
  const calculateRollingAccuracy = useCallback((words: WordPerformance[]): number => {
    if (words.length === 0) return 80;
    const correct = words.filter(w => w.status === 'correct').length;
    return Math.round((correct / words.length) * 100);
  }, []);

  // Calculate monotone score from timing variance
  const calculateMonotoneScore = useCallback((timings: number[]): number => {
    if (timings.length < 3) return 0;
    
    const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
    const variance = timings.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / timings.length;
    const stdDev = Math.sqrt(variance);
    
    // Low variance = more monotone (higher score)
    // Map stdDev to 0-100 where low stdDev = high monotone score
    const monotone = Math.max(0, Math.min(100, 100 - (stdDev / monotoneThreshold) * 100));
    return Math.round(monotone);
  }, [monotoneThreshold]);

  // Calculate energy level from timing (faster = higher energy)
  const calculateEnergyLevel = useCallback((timings: number[]): number => {
    if (timings.length === 0) return 50;
    
    const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
    // Assume 500ms is fast (high energy), 2000ms is slow (low energy)
    const energy = Math.max(0, Math.min(100, 100 - ((avgTiming - 500) / 15)));
    return Math.round(energy);
  }, []);

  // Determine overall mood from metrics
  const calculateOverallMood = useCallback((
    accuracy: number,
    hesitations: number,
    energy: number
  ): 'positive' | 'neutral' | 'negative' => {
    if (accuracy >= 85 && hesitations <= 1 && energy >= 50) return 'positive';
    if (accuracy < 60 || hesitations >= 3) return 'negative';
    return 'neutral';
  }, []);

  // Record a word performance and update state
  const recordWordPerformance = useCallback((performance: WordPerformance) => {
    // Add to rolling window
    recentWordsRef.current.push(performance);
    if (recentWordsRef.current.length > windowSize) {
      recentWordsRef.current.shift();
    }

    // Track timing for energy/monotone calculation
    if (performance.timeToSpeak) {
      timingsRef.current.push(performance.timeToSpeak);
      if (timingsRef.current.length > windowSize) {
        timingsRef.current.shift();
      }
    }

    // Calculate new metrics
    const recentAccuracy = calculateRollingAccuracy(recentWordsRef.current);
    const hesitationCount = recentWordsRef.current.filter(
      w => w.status === 'hesitated' || (w.timeToSpeak && w.timeToSpeak > hesitationThreshold)
    ).length;
    const monotoneScore = calculateMonotoneScore(timingsRef.current);
    const energyLevel = calculateEnergyLevel(timingsRef.current);
    const overallMood = calculateOverallMood(recentAccuracy, hesitationCount, energyLevel);

    setAudienceState({
      overallMood,
      recentAccuracy,
      hesitationCount,
      monotoneScore,
      energyLevel,
    });
  }, [
    windowSize, 
    hesitationThreshold, 
    calculateRollingAccuracy, 
    calculateMonotoneScore, 
    calculateEnergyLevel,
    calculateOverallMood
  ]);

  // Quick update for real-time hesitation detection
  const recordHesitation = useCallback(() => {
    setAudienceState(prev => ({
      ...prev,
      hesitationCount: prev.hesitationCount + 1,
      overallMood: prev.hesitationCount >= 2 ? 'negative' : prev.overallMood,
    }));
  }, []);

  // Boost energy when user speaks with enthusiasm
  const recordEnergyBoost = useCallback((boost: number) => {
    setAudienceState(prev => ({
      ...prev,
      energyLevel: Math.min(100, prev.energyLevel + boost),
      overallMood: prev.energyLevel + boost > 70 ? 'positive' : prev.overallMood,
    }));
  }, []);

  // Reset state for new session
  const resetAudienceState = useCallback(() => {
    recentWordsRef.current = [];
    timingsRef.current = [];
    setAudienceState({
      overallMood: 'neutral',
      recentAccuracy: 80,
      hesitationCount: 0,
      monotoneScore: 0,
      energyLevel: 50,
    });
  }, []);

  // Simulate audience reactions for demo purposes
  const simulateReaction = useCallback((
    type: 'good' | 'hesitation' | 'mistake' | 'energy'
  ) => {
    switch (type) {
      case 'good':
        recordWordPerformance({ status: 'correct', timeToSpeak: 400 + Math.random() * 300 });
        break;
      case 'hesitation':
        recordWordPerformance({ status: 'hesitated', timeToSpeak: 2500 + Math.random() * 1000 });
        recordHesitation();
        break;
      case 'mistake':
        recordWordPerformance({ status: 'missed', timeToSpeak: 1000 });
        break;
      case 'energy':
        recordEnergyBoost(15);
        break;
    }
  }, [recordWordPerformance, recordHesitation, recordEnergyBoost]);

  return {
    audienceState,
    recordWordPerformance,
    recordHesitation,
    recordEnergyBoost,
    resetAudienceState,
    simulateReaction,
  };
};
