import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import type { Character, Expression, Personality } from "./types";

interface AvatarCharacterProps {
  character: Character;
  expression: Expression;
  size?: 'sm' | 'md' | 'lg';
}

// Eye animations for different expressions
const eyeVariants = {
  neutral: { scaleY: 1, y: 0 },
  listening: { scaleY: 1, y: 0 },
  impressed: { scaleY: 1.2, y: -1 },
  confused: { scaleY: 0.8, y: 0 },
  celebrating: { scaleY: 0.6, y: 0 },
  bored: { scaleY: 0.5, y: 2 },
  skeptical: { scaleY: 0.7, y: 0 },
};

// Eyebrow animations
const eyebrowVariants = {
  neutral: { y: 0, rotate: 0 },
  listening: { y: -1, rotate: 0 },
  impressed: { y: -3, rotate: 0 },
  confused: { y: 0, rotate: 15 },
  celebrating: { y: -2, rotate: 0 },
  bored: { y: 3, rotate: 0 },
  skeptical: { y: -1, rotate: -10 },
};

// Mouth shapes
const mouthPaths = {
  neutral: "M 35 55 Q 50 55 65 55",
  listening: "M 35 55 Q 50 58 65 55",
  impressed: "M 35 52 Q 50 62 65 52",
  confused: "M 35 58 Q 50 52 65 58",
  celebrating: "M 30 50 Q 50 70 70 50",
  bored: "M 40 58 Q 50 55 60 58",
  skeptical: "M 35 55 Q 45 58 65 52",
};

