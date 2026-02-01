import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Sphere, Cylinder, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { DEFAULT_CHARACTERS, type AudienceState, type Expression } from "../types";

interface Audience3DCharactersProps {
  audienceState: AudienceState;
}

// Character positions - arranged like sitting at a table facing you
const CHARACTER_POSITIONS: [number, number, number][] = [
  [-1.3, 0, 0.6],   // Sarah - left
  [-0.45, 0, 0.3],  // Marcus - left-center  
  [0.45, 0, 0.3],   // Yuki - right-center
  [1.3, 0, 0.6],    // David - right
];

// Determine expression based on character personality and audience state
const getCharacterExpression = (
  character: typeof DEFAULT_CHARACTERS[0], 
  state: AudienceState
): Expression => {
  const { recentAccuracy, hesitationCount, monotoneScore, energyLevel } = state;
  
  if (recentAccuracy >= 95 && energyLevel >= 70) return 'celebrating';
  
  switch (character.personality) {
    case 'enthusiastic':
      if (recentAccuracy >= character.impressedThreshold) return 'impressed';
      if (monotoneScore > character.boredThreshold && energyLevel < 30) return 'bored';
      if (hesitationCount >= character.confusedThreshold) return 'confused';
      return energyLevel > 50 ? 'listening' : 'neutral';
    case 'analytical':
      if (hesitationCount >= character.confusedThreshold) return 'confused';
      if (recentAccuracy >= character.impressedThreshold) return 'impressed';
      if (monotoneScore > character.boredThreshold) return 'skeptical';
      return 'listening';
    case 'skeptical':
      if (recentAccuracy < 70) return 'skeptical';
      if (hesitationCount >= character.confusedThreshold) return 'confused';
      if (recentAccuracy >= character.impressedThreshold) return 'impressed';
      if (monotoneScore > character.boredThreshold) return 'bored';
      return 'neutral';
    case 'supportive':
      if (recentAccuracy >= character.impressedThreshold - 10) return 'impressed';
      if (hesitationCount >= character.confusedThreshold + 1) return 'confused';
      return 'listening';
    case 'distracted':
      if (energyLevel > 80) return 'impressed';
      if (monotoneScore > 40) return 'bored';
      return 'neutral';
    default:
      return 'neutral';
  }
};

export const Audience3DCharacters = ({ audienceState }: Audience3DCharactersProps) => {
  const characterExpressions = useMemo(() => {
    return DEFAULT_CHARACTERS.map((character, index) => ({
      character,
      expression: getCharacterExpression(character, audienceState),
      position: CHARACTER_POSITIONS[index] || [0, 0, 1] as [number, number, number]
    }));
  }, [audienceState]);

  return (
    <group>
      {characterExpressions.map(({ character, expression, position }) => (
        <DuolingoCharacter
          key={character.id}
          character={character}
          expression={expression}
          position={position}
        />
      ))}
    </group>
  );
};

interface DuolingoCharacterProps {
  character: typeof DEFAULT_CHARACTERS[0];
  expression: Expression;
  position: [number, number, number];
}

