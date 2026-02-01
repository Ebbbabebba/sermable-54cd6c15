import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import type { Character, Expression } from "./types";

interface AvatarCharacterProps {
  character: Character;
  expression: Expression;
  size?: 'sm' | 'md' | 'lg';
}

// Clothing colors for variety
const clothingColors = {
  sarah: { primary: '#4F46E5', secondary: '#6366F1' }, // Indigo
  marcus: { primary: '#0F766E', secondary: '#14B8A6' }, // Teal
  yuki: { primary: '#DB2777', secondary: '#EC4899' }, // Pink
  david: { primary: '#1D4ED8', secondary: '#3B82F6' }, // Blue
};

// More refined eye animations
const eyeVariants = {
  neutral: { scaleY: 1, y: 0 },
  listening: { scaleY: 1.05, y: 0 },
  impressed: { scaleY: 1.15, y: -1 },
  confused: { scaleY: 0.85, y: 0 },
  celebrating: { scaleY: 0.7, y: 0 },
  bored: { scaleY: 0.5, y: 1 },
  skeptical: { scaleY: 0.8, y: 0 },
};

// Subtle head movements
const headVariants = {
  neutral: { 
    y: 0, 
    rotate: 0,
    transition: { duration: 0.6, ease: "easeOut" as const }
  },
  listening: { 
    y: [0, -1, 0],
    rotate: [0, 1, -1, 0],
    transition: { 
      duration: 2.5,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
  },
  impressed: { 
    y: -2,
    rotate: 0,
    transition: { duration: 0.3, type: "spring" as const, stiffness: 200 }
  },
  confused: { 
    y: 0,
    rotate: [0, -3, 3, 0],
    transition: { duration: 0.6 }
  },
  celebrating: { 
    y: [0, -4, 0],
    rotate: [0, 2, -2, 0],
    transition: { 
      duration: 0.5,
      repeat: 2,
      ease: "easeInOut" as const
    }
  },
  bored: { 
    y: 2,
    rotate: -2,
    transition: { duration: 1.5, ease: "easeInOut" as const }
  },
  skeptical: { 
    y: 0,
    rotate: -3,
    transition: { duration: 0.5, ease: "easeOut" as const }
  },
};

// Refined mouth paths with better lip shapes
const mouthPaths = {
  neutral: "M 40 68 Q 50 70 60 68",
  listening: "M 40 68 Q 50 72 60 68",
  impressed: "M 38 66 Q 50 76 62 66",
  confused: "M 42 70 Q 50 66 58 70",
  celebrating: "M 35 64 Q 50 80 65 64",
  bored: "M 44 68 Q 50 66 56 68",
  skeptical: "M 42 68 Q 48 70 58 66",
};

export const AvatarCharacter = ({ 
  character, 
  expression,
  size = 'md' 
}: AvatarCharacterProps) => {
  const sizeMap = {
    sm: 100,
    md: 140,
    lg: 180,
  };
  
  const dimensions = sizeMap[size];
  const colors = clothingColors[character.id as keyof typeof clothingColors] || clothingColors.sarah;
  
  // Generate refined hair based on style
  const hairElements = useMemo(() => {
    switch (character.hairStyle) {
      case 'short':
        return (
          <g className="hair">
            {/* Base hair shape */}
            <path 
              d="M 25 38 Q 22 22 50 18 Q 78 22 75 38 L 72 44 Q 50 36 28 44 Z" 
              fill={character.hairColor}
            />
            {/* Hair highlight */}
            <path 
              d="M 35 24 Q 45 20 55 24" 
              stroke={`${character.hairColor}88`}
              strokeWidth="3"
              fill="none"
              opacity="0.5"
            />
          </g>
        );
      case 'long':
        return (
          <g className="hair">
            {/* Back hair */}
            <path 
              d="M 20 38 Q 15 18 50 14 Q 85 18 80 38 L 85 85 Q 75 90 65 85 L 70 48 Q 50 38 30 48 L 35 85 Q 25 90 15 85 Z" 
              fill={character.hairColor}
            />
            {/* Front framing */}
            <path 
              d="M 22 38 Q 18 20 50 16 Q 82 20 78 38" 
              fill={character.hairColor}
            />
            {/* Highlight */}
            <path 
              d="M 32 25 Q 50 18 68 25" 
              stroke={`${character.hairColor}66`}
              strokeWidth="4"
              fill="none"
              opacity="0.4"
            />
          </g>
        );
      case 'curly':
        return (
          <g className="hair">
            {/* Curly volume */}
            <ellipse cx="30" cy="30" rx="12" ry="10" fill={character.hairColor} />
            <ellipse cx="50" cy="24" rx="14" ry="12" fill={character.hairColor} />
            <ellipse cx="70" cy="30" rx="12" ry="10" fill={character.hairColor} />
            <ellipse cx="25" cy="42" rx="8" ry="8" fill={character.hairColor} />
            <ellipse cx="75" cy="42" rx="8" ry="8" fill={character.hairColor} />
            {/* Curl details */}
            <circle cx="35" cy="28" r="4" fill={`${character.hairColor}99`} />
            <circle cx="55" cy="22" r="5" fill={`${character.hairColor}99`} />
            <circle cx="65" cy="30" r="4" fill={`${character.hairColor}99`} />
          </g>
        );
      case 'ponytail':
        return (
          <g className="hair">
            {/* Top pulled back */}
            <path 
              d="M 25 38 Q 22 22 50 18 Q 78 22 75 38 L 72 44 Q 50 36 28 44 Z" 
              fill={character.hairColor}
            />
            {/* Ponytail */}
            <ellipse cx="78" cy="38" rx="8" ry="6" fill={character.hairColor} />
            <path 
              d="M 78 44 Q 90 50 88 70 Q 85 80 80 75 Q 82 60 76 50" 
              fill={character.hairColor}
            />
            {/* Hair tie */}
            <ellipse cx="78" cy="42" rx="4" ry="3" fill="#E11D48" />
          </g>
        );
      case 'bald':
        return (
          <g className="hair">
            {/* Subtle head shine */}
            <ellipse cx="45" cy="30" rx="12" ry="8" fill="white" opacity="0.15" />
          </g>
        );
      default:
        return null;
    }
  }, [character.hairStyle, character.hairColor]);

  // Accessory rendering
  const renderAccessories = () => {
    switch (character.accessories) {
      case 'glasses':
        return (
          <g className="glasses">
            {/* Left lens */}
            <rect x="28" y="48" width="16" height="12" rx="3" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
            {/* Right lens */}
            <rect x="56" y="48" width="16" height="12" rx="3" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
            {/* Bridge */}
            <path d="M 44 54 L 56 54" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
            {/* Temples */}
            <path d="M 28 52 L 20 50" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
            <path d="M 72 52 L 80 50" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
            {/* Lens reflection */}
            <path d="M 30 50 L 32 52" stroke="white" strokeWidth="1" opacity="0.5" />
            <path d="M 58 50 L 60 52" stroke="white" strokeWidth="1" opacity="0.5" />
          </g>
        );
      case 'beard':
        return (
          <g className="beard">
            <path 
              d="M 34 65 Q 34 82 50 86 Q 66 82 66 65" 
              fill={character.hairColor}
              opacity={0.9}
            />
            {/* Beard texture */}
            <path d="M 40 72 Q 42 75 40 78" stroke={`${character.hairColor}88`} strokeWidth="1" fill="none" />
            <path d="M 50 74 Q 52 77 50 80" stroke={`${character.hairColor}88`} strokeWidth="1" fill="none" />
            <path d="M 60 72 Q 58 75 60 78" stroke={`${character.hairColor}88`} strokeWidth="1" fill="none" />
          </g>
        );
      case 'earrings':
        return (
          <>
            <circle cx="20" cy="55" r="2.5" fill="#FFD700" />
            <circle cx="80" cy="55" r="2.5" fill="#FFD700" />
            {/* Sparkle */}
            <circle cx="19" cy="54" r="0.8" fill="white" opacity="0.8" />
            <circle cx="79" cy="54" r="0.8" fill="white" opacity="0.8" />
          </>
        );
      case 'bowtie':
        return (
          <g transform="translate(38, 94)">
            <path d="M 0 6 L 8 0 L 8 12 Z" fill="#DC2626" />
            <path d="M 16 6 L 24 0 L 24 12 Z" fill="#DC2626" />
            <circle cx="12" cy="6" r="4" fill="#B91C1C" />
            <circle cx="12" cy="5" r="1" fill="white" opacity="0.3" />
          </g>
        );
      case 'headphones':
        return (
          <g>
            <path d="M 18 42 Q 18 18 50 18 Q 82 18 82 42" fill="none" stroke="#1F2937" strokeWidth="4" />
            <ellipse cx="18" cy="50" rx="6" ry="10" fill="#1F2937" />
            <ellipse cx="82" cy="50" rx="6" ry="10" fill="#1F2937" />
            {/* Cushion detail */}
            <ellipse cx="18" cy="50" rx="4" ry="7" fill="#374151" />
            <ellipse cx="82" cy="50" rx="4" ry="7" fill="#374151" />
          </g>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="relative"
      style={{ width: dimensions, height: dimensions + 20 }}
      variants={headVariants}
      animate={expression}
    >
      <svg
        viewBox="0 0 100 120"
        width={dimensions}
        height={dimensions + 20}
        className="drop-shadow-md"
      >
        {/* Definitions for gradients */}
        <defs>
          {/* Skin gradient for depth */}
          <radialGradient id={`skinGradient-${character.id}`} cx="40%" cy="30%" r="60%">
            <stop offset="0%" stopColor={character.skinTone} />
            <stop offset="100%" stopColor={`${character.skinTone}dd`} />
          </radialGradient>
          
          {/* Eye gradient */}
          <radialGradient id={`eyeGradient-${character.id}`} cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#4A3728" />
            <stop offset="100%" stopColor="#2C1810" />
          </radialGradient>
          
          {/* Clothing gradient */}
          <linearGradient id={`clothingGradient-${character.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.secondary} />
            <stop offset="100%" stopColor={colors.primary} />
          </linearGradient>
        </defs>
        
        {/* Neck */}
        <path 
          d="M 40 78 L 40 90 Q 40 95 45 95 L 55 95 Q 60 95 60 90 L 60 78"
          fill={`url(#skinGradient-${character.id})`}
        />
        
        {/* Shoulders/Clothing */}
        <path 
          d="M 20 120 L 20 100 Q 20 92 35 92 L 45 95 L 55 95 L 65 92 Q 80 92 80 100 L 80 120 Z"
          fill={`url(#clothingGradient-${character.id})`}
        />
        {/* Collar detail */}
        <path 
          d="M 42 95 L 50 102 L 58 95"
          fill="none"
          stroke={colors.primary}
          strokeWidth="2"
        />
        {/* Collar shadow */}
        <path 
          d="M 35 95 Q 50 98 65 95"
          fill="none"
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="3"
        />
        
        {/* Head/Face base - more refined shape */}
        <motion.ellipse
          cx="50"
          cy="55"
          rx="30"
          ry="34"
          fill={`url(#skinGradient-${character.id})`}
          initial={{ scale: 1 }}
          animate={{ scale: expression === 'celebrating' ? [1, 1.01, 1] : 1 }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Subtle face shadow */}
        <ellipse 
          cx="50" 
          cy="70" 
          rx="22" 
          ry="10" 
          fill={character.skinTone}
          opacity="0.3"
        />
        
        {/* Hair (behind ears) */}
        {hairElements}
        
        {/* Ears */}
        <ellipse cx="20" cy="55" rx="4" ry="7" fill={character.skinTone} />
        <ellipse cx="80" cy="55" rx="4" ry="7" fill={character.skinTone} />
        {/* Ear inner detail */}
        <ellipse cx="21" cy="55" rx="2" ry="4" fill={`${character.skinTone}bb`} />
        <ellipse cx="79" cy="55" rx="2" ry="4" fill={`${character.skinTone}bb`} />
        
        {/* Eyebrows */}
        <motion.g
          animate={{
            y: expression === 'impressed' ? -2 : expression === 'bored' ? 2 : 0
          }}
          transition={{ duration: 0.3 }}
        >
          <motion.path
            d="M 32 44 Q 38 42 44 44"
            stroke={character.hairColor}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            animate={{ 
              rotate: expression === 'skeptical' ? 8 : expression === 'confused' ? 10 : 0,
              y: expression === 'impressed' ? -2 : 0
            }}
            style={{ transformOrigin: '38px 43px' }}
          />
          <motion.path
            d="M 56 44 Q 62 42 68 44"
            stroke={character.hairColor}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            animate={{ 
              rotate: expression === 'skeptical' ? -8 : expression === 'confused' ? -10 : 0,
              y: expression === 'impressed' ? -2 : 0
            }}
            style={{ transformOrigin: '62px 43px' }}
          />
        </motion.g>
        
        {/* Eyes */}
        <motion.g
          variants={eyeVariants}
          animate={expression}
        >
          {/* Left eye white */}
          <ellipse cx="38" cy="54" rx="7" ry="8" fill="white" />
          {/* Left iris */}
          <motion.circle 
            cx="38" 
            cy="55" 
            r="5" 
            fill={`url(#eyeGradient-${character.id})`}
            animate={{
              cx: expression === 'skeptical' ? 36 : expression === 'confused' ? 40 : 38
            }}
          />
          {/* Left pupil */}
          <motion.circle 
            cx="38" 
            cy="55" 
            r="2.5" 
            fill="#0F0F0F"
            animate={{
              cx: expression === 'skeptical' ? 36 : expression === 'confused' ? 40 : 38,
              r: expression === 'impressed' ? 3 : 2.5
            }}
          />
          {/* Left eye highlight */}
          <circle cx="36" cy="52" r="2" fill="white" />
          <circle cx="40" cy="56" r="1" fill="white" opacity="0.5" />
          
          {/* Right eye white */}
          <ellipse cx="62" cy="54" rx="7" ry="8" fill="white" />
          {/* Right iris */}
          <motion.circle 
            cx="62" 
            cy="55" 
            r="5" 
            fill={`url(#eyeGradient-${character.id})`}
            animate={{
              cx: expression === 'skeptical' ? 60 : expression === 'confused' ? 64 : 62
            }}
          />
          {/* Right pupil */}
          <motion.circle 
            cx="62" 
            cy="55" 
            r="2.5" 
            fill="#0F0F0F"
            animate={{
              cx: expression === 'skeptical' ? 60 : expression === 'confused' ? 64 : 62,
              r: expression === 'impressed' ? 3 : 2.5
            }}
          />
          {/* Right eye highlight */}
          <circle cx="60" cy="52" r="2" fill="white" />
          <circle cx="64" cy="56" r="1" fill="white" opacity="0.5" />
        </motion.g>
        
        {/* Nose - subtle and refined */}
        <path 
          d="M 50 54 Q 52 60 50 64 Q 48 62 47 64 Q 50 66 53 64 Q 52 62 50 64" 
          fill="none"
          stroke={`${character.skinTone}88`}
          strokeWidth="1.5"
        />
        
        {/* Mouth with lip detail */}
        <motion.path
          d={mouthPaths[expression]}
          stroke="#C9756B"
          strokeWidth="2.5"
          fill={expression === 'celebrating' || expression === 'impressed' ? "#FFAFAF" : "none"}
          strokeLinecap="round"
          initial={false}
          animate={{ d: mouthPaths[expression] }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        />
        {/* Upper lip line for non-open mouths */}
        {expression !== 'celebrating' && expression !== 'impressed' && (
          <path
            d="M 44 66 Q 50 65 56 66"
            stroke="#C9756B"
            strokeWidth="1"
            fill="none"
            opacity="0.4"
          />
        )}
        
        {/* Cheek blush for positive expressions */}
        <AnimatePresence>
          {(expression === 'impressed' || expression === 'celebrating') && (
            <>
              <motion.ellipse
                cx="28"
                cy="62"
                rx="6"
                ry="3"
                fill="#FFAAAA"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
              />
              <motion.ellipse
                cx="72"
                cy="62"
                rx="6"
                ry="3"
                fill="#FFAAAA"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
              />
            </>
          )}
        </AnimatePresence>
        
        {/* Accessories */}
        {renderAccessories()}
        
        {/* Expression indicators */}
        <AnimatePresence>
          {expression === 'confused' && (
            <motion.text
              x="78"
              y="30"
              fontSize="14"
              fill="hsl(var(--foreground))"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.7, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
            >
              ?
            </motion.text>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {expression === 'celebrating' && (
            <>
              <motion.text
                x="12"
                y="22"
                fontSize="10"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: [0, 1, 0], y: [5, -5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                ✨
              </motion.text>
              <motion.text
                x="80"
                y="18"
                fontSize="8"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: [0, 1, 0], y: [5, -5] }}
                transition={{ duration: 1.5, delay: 0.4, repeat: Infinity }}
              >
                ⭐
              </motion.text>
            </>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {expression === 'bored' && (
            <motion.text
              x="75"
              y="35"
              fontSize="12"
              fill="hsl(var(--muted-foreground))"
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: [0, 0.6, 0], 
                x: [75, 82],
                y: [35, 28]
              }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              z
            </motion.text>
          )}
        </AnimatePresence>
      </svg>
      
      {/* Name tag */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-medium bg-background/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
        {character.name}
      </div>
    </motion.div>
  );
};