// Head bob animation based on expression
const headVariants = {
  neutral: { 
    y: 0, 
    rotate: 0,
    transition: { duration: 0.5 }
  },
  listening: { 
    y: [0, -2, 0],
    rotate: [0, 2, -2, 0],
    transition: { 
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
  },
  impressed: { 
    y: -3,
    rotate: 0,
    transition: { duration: 0.3, type: "spring" as const }
  },
  confused: { 
    y: 0,
    rotate: [0, -5, 5, 0],
    transition: { duration: 0.5 }
  },
  celebrating: { 
    y: [0, -5, 0],
    rotate: [0, 3, -3, 0],
    transition: { 
      duration: 0.4,
      repeat: 3,
      ease: "easeInOut" as const
    }
  },
  bored: { 
    y: 3,
    rotate: -3,
    transition: { duration: 1.5 }
  },
  skeptical: { 
    y: 0,
    rotate: -5,
    transition: { duration: 0.5 }
  },
};

// Blinking animation
const blinkAnimation = {
  animate: {
    scaleY: [1, 0.1, 1],
    transition: {
      duration: 0.15,
      repeat: Infinity,
      repeatDelay: 3 + Math.random() * 2,
    }
  }
};

export const AvatarCharacter = ({ 
  character, 
  expression,
  size = 'md' 
}: AvatarCharacterProps) => {
  const sizeMap = {
    sm: 80,
    md: 120,
    lg: 160,
  };
  
  const dimensions = sizeMap[size];
  
  // Generate hair based on style
  const hairPath = useMemo(() => {
    switch (character.hairStyle) {
      case 'short':
        return "M 20 35 Q 20 15 50 15 Q 80 15 80 35 L 75 40 Q 50 30 25 40 Z";
      case 'long':
        return "M 15 35 Q 15 10 50 10 Q 85 10 85 35 L 90 80 Q 80 85 70 80 L 75 45 Q 50 35 25 45 L 30 80 Q 20 85 10 80 Z";
      case 'curly':
        return "M 18 40 Q 10 35 15 25 Q 18 15 30 12 Q 40 8 50 10 Q 60 8 70 12 Q 82 15 85 25 Q 90 35 82 40 Q 88 30 78 25 Q 70 15 50 18 Q 30 15 22 25 Q 12 30 18 40 Z";
      case 'ponytail':
        return "M 20 35 Q 20 15 50 15 Q 80 15 80 35 L 75 40 Q 50 30 25 40 Z M 75 25 Q 95 20 95 45 Q 95 60 85 55 Q 90 40 80 30 Z";
      case 'bald':
        return "";
      default:
        return "M 20 35 Q 20 15 50 15 Q 80 15 80 35 L 75 40 Q 50 30 25 40 Z";
    }
  }, [character.hairStyle]);

  // Accessory rendering
  const renderAccessories = () => {
    switch (character.accessories) {
      case 'glasses':
        return (
          <g className="glasses">
            <circle cx="35" cy="42" r="10" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2" />
            <circle cx="65" cy="42" r="10" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2" />
            <path d="M 45 42 L 55 42" stroke="hsl(var(--foreground))" strokeWidth="2" />
            <path d="M 25 40 L 15 38" stroke="hsl(var(--foreground))" strokeWidth="2" />
            <path d="M 75 40 L 85 38" stroke="hsl(var(--foreground))" strokeWidth="2" />
          </g>
        );
      case 'beard':
        return (
          <path 
            d="M 30 55 Q 30 75 50 78 Q 70 75 70 55" 
            fill={character.hairColor}
            opacity={0.8}
          />
        );
      case 'earrings':
        return (
          <>
            <circle cx="18" cy="50" r="3" fill="#FFD700" />
            <circle cx="82" cy="50" r="3" fill="#FFD700" />
          </>
        );
      case 'bowtie':
        return (
          <g transform="translate(35, 85)">
            <path d="M 0 5 L 10 0 L 10 10 Z M 20 5 L 30 0 L 30 10 Z" fill="#DC2626" />
            <circle cx="15" cy="5" r="4" fill="#DC2626" />
          </g>
        );
      case 'headphones':
        return (
          <g>
            <path d="M 15 35 Q 15 10 50 10 Q 85 10 85 35" fill="none" stroke="#1A1A1A" strokeWidth="4" />
            <ellipse cx="15" cy="45" rx="8" ry="12" fill="#1A1A1A" />
            <ellipse cx="85" cy="45" rx="8" ry="12" fill="#1A1A1A" />
          </g>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="relative"
      style={{ width: dimensions, height: dimensions }}
      variants={headVariants}
      animate={expression}
    >
      <svg
        viewBox="0 0 100 100"
        width={dimensions}
        height={dimensions}
        className="drop-shadow-lg"
      >
        {/* Face base */}
        <motion.ellipse
          cx="50"
          cy="50"
          rx="35"
          ry="40"
          fill={character.skinTone}
          initial={{ scale: 1 }}
          animate={{ scale: expression === 'celebrating' ? [1, 1.02, 1] : 1 }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Hair */}
        {hairPath && (
          <path d={hairPath} fill={character.hairColor} />
        )}
        
        {/* Ears */}
        <ellipse cx="15" cy="50" rx="5" ry="8" fill={character.skinTone} />
        <ellipse cx="85" cy="50" rx="5" ry="8" fill={character.skinTone} />
        
        {/* Eyebrows */}
        <motion.g
          variants={eyebrowVariants}
          animate={expression}
        >
          <motion.path
            d="M 28 32 Q 35 30 42 32"
            stroke={character.hairColor}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            style={{ transformOrigin: '35px 31px' }}
            animate={{ rotate: expression === 'skeptical' ? 10 : expression === 'confused' ? 15 : 0 }}
          />
          <motion.path
            d="M 58 32 Q 65 30 72 32"
            stroke={character.hairColor}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            style={{ transformOrigin: '65px 31px' }}
            animate={{ rotate: expression === 'skeptical' ? -10 : expression === 'confused' ? -15 : 0 }}
          />
        </motion.g>
        
        {/* Eyes */}
        <motion.g
          variants={eyeVariants}
          animate={expression}
          {...blinkAnimation}
        >
          {/* Left eye */}
          <ellipse cx="35" cy="42" rx="6" ry="7" fill="white" />
          <motion.circle 
            cx="35" 
            cy="43" 
            r="4" 
            fill="#2C1810"
            animate={{
              cx: expression === 'skeptical' ? 33 : expression === 'confused' ? 37 : 35
            }}
          />
          <circle cx="33" cy="41" r="1.5" fill="white" />
          
          {/* Right eye */}
          <ellipse cx="65" cy="42" rx="6" ry="7" fill="white" />
          <motion.circle 
            cx="65" 
            cy="43" 
            r="4" 
            fill="#2C1810"
            animate={{
              cx: expression === 'skeptical' ? 63 : expression === 'confused' ? 67 : 65
            }}
          />
          <circle cx="63" cy="41" r="1.5" fill="white" />
        </motion.g>
        
        {/* Nose */}
        <path 
          d="M 50 45 Q 52 52 50 55 Q 48 52 50 45" 
          fill={character.skinTone}
          stroke={`${character.skinTone}99`}
          strokeWidth="1"
        />
        
        {/* Mouth */}
        <motion.path
          d={mouthPaths[expression]}
          stroke="#C9756B"
          strokeWidth="3"
          fill={expression === 'celebrating' || expression === 'impressed' ? "#FF9999" : "none"}
          strokeLinecap="round"
          initial={false}
          animate={{ d: mouthPaths[expression] }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
        
        {/* Blush for positive expressions */}
        <AnimatePresence>
          {(expression === 'impressed' || expression === 'celebrating') && (
            <>
              <motion.ellipse
                cx="25"
                cy="52"
                rx="8"
                ry="4"
                fill="#FFAAAA"
                opacity={0.5}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
              />
              <motion.ellipse
                cx="75"
                cy="52"
                rx="8"
                ry="4"
                fill="#FFAAAA"
                opacity={0.5}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
              />
            </>
          )}
        </AnimatePresence>
        
        {/* Accessories */}
        {renderAccessories()}
        
        {/* Confusion marks */}
        <AnimatePresence>
          {expression === 'confused' && (
            <motion.text
              x="78"
              y="25"
              fontSize="16"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
            >
              ?
            </motion.text>
          )}
        </AnimatePresence>
        
        {/* Celebration sparkles */}
        <AnimatePresence>
          {expression === 'celebrating' && (
            <>
              <motion.text
                x="10"
                y="20"
                fontSize="12"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: [0, 1, 0], y: [10, 0, -10] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                ✨
              </motion.text>
              <motion.text
                x="80"
                y="15"
                fontSize="10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: [0, 1, 0], y: [10, 0, -10] }}
                transition={{ duration: 1, delay: 0.3, repeat: Infinity }}
              >
                ⭐
              </motion.text>
            </>
          )}
        </AnimatePresence>
        
        {/* Sleep Z's for bored */}
        <AnimatePresence>
          {expression === 'bored' && (
            <motion.text
              x="75"
              y="30"
              fontSize="14"
              fill="hsl(var(--muted-foreground))"
              initial={{ opacity: 0, x: 0 }}
              animate={{ 
                opacity: [0, 0.7, 0], 
                x: [0, 5, 10],
                y: [30, 25, 20]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              z
            </motion.text>
          )}
        </AnimatePresence>
      </svg>
      
      {/* Name tag */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xs text-muted-foreground font-medium">
        {character.name}
      </div>
    </motion.div>
  );
};
