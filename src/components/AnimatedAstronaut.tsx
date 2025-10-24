import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Box, Cylinder, Torus, Text } from '@react-three/drei';
import * as THREE from 'three';

export const AnimatedAstronaut = () => {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Main floating animation - slower and more graceful
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.4) * 0.4;
      groupRef.current.rotation.y = Math.sin(t * 0.25) * 0.1;
      groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.05;
    }

    // Arm movements - subtle
    if (leftArmRef.current) {
      leftArmRef.current.rotation.z = Math.sin(t * 0.6) * 0.15 + 0.3;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.z = Math.sin(t * 0.6 + Math.PI) * 0.15 - 0.3;
    }

    // Leg movements - gentle
    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = Math.sin(t * 0.5) * 0.1;
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = Math.sin(t * 0.5 + Math.PI) * 0.1;
    }
  });

  return (
    <group ref={groupRef} scale={0.5}>
      {/* Body - Realistic white spacesuit */}
      <Sphere args={[1, 32, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#e8e8e8" roughness={0.6} metalness={0.1} />
      </Sphere>

      {/* Helmet - Clear with reflection */}
      <Sphere args={[0.7, 32, 32]} position={[0, 1.4, 0]}>
        <meshStandardMaterial 
          color="#f5f5f5" 
          roughness={0.4} 
          metalness={0.2}
        />
      </Sphere>

      {/* Helmet visor - Dark reflective */}
      <Sphere args={[0.65, 32, 32]} position={[0, 1.4, 0.25]} scale={[1, 0.9, 0.5]}>
        <meshStandardMaterial 
          color="#1a1a1a" 
          roughness={0.1} 
          metalness={0.9}
          transparent
          opacity={0.9}
        />
      </Sphere>

      {/* Backpack - White/gray */}
      <Box args={[0.8, 0.9, 0.4]} position={[0, 0.2, -0.7]}>
        <meshStandardMaterial color="#d0d0d0" roughness={0.6} metalness={0.1} />
      </Box>

      {/* Backpack details */}
      <Box args={[0.15, 0.7, 0.1]} position={[-0.25, 0.2, -0.95]}>
        <meshStandardMaterial color="#a0a0a0" roughness={0.5} />
      </Box>
      <Box args={[0.15, 0.7, 0.1]} position={[0.25, 0.2, -0.95]}>
        <meshStandardMaterial color="#a0a0a0" roughness={0.5} />
      </Box>

      {/* Left Arm - White suit */}
      <group ref={leftArmRef} position={[-0.85, 0.3, 0]}>
        <Cylinder args={[0.15, 0.15, 0.7, 16]} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#e8e8e8" roughness={0.6} />
        </Cylinder>
        {/* Orange stripes */}
        <Cylinder args={[0.16, 0.16, 0.1, 16]} rotation={[0, 0, Math.PI / 2]} position={[-0.15, 0, 0]}>
          <meshStandardMaterial color="#ff6b35" roughness={0.5} />
        </Cylinder>
        {/* Glove */}
        <Sphere args={[0.18, 16, 16]} position={[-0.4, 0, 0]}>
          <meshStandardMaterial color="#f0f0f0" roughness={0.7} />
        </Sphere>
      </group>

      {/* Right Arm - White suit */}
      <group ref={rightArmRef} position={[0.85, 0.3, 0]}>
        <Cylinder args={[0.15, 0.15, 0.7, 16]} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#e8e8e8" roughness={0.6} />
        </Cylinder>
        {/* Orange stripes */}
        <Cylinder args={[0.16, 0.16, 0.1, 16]} rotation={[0, 0, Math.PI / 2]} position={[0.15, 0, 0]}>
          <meshStandardMaterial color="#ff6b35" roughness={0.5} />
        </Cylinder>
        {/* Glove */}
        <Sphere args={[0.18, 16, 16]} position={[0.4, 0, 0]}>
          <meshStandardMaterial color="#f0f0f0" roughness={0.7} />
        </Sphere>
      </group>

      {/* Left Leg - White suit */}
      <group ref={leftLegRef} position={[-0.35, -0.9, 0]}>
        <Cylinder args={[0.18, 0.18, 0.7, 16]}>
          <meshStandardMaterial color="#e8e8e8" roughness={0.6} />
        </Cylinder>
        {/* Orange stripe */}
        <Cylinder args={[0.19, 0.19, 0.1, 16]} position={[0, -0.2, 0]}>
          <meshStandardMaterial color="#ff6b35" roughness={0.5} />
        </Cylinder>
        {/* Boot */}
        <Box args={[0.25, 0.15, 0.35]} position={[0, -0.45, 0.1]}>
          <meshStandardMaterial color="#f5f5f5" roughness={0.7} />
        </Box>
      </group>

      {/* Right Leg - White suit */}
      <group ref={rightLegRef} position={[0.35, -0.9, 0]}>
        <Cylinder args={[0.18, 0.18, 0.7, 16]}>
          <meshStandardMaterial color="#e8e8e8" roughness={0.6} />
        </Cylinder>
        {/* Orange stripe */}
        <Cylinder args={[0.19, 0.19, 0.1, 16]} position={[0, -0.2, 0]}>
          <meshStandardMaterial color="#ff6b35" roughness={0.5} />
        </Cylinder>
        {/* Boot */}
        <Box args={[0.25, 0.15, 0.35]} position={[0, -0.45, 0.1]}>
          <meshStandardMaterial color="#f5f5f5" roughness={0.7} />
        </Box>
      </group>

      {/* Belt/waist detail */}
      <Torus args={[1.02, 0.08, 16, 32]} position={[0, -0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#c0c0c0" roughness={0.5} metalness={0.3} />
      </Torus>

      {/* Chest badge background - White patch */}
      <Box args={[0.5, 0.3, 0.05]} position={[0, 0.4, 0.98]}>
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </Box>

      {/* "sermable" text on chest badge */}
      <Text
        position={[0, 0.4, 1.02]}
        fontSize={0.12}
        color="#000000"
        anchorX="center"
        anchorY="middle"
      >
        sermable
      </Text>

      {/* Control panel on chest */}
      <Box args={[0.35, 0.25, 0.08]} position={[0, -0.05, 0.98]}>
        <meshStandardMaterial color="#b0b0b0" roughness={0.4} metalness={0.4} />
      </Box>
      
      {/* Small LED lights on control panel */}
      <Sphere args={[0.03, 16, 16]} position={[-0.1, -0.05, 1.05]}>
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.8} />
      </Sphere>
      <Sphere args={[0.03, 16, 16]} position={[0, -0.05, 1.05]}>
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.8} />
      </Sphere>
      <Sphere args={[0.03, 16, 16]} position={[0.1, -0.05, 1.05]}>
        <meshStandardMaterial color="#0000ff" emissive="#0000ff" emissiveIntensity={0.8} />
      </Sphere>
    </group>
  );
};