// Duolingo-inspired character with smooth, bouncy animations
const DuolingoCharacter = ({ character, expression, position }: DuolingoCharacterProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  
  // Track expression changes for bounce animation
  const [prevExpression, setPrevExpression] = useState(expression);
  const [bounceTime, setBounceTime] = useState(0);
  
  useEffect(() => {
    if (prevExpression !== expression) {
      setBounceTime(0);
      setPrevExpression(expression);
    }
  }, [expression, prevExpression]);
  
  // Vibrant Duolingo-style colors
  const colors = useMemo(() => {
    const palettes: Record<string, { body: string; accent: string; skin: string }> = {
      sarah: { body: '#58CC02', accent: '#89E219', skin: '#FFD9B3' },    // Duo green
      marcus: { body: '#1CB0F6', accent: '#49D0FF', skin: '#C68642' },   // Duo blue  
      yuki: { body: '#FF4B4B', accent: '#FF6B6B', skin: '#FFE0BD' },     // Duo red
      david: { body: '#CE82FF', accent: '#E5A8FF', skin: '#FFDFC4' },    // Duo purple
    };
    return palettes[character.id] || palettes.sarah;
  }, [character.id]);

  // Smooth spring-like animations
  useFrame((state, delta) => {
    if (!headRef.current || !bodyRef.current) return;
    
    const time = state.clock.elapsedTime;
    bounceTime < 1 && setBounceTime(prev => Math.min(prev + delta * 2, 1));
    
    // Bouncy spring factor for expression changes
    const spring = Math.sin(bounceTime * Math.PI) * (1 - bounceTime) * 0.5;
    
    // Idle breathing animation - subtle and smooth
    const breathe = Math.sin(time * 1.5) * 0.015;
    bodyRef.current.scale.y = 1 + breathe;
    bodyRef.current.position.y = 0.55 + breathe * 0.5;
    
    // Head idle sway - very gentle
    headRef.current.rotation.y = Math.sin(time * 0.7 + character.position) * 0.03;
    headRef.current.rotation.z = Math.sin(time * 0.5) * 0.02;
    
    // Expression-specific animations with Duolingo-style bounce
    switch (expression) {
      case 'listening':
        // Gentle nodding
        headRef.current.rotation.x = Math.sin(time * 1.2) * 0.06;
        headRef.current.position.y = 1.3 + spring * 0.1;
        break;
        
      case 'impressed':
        // Excited bounce up
        headRef.current.position.y = 1.35 + spring * 0.15 + Math.sin(time * 3) * 0.02;
        headRef.current.rotation.x = -0.1;
        bodyRef.current.scale.y = 1.05 + spring * 0.1;
        // Arms up slightly
        if (leftArmRef.current) leftArmRef.current.rotation.z = -0.3 - spring * 0.2;
        if (rightArmRef.current) rightArmRef.current.rotation.z = 0.3 + spring * 0.2;
        break;
        
      case 'confused':
        // Head tilt with bounce
        headRef.current.rotation.z = 0.15 + Math.sin(time * 2) * 0.05;
        headRef.current.position.y = 1.28 + spring * 0.05;
        break;
        
      case 'celebrating':
        // Happy bouncing with arms waving
        const celebrateBounce = Math.sin(time * 8) * 0.08;
        headRef.current.position.y = 1.35 + celebrateBounce;
        bodyRef.current.scale.y = 1 + Math.abs(celebrateBounce) * 0.5;
        headRef.current.rotation.z = Math.sin(time * 6) * 0.1;
        // Wave arms
        if (leftArmRef.current) {
          leftArmRef.current.rotation.z = -0.5 + Math.sin(time * 10) * 0.4;
          leftArmRef.current.rotation.x = Math.sin(time * 8) * 0.2;
        }
        if (rightArmRef.current) {
          rightArmRef.current.rotation.z = 0.5 - Math.sin(time * 10 + 0.5) * 0.4;
          rightArmRef.current.rotation.x = Math.sin(time * 8 + 0.5) * 0.2;
        }
        break;
        
      case 'bored':
        // Droopy, slow movement
        headRef.current.rotation.x = 0.15;
        headRef.current.position.y = 1.25;
        bodyRef.current.scale.y = 0.98;
        // Arms hanging
        if (leftArmRef.current) leftArmRef.current.rotation.z = -0.1;
        if (rightArmRef.current) rightArmRef.current.rotation.z = 0.1;
        break;
        
      case 'skeptical':
        // Slight lean back, one eyebrow up effect via rotation
        headRef.current.rotation.z = -0.08;
        headRef.current.rotation.y = -0.1;
        headRef.current.position.y = 1.3 + spring * 0.03;
        break;
        
      default: // neutral
        headRef.current.position.y = 1.3;
        headRef.current.rotation.x = 0;
        if (leftArmRef.current) leftArmRef.current.rotation.z = -0.15;
        if (rightArmRef.current) rightArmRef.current.rotation.z = 0.15;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Body - pill/capsule shape like Duolingo characters */}
      <group ref={bodyRef} position={[0, 0.55, 0]}>
        {/* Main body - rounded capsule */}
        <Sphere args={[0.22, 32, 32]} scale={[1, 1.3, 0.9]}>
          <meshToonMaterial color={colors.body} />
        </Sphere>
        
        {/* Body highlight for 3D pop */}
        <Sphere args={[0.18, 16, 16]} position={[-0.05, 0.05, 0.1]} scale={[0.4, 0.5, 0.3]}>
          <meshToonMaterial color={colors.accent} transparent opacity={0.6} />
        </Sphere>
      </group>
      
      {/* Arms */}
      <group ref={leftArmRef} position={[-0.25, 0.6, 0]}>
        <Sphere args={[0.08, 16, 16]} scale={[1, 1.8, 1]} position={[0, -0.08, 0]}>
          <meshToonMaterial color={colors.body} />
        </Sphere>
        {/* Hand */}
        <Sphere args={[0.06, 12, 12]} position={[0, -0.2, 0]}>
          <meshToonMaterial color={colors.skin} />
        </Sphere>
      </group>
      
      <group ref={rightArmRef} position={[0.25, 0.6, 0]}>
        <Sphere args={[0.08, 16, 16]} scale={[1, 1.8, 1]} position={[0, -0.08, 0]}>
          <meshToonMaterial color={colors.body} />
        </Sphere>
        {/* Hand */}
        <Sphere args={[0.06, 12, 12]} position={[0, -0.2, 0]}>
          <meshToonMaterial color={colors.skin} />
        </Sphere>
      </group>
      
      {/* Head */}
      <group ref={headRef} position={[0, 1.3, 0]}>
        {/* Main head - perfectly round like Duolingo */}
        <Sphere args={[0.28, 32, 32]}>
          <meshToonMaterial color={colors.skin} />
        </Sphere>
        
        {/* Cheek blush */}
        <Sphere args={[0.06, 12, 12]} position={[-0.15, -0.05, 0.2]}>
          <meshToonMaterial color="#FFB3B3" transparent opacity={0.5} />
        </Sphere>
        <Sphere args={[0.06, 12, 12]} position={[0.15, -0.05, 0.2]}>
          <meshToonMaterial color="#FFB3B3" transparent opacity={0.5} />
        </Sphere>
        
        {/* Face features */}
        <DuolingoFace expression={expression} />
        
        {/* Hair */}
        <DuolingoHair style={character.hairStyle} color={character.hairColor} />
        
        {/* Accessories */}
        {character.accessories === 'glasses' && <DuolingoGlasses />}
      </group>
      
      {/* Simple chair/seat */}
      <Cylinder args={[0.25, 0.3, 0.15, 16]} position={[0, 0.08, 0]}>
        <meshToonMaterial color="#4A4A4A" />
      </Cylinder>
    </group>
  );
};

// Duolingo-style face with big expressive eyes
const DuolingoFace = ({ expression }: { expression: Expression }) => {
  const leftEyeRef = useRef<THREE.Group>(null);
  const rightEyeRef = useRef<THREE.Group>(null);
  
  // Eye and mouth states based on expression
  const faceState = useMemo(() => {
    switch (expression) {
      case 'impressed':
        return { eyeScale: 1.3, eyeY: 0.05, pupilY: 0.02, mouthType: 'open-smile' };
      case 'celebrating':
        return { eyeScale: 0.8, eyeY: 0.05, pupilY: 0, mouthType: 'big-smile' };
      case 'confused':
        return { eyeScale: 1.1, eyeY: 0.03, pupilY: 0.02, mouthType: 'worried' };
      case 'bored':
        return { eyeScale: 0.6, eyeY: 0.02, pupilY: 0.03, mouthType: 'flat' };
      case 'skeptical':
        return { eyeScale: 0.85, eyeY: 0.03, pupilY: 0, mouthType: 'smirk' };
      case 'listening':
        return { eyeScale: 1.1, eyeY: 0.04, pupilY: 0, mouthType: 'small-smile' };
      default:
        return { eyeScale: 1, eyeY: 0.04, pupilY: 0, mouthType: 'neutral' };
    }
  }, [expression]);

  // Blink animation
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const blink = Math.sin(time * 0.4) > 0.97;
    const blinkScale = blink ? 0.1 : 1;
    
    if (leftEyeRef.current) leftEyeRef.current.scale.y = blinkScale * faceState.eyeScale;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = blinkScale * faceState.eyeScale;
  });

  return (
    <group position={[0, 0, 0.2]}>
      {/* Eyes - big and round like Duolingo */}
      <group ref={leftEyeRef} position={[-0.09, faceState.eyeY, 0.08]} scale={[1, faceState.eyeScale, 1]}>
        {/* Eye white */}
        <Sphere args={[0.06, 16, 16]}>
          <meshToonMaterial color="#FFFFFF" />
        </Sphere>
        {/* Pupil */}
        <Sphere args={[0.035, 12, 12]} position={[0, faceState.pupilY, 0.03]}>
          <meshToonMaterial color="#1A1A1A" />
        </Sphere>
        {/* Eye shine */}
        <Sphere args={[0.015, 8, 8]} position={[-0.015, 0.02, 0.05]}>
          <meshToonMaterial color="#FFFFFF" />
        </Sphere>
      </group>
      
      <group ref={rightEyeRef} position={[0.09, faceState.eyeY, 0.08]} scale={[1, faceState.eyeScale, 1]}>
        <Sphere args={[0.06, 16, 16]}>
          <meshToonMaterial color="#FFFFFF" />
        </Sphere>
        <Sphere args={[0.035, 12, 12]} position={[0, faceState.pupilY, 0.03]}>
          <meshToonMaterial color="#1A1A1A" />
        </Sphere>
        <Sphere args={[0.015, 8, 8]} position={[-0.015, 0.02, 0.05]}>
          <meshToonMaterial color="#FFFFFF" />
        </Sphere>
      </group>
      
      {/* Eyebrows for expressions */}
      {(expression === 'confused' || expression === 'skeptical') && (
        <DuolingoEyebrows expression={expression} />
      )}
      
      {/* Mouth */}
      <DuolingoMouth type={faceState.mouthType} />
    </group>
  );
};

