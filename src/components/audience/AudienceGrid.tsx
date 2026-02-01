import { motion } from "framer-motion";
import { AvatarCharacter } from "./AvatarCharacter";
import { 
  DEFAULT_CHARACTERS, 
  ENVIRONMENT_THEMES,
  type Character, 
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
  character: Character, 
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
  const theme = ENVIRONMENT_THEMES.find(t => t.id === environment) || ENVIRONMENT_THEMES[5];
  
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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Environment background */}
      <div className={`absolute inset-0 ${theme.ambientClass} ${theme.backgroundColor}`} />
      
      {/* Environment-specific decorations */}
      <EnvironmentDecorations environment={environment} />
      
      {/* Avatar grid - 2x2 FaceTime style */}
      <div className="relative z-10 grid grid-cols-2 gap-3 p-4">
        {characterExpressions.map(({ character, expression }) => (
          <motion.div
            key={character.id}
            className="flex items-center justify-center p-2 rounded-xl bg-background/30 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: character.position * 0.1 }}
          >
            <AvatarCharacter 
              character={character} 
              expression={expression}
              size="md"
            />
          </motion.div>
        ))}
      </div>
      
      {/* Mood indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
        <MoodIndicator mood={audienceState.overallMood} />
      </div>
    </motion.div>
  );
};

// Environment-specific visual decorations
const EnvironmentDecorations = ({ environment }: { environment: Environment }) => {
  switch (environment) {
    case 'office_meeting':
      return (
        <div className="absolute inset-0 pointer-events-none">
          {/* Whiteboard hint */}
          <div className="absolute top-2 right-2 w-16 h-10 bg-white/20 rounded border border-white/30" />
          {/* Coffee cup emoji */}
          <span className="absolute bottom-3 right-3 text-lg opacity-50">☕</span>
        </div>
      );
    case 'school_presentation':
      return (
        <div className="absolute inset-0 pointer-events-none">
          {/* Chalkboard hint */}
          <div className="absolute top-2 left-2 right-2 h-6 bg-muted/40 rounded" />
          <span className="absolute top-3 left-4 text-xs opacity-50">📚</span>
        </div>
      );
    case 'conference':
      return (
        <div className="absolute inset-0 pointer-events-none">
          {/* Stage lights */}
          <div className="absolute top-0 left-1/4 w-8 h-2 bg-accent/30 rounded-full blur-sm" />
          <div className="absolute top-0 right-1/4 w-8 h-2 bg-accent/30 rounded-full blur-sm" />
          <span className="absolute top-2 right-3 text-sm opacity-50">🎤</span>
        </div>
      );
    case 'wedding':
      return (
        <div className="absolute inset-0 pointer-events-none">
          {/* Flowers/decoration */}
          <span className="absolute top-2 left-3 text-lg opacity-40">💐</span>
          <span className="absolute top-2 right-3 text-lg opacity-40">💒</span>
        </div>
      );
    case 'interview':
      return (
        <div className="absolute inset-0 pointer-events-none">
          {/* Clipboard hint */}
          <span className="absolute bottom-3 left-3 text-lg opacity-50">📋</span>
        </div>
      );
    default:
      return null;
  }
};

// Mood indicator component
const MoodIndicator = ({ mood }: { mood: 'positive' | 'neutral' | 'negative' }) => {
  const moodConfig = {
    positive: { emoji: '👏', label: 'Great job!', color: 'bg-primary/80' },
    neutral: { emoji: '👀', label: 'Listening...', color: 'bg-secondary/80' },
    negative: { emoji: '😬', label: 'Keep going!', color: 'bg-accent/80' },
  };
  
  const config = moodConfig[mood];
  
  return (
    <motion.div
      className={`px-3 py-1 rounded-full ${config.color} text-primary-foreground text-xs font-medium flex items-center gap-1.5`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      key={mood}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </motion.div>
  );
};
