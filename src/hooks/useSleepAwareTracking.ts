/**
 * Hook to track evening practice sessions for morning recall prompts.
 * Based on sleep consolidation research - practicing before sleep
 * helps memory consolidation during REM sleep.
 */

export const useSleepAwareTracking = () => {
  /**
   * Records that a practice session started during evening hours.
   * This enables the morning recall prompt the next day.
   */
  const trackPracticeStart = (speechId: string) => {
    const hour = new Date().getHours();
    
    // Evening hours (7 PM - 11 PM) are optimal for pre-sleep practice
    if (hour >= 19 && hour < 23) {
      localStorage.setItem('last-evening-practice', JSON.stringify({
        speechId,
        timestamp: new Date().toISOString()
      }));
    }
  };

  /**
   * Clears the morning recall prompt after user has completed it.
   */
  const clearMorningRecall = () => {
    localStorage.removeItem('last-evening-practice');
  };

  /**
   * Checks if there's a pending morning recall.
   */
  const hasPendingMorningRecall = (): { speechId: string; timestamp: string } | null => {
    const data = localStorage.getItem('last-evening-practice');
    if (!data) return null;
    
    try {
      const parsed = JSON.parse(data);
      const lastPracticeDate = new Date(parsed.timestamp);
      const now = new Date();
      const hoursSince = (now.getTime() - lastPracticeDate.getTime()) / (1000 * 60 * 60);
      
      // Valid if practiced within last 14 hours but more than 4 hours ago (slept)
      if (hoursSince < 14 && hoursSince > 4) {
        return parsed;
      }
      
      return null;
    } catch {
      return null;
    }
  };

  return {
    trackPracticeStart,
    clearMorningRecall,
    hasPendingMorningRecall
  };
};

export default useSleepAwareTracking;