// Simple stylized eyebrows
const DuolingoEyebrows = ({ expression }: { expression: Expression }) => {
  const leftRotation = expression === 'confused' ? 0.3 : -0.2;
  const rightRotation = expression === 'confused' ? -0.3 : 0.1;
  
  return (
    <group position={[0, 0.12, 0.1]}>
      <Cylinder 
        args={[0.01, 0.01, 0.05, 8]} 
        rotation={[0, 0, leftRotation]}
        position={[-0.09, 0, 0]}
      >
        <meshToonMaterial color="#3D2914" />
      </Cylinder>
      <Cylinder 
        args={[0.01, 0.01, 0.05, 8]} 
        rotation={[0, 0, rightRotation]}
        position={[0.09, 0, 0]}
      >
        <meshToonMaterial color="#3D2914" />
      </Cylinder>
    </group>
  );
};

// Duolingo-style mouth - simple shapes
const DuolingoMouth = ({ type }: { type: string }) => {
  switch (type) {
    case 'big-smile':
      return (
        <group position={[0, -0.1, 0.12]}>
          {/* Wide open smile */}
          <Sphere args={[0.06, 16, 8]} scale={[1.5, 0.8, 0.5]}>
            <meshToonMaterial color="#FF6B6B" />
          </Sphere>
          {/* Teeth hint */}
          <Sphere args={[0.04, 12, 6]} scale={[1.3, 0.4, 0.3]} position={[0, 0.02, 0.01]}>
            <meshToonMaterial color="#FFFFFF" />
          </Sphere>
        </group>
      );
    case 'open-smile':
      return (
        <group position={[0, -0.1, 0.12]}>
          <Sphere args={[0.04, 16, 8]} scale={[1.2, 0.7, 0.4]}>
            <meshToonMaterial color="#FF6B6B" />
          </Sphere>
        </group>
      );
    case 'small-smile':
      return (
        <Cylinder 
          args={[0.03, 0.03, 0.005, 16, 1, false, 0, Math.PI]} 
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, -0.1, 0.15]}
        >
          <meshToonMaterial color="#E85A5A" />
        </Cylinder>
      );
    case 'worried':
      return (
        <Sphere args={[0.025, 12, 12]} scale={[1.5, 0.8, 0.5]} position={[0, -0.11, 0.13]}>
          <meshToonMaterial color="#E85A5A" />
        </Sphere>
      );
    case 'flat':
      return (
        <Cylinder 
          args={[0.003, 0.003, 0.04, 8]} 
          rotation={[0, 0, Math.PI / 2]}
          position={[0, -0.1, 0.15]}
        >
          <meshToonMaterial color="#CC6666" />
        </Cylinder>
      );
    case 'smirk':
      return (
        <group position={[0.02, -0.1, 0.14]}>
          <Cylinder 
            args={[0.025, 0.025, 0.004, 16, 1, false, 0, Math.PI]} 
            rotation={[Math.PI / 2, 0, 0.2]}
          >
            <meshToonMaterial color="#E85A5A" />
          </Cylinder>
        </group>
      );
    default: // neutral
      return (
        <Cylinder 
          args={[0.02, 0.02, 0.004, 16, 1, false, 0, Math.PI]} 
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, -0.1, 0.14]}
        >
          <meshToonMaterial color="#E85A5A" />
        </Cylinder>
      );
  }
};

