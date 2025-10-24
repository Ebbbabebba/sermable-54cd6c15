import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Box, Cylinder, Torus } from '@react-three/drei';
import * as THREE from 'three';

export const AnimatedAstronaut = () => {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Main floating animation
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.3;
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.15;
      groupRef.current.rotation.x = Math.sin(t * 0.4) * 0.1;
    }

    // Arm movements
    if (leftArmRef.current) {
      leftArmRef.current.rotation.z = Math.sin(t * 0.8) * 0.2 + 0.3;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.z = Math.sin(t * 0.8 + Math.PI) * 0.2 - 0.3;
    }

    // Leg movements
    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = Math.sin(t * 0.6) * 0.15;
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = Math.sin(t * 0.6 + Math.PI) * 0.15;
    }
  });

  return (
    <group ref={groupRef} scale={0.5}>
      {/* Body - Cute round shape */}
      <Sphere args={[0.9, 32, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#58cc02" roughness={0.3} />
      </Sphere>

      {/* Head - Large and round like Duolingo owl */}
      <Sphere args={[0.65, 32, 32]} position={[0, 1.3, 0]}>
        <meshStandardMaterial color="#58cc02" roughness={0.3} />
      </Sphere>

      {/* Helmet visor - Big cute eyes effect */}
      <group position={[0, 1.35, 0.5]}>
        {/* Left eye */}
        <Sphere args={[0.15, 16, 16]} position={[-0.2, 0.05, 0]}>
          <meshStandardMaterial color="#ffffff" />
        </Sphere>
        <Sphere args={[0.08, 16, 16]} position={[-0.2, 0.05, 0.12]}>
          <meshStandardMaterial color="#1a1a1a" />
        </Sphere>
        
        {/* Right eye */}
        <Sphere args={[0.15, 16, 16]} position={[0.2, 0.05, 0]}>
          <meshStandardMaterial color="#ffffff" />
        </Sphere>
        <Sphere args={[0.08, 16, 16]} position={[0.2, 0.05, 0.12]}>
          <meshStandardMaterial color="#1a1a1a" />
        </Sphere>

        {/* Smile */}
        <Torus args={[0.15, 0.03, 8, 16, Math.PI]} position={[0, -0.15, 0.05]} rotation={[0, 0, 0]}>
          <meshStandardMaterial color="#1a1a1a" />
        </Torus>
      </group>

      {/* Backpack - Fun colors */}
      <Box args={[0.7, 0.8, 0.35]} position={[0, 0.2, -0.65]}>
        <meshStandardMaterial color="#ff6b35" roughness={0.4} />
      </Box>

      {/* Antenna */}
      <Cylinder args={[0.03, 0.03, 0.4, 8]} position={[0, 2.0, 0]}>
        <meshStandardMaterial color="#ffd700" />
      </Cylinder>
      <Sphere args={[0.1, 16, 16]} position={[0, 2.25, 0]}>
        <meshStandardMaterial color="#ff1744" emissive="#ff1744" emissiveIntensity={0.5} />
      </Sphere>

      {/* Left Arm - Shorter and rounder */}
      <group ref={leftArmRef} position={[-0.75, 0.25, 0]}>
        <Cylinder args={[0.12, 0.12, 0.6, 16]} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#4a90e2" />
        </Cylinder>
        <Sphere args={[0.16, 16, 16]} position={[-0.35, 0, 0]}>
          <meshStandardMaterial color="#ffd700" />
        </Sphere>
      </group>

      {/* Right Arm - Shorter and rounder */}
      <group ref={rightArmRef} position={[0.75, 0.25, 0]}>
        <Cylinder args={[0.12, 0.12, 0.6, 16]} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#4a90e2" />
        </Cylinder>
        <Sphere args={[0.16, 16, 16]} position={[0.35, 0, 0]}>
          <meshStandardMaterial color="#ffd700" />
        </Sphere>
      </group>

      {/* Left Leg - Stubby and cute */}
      <group ref={leftLegRef} position={[-0.3, -0.85, 0]}>
        <Cylinder args={[0.16, 0.16, 0.6, 16]}>
          <meshStandardMaterial color="#4a90e2" />
        </Cylinder>
        <Sphere args={[0.2, 16, 16]} position={[0, -0.4, 0.1]}>
          <meshStandardMaterial color="#7b2cbf" />
        </Sphere>
      </group>

      {/* Right Leg - Stubby and cute */}
      <group ref={rightLegRef} position={[0.3, -0.85, 0]}>
        <Cylinder args={[0.16, 0.16, 0.6, 16]}>
          <meshStandardMaterial color="#4a90e2" />
        </Cylinder>
        <Sphere args={[0.2, 16, 16]} position={[0, -0.4, 0.1]}>
          <meshStandardMaterial color="#7b2cbf" />
        </Sphere>
      </group>

      {/* Belt accent */}
      <Torus args={[0.92, 0.06, 16, 32]} position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#ffd700" />
      </Torus>

      {/* Chest emblem - Star shape */}
      <Sphere args={[0.12, 16, 16]} position={[0, 0.35, 0.88]}>
        <meshStandardMaterial color="#ff1744" emissive="#ff1744" emissiveIntensity={0.3} />
      </Sphere>
    </group>
  );
};
