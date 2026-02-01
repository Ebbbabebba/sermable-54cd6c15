import { motion } from "framer-motion";
import { AvatarCharacter } from "./AvatarCharacter";
import { EnvironmentBackground } from "./environments";
import { 
  DEFAULT_CHARACTERS, 
  type Expression, 
  type Environment,
  type AudienceState 
} from "./types";
import { useMemo } from "react";

interface AudienceGridProps {
  environment: Environment;
  audienceState: AudienceState;
  className?: string;
}

// Determine expression based on character personality and audience state
const getCharacterExpression = (
  character: typeof DEFAULT_CHARACTERS[0], 
  state: AudienceState
): Expression => {
  const { recentAccuracy, hesitationCount, monotoneScore, energyLevel } = state;
  
  // Check if celebrating (high accuracy + high energy)
  if (recentAccuracy >= 95 && energyLevel >= 70) {
    return 'celebrating';
  }
  
  // Check personality-based reactions
  switch (character.personality) {
    case 'enthusiastic':
      // Easily impressed, rarely bored
      if (recentAccuracy >= character.impressedThreshold) return 'impressed';
      if (monotoneScore > character.boredThreshold && energyLevel < 30) return 'bored';
      if (hesitationCount >= character.confusedThreshold) return 'confused';
      return energyLevel > 50 ? 'listening' : 'neutral';
      
    case 'analytical':
      // Hard to impress, notices hesitations quickly
      if (hesitationCount >= character.confusedThreshold) return 'confused';
      if (recentAccuracy >= character.impressedThreshold) return 'impressed';
      if (monotoneScore > character.boredThreshold) return 'skeptical';
      return 'listening';
      
    case 'skeptical':
      // Very hard to impress, easily skeptical
      if (recentAccuracy < 70) return 'skeptical';
      if (hesitationCount >= character.confusedThreshold) return 'confused';
      if (recentAccuracy >= character.impressedThreshold) return 'impressed';
      if (monotoneScore > character.boredThreshold) return 'bored';
      return 'neutral';
      
    case 'supportive':
      // Easy to impress, rarely shows negative expressions
      if (recentAccuracy >= character.impressedThreshold - 10) return 'impressed';
      if (hesitationCount >= character.confusedThreshold + 1) return 'confused';
      return 'listening';
      
    case 'distracted':
      // Often neutral or bored, occasionally pays attention
      if (energyLevel > 80) return 'impressed';
      if (monotoneScore > 40) return 'bored';
      if (Math.random() > 0.7) return 'listening';
      return 'neutral';
      
    default:
      return 'neutral';
  }
};

export const AudienceGrid = ({ 
  environment, 
  audienceState,
  className = ""
}: AudienceGridProps) => {
  // Calculate expressions for each character
  const characterExpressions = useMemo(() => {
    return DEFAULT_CHARACTERS.map(character => ({
      character,
      expression: getCharacterExpression(character, audienceState)
    }));
  }, [audienceState]);

  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      style={{ minHeight: '320px' }}
    >
      {/* Environment background */}
      <EnvironmentBackground environment={environment} />
      
      {/* Avatar grid - positioned naturally in scene */}
      <div className="relative z-10 h-full flex flex-col justify-center items-center pt-20 pb-12 px-4">
        {/* Row 1 */}
        <div className="flex justify-center items-end gap-4 mb-2">
          {characterExpressions.slice(0, 2).map(({ character, expression }, index) => (
            <motion.div
              key={character.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <AvatarCharacter 
                character={character} 
                expression={expression}
                size="md"
              />
            </motion.div>
          ))}
        </div>
        
        {/* Row 2 */}
        <div className="flex justify-center items-end gap-4">
          {characterExpressions.slice(2, 4).map(({ character, expression }, index) => (
            <motion.div
              key={character.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (index + 2) * 0.1 }}
            >
              <AvatarCharacter 
                character={character} 
                expression={expression}
                size="md"
              />
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Mood indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
        <MoodIndicator mood={audienceState.overallMood} />
      </div>
    </motion.div>
  );
};

// Mood indicator component
const MoodIndicator = ({ mood }: { mood: 'positive' | 'neutral' | 'negative' }) => {
  const moodConfig = {
    positive: { emoji: '👏', label: 'Great job!', bgClass: 'bg-primary/80' },
    neutral: { emoji: '👀', label: 'Listening...', bgClass: 'bg-secondary/80' },
    negative: { emoji: '😬', label: 'Keep going!', bgClass: 'bg-accent/80' },
  };
  
  const config = moodConfig[mood];
  
  return (
    <motion.div
      className={`px-3 py-1 rounded-full ${config.bgClass} text-primary-foreground text-xs font-medium flex items-center gap-1.5 shadow-lg backdrop-blur-sm`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      key={mood}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </motion.div>
  );
};