// Simplified hair styles
const DuolingoHair = ({ style, color }: { style: string; color: string }) => {
  switch (style) {
    case 'short':
      return (
        <Sphere args={[0.29, 24, 16]} position={[0, 0.08, -0.02]} scale={[1, 0.5, 1]}>
          <meshToonMaterial color={color} />
        </Sphere>
      );
    case 'long':
      return (
        <group>
          <Sphere args={[0.3, 24, 16]} position={[0, 0.06, -0.04]} scale={[1, 0.55, 1]}>
            <meshToonMaterial color={color} />
          </Sphere>
          {/* Hair going down */}
          <Cylinder args={[0.2, 0.15, 0.35, 16]} position={[0, -0.15, -0.08]}>
            <meshToonMaterial color={color} />
          </Cylinder>
        </group>
      );
    case 'curly':
      return (
        <group>
          <Sphere args={[0.32, 16, 16]} position={[0, 0.05, 0]} scale={[1, 0.6, 1]}>
            <meshToonMaterial color={color} />
          </Sphere>
          {/* Curly puffs */}
          <Sphere args={[0.08, 12, 12]} position={[-0.2, 0.1, 0.05]}>
            <meshToonMaterial color={color} />
          </Sphere>
          <Sphere args={[0.08, 12, 12]} position={[0.2, 0.1, 0.05]}>
            <meshToonMaterial color={color} />
          </Sphere>
          <Sphere args={[0.07, 12, 12]} position={[0, 0.18, 0]}>
            <meshToonMaterial color={color} />
          </Sphere>
        </group>
      );
    case 'ponytail':
      return (
        <group>
          <Sphere args={[0.29, 24, 16]} position={[0, 0.08, -0.02]} scale={[1, 0.5, 1]}>
            <meshToonMaterial color={color} />
          </Sphere>
          {/* Ponytail */}
          <Sphere args={[0.08, 12, 12]} position={[0, 0, -0.28]} scale={[0.8, 1.5, 0.8]}>
            <meshToonMaterial color={color} />
          </Sphere>
          {/* Hair tie */}
          <Cylinder args={[0.04, 0.04, 0.03, 12]} position={[0, 0.05, -0.25]} rotation={[0.3, 0, 0]}>
            <meshToonMaterial color="#FF4B4B" />
          </Cylinder>
        </group>
      );
    case 'bald':
    default:
      return null;
  }
};

