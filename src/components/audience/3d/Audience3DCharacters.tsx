import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Cylinder, Sphere, Box } from "@react-three/drei";
import * as THREE from "three";
import { DEFAULT_CHARACTERS, type AudienceState, type Expression } from "../types";

interface Audience3DCharactersProps {
  audienceState: AudienceState;
}

// Character positions in a semi-circle facing the camera
const CHARACTER_POSITIONS: [number, number, number][] = [
  [-1.2, 0, 1],    // Sarah - left
  [-0.4, 0, 0.8],  // Marcus - left-center
  [0.4, 0, 0.8],   // Yuki - right-center
  [1.2, 0, 1],     // David - right
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
        <Character3D
          key={character.id}
          character={character}
          expression={expression}
          position={position}
        />
      ))}
    </group>
  );
};

interface Character3DProps {
  character: typeof DEFAULT_CHARACTERS[0];
  expression: Expression;
  position: [number, number, number];
}

const Character3D = ({ character, expression, position }: Character3DProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  
  // Clothing colors based on character
  const clothingColor = useMemo(() => {
    const colors: Record<string, string> = {
      sarah: '#4F46E5',
      marcus: '#0F766E',
      yuki: '#DB2777',
      david: '#1D4ED8',
    };
    return colors[character.id] || '#4F46E5';
  }, [character.id]);

  // Animation based on expression
  useFrame((state) => {
    if (!headRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    // Base idle animation
    headRef.current.rotation.y = Math.sin(time * 0.5) * 0.05;
    
    // Expression-specific animations
    switch (expression) {
      case 'listening':
        headRef.current.rotation.x = Math.sin(time * 0.8) * 0.03;
        headRef.current.position.y = 1.55 + Math.sin(time * 1.2) * 0.02;
        break;
      case 'impressed':
        headRef.current.rotation.x = -0.1;
        headRef.current.position.y = 1.6;
        break;
      case 'confused':
        headRef.current.rotation.z = Math.sin(time * 2) * 0.1;
        headRef.current.rotation.x = 0.05;
        break;
      case 'celebrating':
        headRef.current.position.y = 1.55 + Math.sin(time * 8) * 0.05;
        headRef.current.rotation.z = Math.sin(time * 6) * 0.08;
        break;
      case 'bored':
        headRef.current.rotation.x = 0.15;
        headRef.current.position.y = 1.5;
        break;
      case 'skeptical':
        headRef.current.rotation.z = -0.08;
        headRef.current.rotation.y = -0.1;
        break;
      default:
        headRef.current.position.y = 1.55;
        headRef.current.rotation.x = 0;
        headRef.current.rotation.z = 0;
    }
    
    // Blink animation
    if (leftEyeRef.current && rightEyeRef.current) {
      const blinkCycle = Math.sin(time * 0.5 + character.position) > 0.95;
      const eyeScale = blinkCycle ? 0.1 : 1;
      leftEyeRef.current.scale.y = eyeScale;
      rightEyeRef.current.scale.y = eyeScale;
    }
  });

  // Eye scale based on expression
  const eyeScaleY = useMemo(() => {
    switch (expression) {
      case 'impressed': return 1.3;
      case 'bored': return 0.5;
      case 'celebrating': return 0.7;
      case 'confused': return 0.9;
      default: return 1;
    }
  }, [expression]);

  return (
    <group ref={groupRef} position={position}>
      {/* Body - torso */}
      <group position={[0, 0.7, 0]}>
        {/* Torso */}
        <Cylinder args={[0.2, 0.25, 0.6, 16]} position={[0, 0.3, 0]}>
          <meshStandardMaterial color={clothingColor} roughness={0.7} />
        </Cylinder>
        
        {/* Shoulders */}
        <Cylinder args={[0.08, 0.08, 0.5, 8]} rotation={[0, 0, Math.PI / 2]} position={[0, 0.55, 0]}>
          <meshStandardMaterial color={clothingColor} roughness={0.7} />
        </Cylinder>
        
        {/* Neck */}
        <Cylinder args={[0.08, 0.1, 0.15, 12]} position={[0, 0.7, 0]}>
          <meshStandardMaterial color={character.skinTone} roughness={0.8} />
        </Cylinder>
      </group>
      
      {/* Head group for animations */}
      <group ref={headRef} position={[0, 1.55, 0]}>
        {/* Head */}
        <Sphere args={[0.2, 24, 24]}>
          <meshStandardMaterial color={character.skinTone} roughness={0.8} />
        </Sphere>
        
        {/* Hair */}
        <Hair style={character.hairStyle} color={character.hairColor} />
        
        {/* Face */}
        <group position={[0, 0, 0.15]}>
          {/* Eyes */}
          <group position={[0, 0.03, 0]}>
            {/* Left eye white */}
            <Sphere args={[0.035, 12, 12]} position={[-0.06, 0, 0.05]}>
              <meshStandardMaterial color="#FFFFFF" />
            </Sphere>
            {/* Left pupil */}
            <Sphere 
              ref={leftEyeRef}
              args={[0.02, 12, 12]} 
              position={[-0.06, 0, 0.08]}
              scale={[1, eyeScaleY, 1]}
            >
              <meshStandardMaterial color="#2C1810" />
            </Sphere>
            
            {/* Right eye white */}
            <Sphere args={[0.035, 12, 12]} position={[0.06, 0, 0.05]}>
              <meshStandardMaterial color="#FFFFFF" />
            </Sphere>
            {/* Right pupil */}
            <Sphere 
              ref={rightEyeRef}
              args={[0.02, 12, 12]} 
              position={[0.06, 0, 0.08]}
              scale={[1, eyeScaleY, 1]}
            >
              <meshStandardMaterial color="#2C1810" />
            </Sphere>
          </group>
          
          {/* Eyebrows */}
          <Eyebrows expression={expression} />
          
          {/* Nose */}
          <Cylinder args={[0.015, 0.02, 0.04, 8]} position={[0, -0.02, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color={character.skinTone} roughness={0.9} />
          </Cylinder>
          
          {/* Mouth */}
          <Mouth expression={expression} />
        </group>
        
        {/* Ears */}
        <Sphere args={[0.04, 8, 8]} position={[-0.2, 0, 0]} scale={[0.5, 1, 0.7]}>
          <meshStandardMaterial color={character.skinTone} roughness={0.8} />
        </Sphere>
        <Sphere args={[0.04, 8, 8]} position={[0.2, 0, 0]} scale={[0.5, 1, 0.7]}>
          <meshStandardMaterial color={character.skinTone} roughness={0.8} />
        </Sphere>
        
        {/* Accessories */}
        {character.accessories === 'glasses' && <Glasses />}
        {character.accessories === 'earrings' && <Earrings />}
      </group>
      
      {/* Chair */}
      <Chair />
    </group>
  );
};

// Hair component
const Hair = ({ style, color }: { style: string; color: string }) => {
  switch (style) {
    case 'short':
      return (
        <group position={[0, 0.1, 0]}>
          <Sphere args={[0.21, 16, 16]} scale={[1, 0.6, 1]}>
            <meshStandardMaterial color={color} roughness={0.9} />
          </Sphere>
        </group>
      );
    case 'long':
      return (
        <group>
          <Sphere args={[0.22, 16, 16]} position={[0, 0.08, -0.02]} scale={[1, 0.7, 1]}>
            <meshStandardMaterial color={color} roughness={0.9} />
          </Sphere>
          {/* Hair strands going down */}
          <Cylinder args={[0.18, 0.12, 0.4, 12]} position={[0, -0.15, -0.08]}>
            <meshStandardMaterial color={color} roughness={0.9} />
          </Cylinder>
        </group>
      );
    case 'curly':
      return (
        <group position={[0, 0.1, 0]}>
          <Sphere args={[0.24, 16, 16]} scale={[1, 0.7, 1]}>
            <meshStandardMaterial color={color} roughness={1} />
          </Sphere>
          {/* Curly volume */}
          {[-0.12, 0, 0.12].map((x, i) => (
            <Sphere key={i} args={[0.06, 8, 8]} position={[x, 0.05, 0.1]}>
              <meshStandardMaterial color={color} roughness={1} />
            </Sphere>
          ))}
        </group>
      );
    case 'ponytail':
      return (
        <group>
          <Sphere args={[0.21, 16, 16]} position={[0, 0.1, 0]} scale={[1, 0.6, 1]}>
            <meshStandardMaterial color={color} roughness={0.9} />
          </Sphere>
          {/* Ponytail */}
          <Cylinder args={[0.04, 0.06, 0.25, 8]} position={[0, 0, -0.22]} rotation={[0.5, 0, 0]}>
            <meshStandardMaterial color={color} roughness={0.9} />
          </Cylinder>
          {/* Hair tie */}
          <Cylinder args={[0.05, 0.05, 0.03, 8]} position={[0, 0.05, -0.2]} rotation={[0.3, 0, 0]}>
            <meshStandardMaterial color="#E11D48" />
          </Cylinder>
        </group>
      );
    case 'bald':
    default:
      return null;
  }
};

// Eyebrows component
const Eyebrows = ({ expression }: { expression: Expression }) => {
  const rotation = useMemo(() => {
    switch (expression) {
      case 'confused': return { left: 0.3, right: -0.3 };
      case 'skeptical': return { left: -0.2, right: 0.2 };
      case 'impressed': return { left: 0, right: 0 };
      default: return { left: 0, right: 0 };
    }
  }, [expression]);

  const yOffset = expression === 'impressed' ? 0.09 : 0.07;

  return (
    <group position={[0, yOffset, 0.06]}>
      <Box 
        args={[0.04, 0.008, 0.01]} 
        position={[-0.06, 0, 0]}
        rotation={[0, 0, rotation.left]}
      >
        <meshStandardMaterial color="#3D2914" />
      </Box>
      <Box 
        args={[0.04, 0.008, 0.01]} 
        position={[0.06, 0, 0]}
        rotation={[0, 0, rotation.right]}
      >
        <meshStandardMaterial color="#3D2914" />
      </Box>
    </group>
  );
};

// Mouth component
const Mouth = ({ expression }: { expression: Expression }) => {
  const mouthProps = useMemo(() => {
    switch (expression) {
      case 'impressed':
      case 'celebrating':
        return { scaleX: 1.2, scaleY: 0.8, color: '#C9756B', open: true };
      case 'confused':
        return { scaleX: 0.7, scaleY: 0.5, color: '#C9756B', open: false };
      case 'bored':
        return { scaleX: 0.8, scaleY: 0.3, color: '#B8968D', open: false };
      case 'skeptical':
        return { scaleX: 0.9, scaleY: 0.4, color: '#B8968D', open: false };
      default:
        return { scaleX: 1, scaleY: 0.4, color: '#C9756B', open: false };
    }
  }, [expression]);

  return (
    <group position={[0, -0.06, 0.08]}>
      {mouthProps.open ? (
        <Sphere args={[0.025, 12, 12]} scale={[mouthProps.scaleX, mouthProps.scaleY, 0.5]}>
          <meshStandardMaterial color={mouthProps.color} />
        </Sphere>
      ) : (
        <Box args={[0.04 * mouthProps.scaleX, 0.008, 0.005]}>
          <meshStandardMaterial color={mouthProps.color} />
        </Box>
      )}
    </group>
  );
};

// Glasses accessory
const Glasses = () => (
  <group position={[0, 0.03, 0.12]}>
    {/* Left lens frame */}
    <Cylinder args={[0.045, 0.045, 0.01, 16]} rotation={[Math.PI / 2, 0, 0]} position={[-0.06, 0, 0]}>
      <meshStandardMaterial color="#1F2937" metalness={0.5} />
    </Cylinder>
    {/* Right lens frame */}
    <Cylinder args={[0.045, 0.045, 0.01, 16]} rotation={[Math.PI / 2, 0, 0]} position={[0.06, 0, 0]}>
      <meshStandardMaterial color="#1F2937" metalness={0.5} />
    </Cylinder>
    {/* Bridge */}
    <Box args={[0.03, 0.005, 0.005]} position={[0, 0, 0]}>
      <meshStandardMaterial color="#1F2937" metalness={0.5} />
    </Box>
    {/* Temples */}
    <Box args={[0.08, 0.005, 0.005]} position={[-0.14, 0, -0.04]} rotation={[0, 0.3, 0]}>
      <meshStandardMaterial color="#1F2937" metalness={0.5} />
    </Box>
    <Box args={[0.08, 0.005, 0.005]} position={[0.14, 0, -0.04]} rotation={[0, -0.3, 0]}>
      <meshStandardMaterial color="#1F2937" metalness={0.5} />
    </Box>
  </group>
);

// Earrings accessory
const Earrings = () => (
  <>
    <Sphere args={[0.015, 8, 8]} position={[-0.2, -0.05, 0]}>
      <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
    </Sphere>
    <Sphere args={[0.015, 8, 8]} position={[0.2, -0.05, 0]}>
      <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
    </Sphere>
  </>
);

// Chair component
const Chair = () => (
  <group position={[0, 0, -0.15]}>
    {/* Seat */}
    <Box args={[0.35, 0.05, 0.35]} position={[0, 0.45, 0]}>
      <meshStandardMaterial color="#2F2F2F" roughness={0.7} />
    </Box>
    {/* Back rest */}
    <Box args={[0.35, 0.4, 0.05]} position={[0, 0.7, -0.15]}>
      <meshStandardMaterial color="#2F2F2F" roughness={0.7} />
    </Box>
    {/* Legs */}
    {[[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].map((pos, i) => (
      <Cylinder key={i} args={[0.02, 0.02, 0.45, 8]} position={[pos[0], 0.225, pos[1]]}>
        <meshStandardMaterial color="#1F1F1F" metalness={0.5} />
      </Cylinder>
    ))}
  </group>
);
