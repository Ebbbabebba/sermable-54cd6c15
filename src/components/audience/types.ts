// Character and environment types for the animated audience system

export type Expression = 'neutral' | 'listening' | 'impressed' | 'confused' | 'celebrating' | 'bored' | 'skeptical';

export type Personality = 'enthusiastic' | 'analytical' | 'skeptical' | 'supportive' | 'distracted';

export type Environment = 'office_meeting' | 'school_presentation' | 'conference' | 'wedding' | 'interview' | 'general';

export interface Character {
  id: string;
  name: string;
  personality: Personality;
  // Appearance
  skinTone: string;
  hairColor: string;
  hairStyle: 'short' | 'long' | 'bald' | 'curly' | 'ponytail';
  gender: 'male' | 'female' | 'neutral';
  accessories?: 'glasses' | 'earrings' | 'beard' | 'bowtie' | 'headphones';
  // Reaction thresholds - when they react
  impressedThreshold: number; // accuracy % to show impressed
  confusedThreshold: number; // hesitation seconds to show confused
  boredThreshold: number; // monotone duration to show bored
  // Position in grid
  position: number;
}

export interface AudienceState {
  overallMood: 'positive' | 'neutral' | 'negative';
  recentAccuracy: number; // Rolling 10-word accuracy
  hesitationCount: number;
  monotoneScore: number; // 0-100, higher = more monotone
  energyLevel: number; // 0-100, from voice analysis
}

export interface EnvironmentTheme {
  id: Environment;
  name: string;
  backgroundColor: string;
  ambientClass: string;
  description: string;
}

// Default characters with diverse appearances and personalities
export const DEFAULT_CHARACTERS: Character[] = [
  {
    id: 'sarah',
    name: 'Sarah',
    personality: 'enthusiastic',
    skinTone: '#E8BEAC',
    hairColor: '#2C1810',
    hairStyle: 'long',
    gender: 'female',
    accessories: 'earrings',
    impressedThreshold: 70,
    confusedThreshold: 3,
    boredThreshold: 60,
    position: 0,
  },
  {
    id: 'marcus',
    name: 'Marcus',
    personality: 'analytical',
    skinTone: '#8D5524',
    hairColor: '#1A1A1A',
    hairStyle: 'short',
    gender: 'male',
    accessories: 'glasses',
    impressedThreshold: 85,
    confusedThreshold: 2,
    boredThreshold: 40,
    position: 1,
  },
  {
    id: 'yuki',
    name: 'Yuki',
    personality: 'supportive',
    skinTone: '#F5DEB3',
    hairColor: '#1A1A1A',
    hairStyle: 'ponytail',
    gender: 'female',
    impressedThreshold: 60,
    confusedThreshold: 4,
    boredThreshold: 70,
    position: 2,
  },
  {
    id: 'david',
    name: 'David',
    personality: 'skeptical',
    skinTone: '#FFDFC4',
    hairColor: '#8B4513',
    hairStyle: 'curly',
    gender: 'male',
    accessories: 'beard',
    impressedThreshold: 90,
    confusedThreshold: 1.5,
    boredThreshold: 30,
    position: 3,
  },
];

export const ENVIRONMENT_THEMES: EnvironmentTheme[] = [
  {
    id: 'office_meeting',
    name: 'Office Meeting',
    backgroundColor: 'from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900',
    ambientClass: 'bg-gradient-to-b',
    description: 'Morning meeting with colleagues',
  },
  {
    id: 'school_presentation',
    name: 'Classroom',
    backgroundColor: 'from-amber-50 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30',
    ambientClass: 'bg-gradient-to-b',
    description: 'School or university presentation',
  },
  {
    id: 'conference',
    name: 'Conference Hall',
    backgroundColor: 'from-blue-900 to-indigo-950',
    ambientClass: 'bg-gradient-to-b',
    description: 'Professional conference stage',
  },
  {
    id: 'wedding',
    name: 'Wedding',
    backgroundColor: 'from-rose-50 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30',
    ambientClass: 'bg-gradient-to-b',
    description: 'Wedding speech or toast',
  },
  {
    id: 'interview',
    name: 'Interview',
    backgroundColor: 'from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900',
    ambientClass: 'bg-gradient-to-b',
    description: 'Job interview or panel discussion',
  },
  {
    id: 'general',
    name: 'General',
    backgroundColor: 'from-background to-muted',
    ambientClass: 'bg-gradient-to-b',
    description: 'General purpose presentation',
  },
];

export const SPEECH_TYPES = [
  { value: 'office_meeting', label: 'Office Meeting', icon: '💼' },
  { value: 'school_presentation', label: 'School/University', icon: '🎓' },
  { value: 'conference', label: 'Conference', icon: '🎤' },
  { value: 'wedding', label: 'Wedding/Celebration', icon: '💒' },
  { value: 'interview', label: 'Interview', icon: '🤝' },
  { value: 'general', label: 'General', icon: '📝' },
];