// Simple round glasses
const DuolingoGlasses = () => (
  <group position={[0, 0.04, 0.22]}>
    {/* Left lens */}
    <Cylinder args={[0.065, 0.065, 0.015, 16]} rotation={[Math.PI / 2, 0, 0]} position={[-0.09, 0, 0]}>
      <meshToonMaterial color="#2D3748" />
    </Cylinder>
    <Cylinder args={[0.055, 0.055, 0.02, 16]} rotation={[Math.PI / 2, 0, 0]} position={[-0.09, 0, 0.005]}>
      <meshToonMaterial color="#E2E8F0" transparent opacity={0.3} />
    </Cylinder>
    
    {/* Right lens */}
    <Cylinder args={[0.065, 0.065, 0.015, 16]} rotation={[Math.PI / 2, 0, 0]} position={[0.09, 0, 0]}>
      <meshToonMaterial color="#2D3748" />
    </Cylinder>
    <Cylinder args={[0.055, 0.055, 0.02, 16]} rotation={[Math.PI / 2, 0, 0]} position={[0.09, 0, 0.005]}>
      <meshToonMaterial color="#E2E8F0" transparent opacity={0.3} />
    </Cylinder>
    
    {/* Bridge */}
    <Cylinder args={[0.01, 0.01, 0.04, 8]} rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0.01]}>
      <meshToonMaterial color="#2D3748" />
    </Cylinder>
  </group>
);
