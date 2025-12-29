/**
 * Haptic Feedback Hook
 * Provides vibration patterns for wearable devices using the Vibration API
 */

export type HapticPattern = 
  | 'success'       // Correct word spoken
  | 'error'         // Wrong word / missed
  | 'warning'       // Silence detected
  | 'progress'      // Segment complete
  | 'complete'      // Presentation finished
  | 'tap'           // Light interaction feedback
  | 'pulse';        // Listening pulse

interface HapticFeedbackOptions {
  enabled?: boolean;
}

export const useHapticFeedback = (options: HapticFeedbackOptions = {}) => {
  const { enabled = true } = options;
  
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const vibrate = (pattern: number | number[]): boolean => {
    if (!enabled || !isSupported) return false;
    
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  };

  const patterns: Record<HapticPattern, number | number[]> = {
    // Short single pulse - success/correct
    success: 50,
    
    // Double short pulse - error/wrong
    error: [100, 50, 100],
    
    // Long pulse - warning/silence
    warning: 300,
    
    // Triple pulse - segment complete
    progress: [50, 100, 50, 100, 50],
    
    // Celebration pattern - presentation complete
    complete: [100, 50, 100, 50, 200, 100, 200],
    
    // Very light tap
    tap: 20,
    
    // Gentle pulse for "listening" state
    pulse: 30,
  };

  const trigger = (pattern: HapticPattern): boolean => {
    return vibrate(patterns[pattern]);
  };

  const cancel = (): boolean => {
    if (!isSupported) return false;
    return navigator.vibrate(0);
  };

  // Custom vibration for special cases
  const custom = (pattern: number | number[]): boolean => {
    return vibrate(pattern);
  };

  return {
    isSupported,
    enabled,
    trigger,
    cancel,
    custom,
    patterns,
  };
};
