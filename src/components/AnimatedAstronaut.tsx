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
    <group ref={groupRef}>
      {/* Body */}
      <Sphere args={[0.8, 32, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#f0f0f0" />
      </Sphere>

      {/* Helmet/Head */}
      <Sphere args={[0.5, 32, 32]} position={[0, 1.2, 0]}>
        <meshStandardMaterial color="#ffffff" transparent opacity={0.9} />
      </Sphere>

      {/* Visor */}
      <Sphere args={[0.48, 32, 32]} position={[0, 1.2, 0.15]}>
        <meshStandardMaterial color="#1a1a2e" transparent opacity={0.8} />
      </Sphere>

      {/* Backpack */}
      <Box args={[0.6, 0.7, 0.3]} position={[0, 0.2, -0.6]}>
        <meshStandardMaterial color="#e0e0e0" />
      </Box>

      {/* Left Arm */}
      <group ref={leftArmRef} position={[-0.7, 0.3, 0]}>
        <Cylinder args={[0.15, 0.15, 0.9, 16]} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#f0f0f0" />
        </Cylinder>
        <Sphere args={[0.18, 16, 16]} position={[-0.5, 0, 0]}>
          <meshStandardMaterial color="#d0d0d0" />
        </Sphere>
      </group>

      {/* Right Arm */}
      <group ref={rightArmRef} position={[0.7, 0.3, 0]}>
        <Cylinder args={[0.15, 0.15, 0.9, 16]} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#f0f0f0" />
        </Cylinder>
        <Sphere args={[0.18, 16, 16]} position={[0.5, 0, 0]}>
          <meshStandardMaterial color="#d0d0d0" />
        </Sphere>
      </group>

      {/* Left Leg */}
      <group ref={leftLegRef} position={[-0.3, -0.8, 0]}>
        <Cylinder args={[0.18, 0.18, 0.8, 16]}>
          <meshStandardMaterial color="#f0f0f0" />
        </Cylinder>
        <Sphere args={[0.22, 16, 16]} position={[0, -0.5, 0.1]}>
          <meshStandardMaterial color="#d0d0d0" />
        </Sphere>
      </group>

      {/* Right Leg */}
      <group ref={rightLegRef} position={[0.3, -0.8, 0]}>
        <Cylinder args={[0.18, 0.18, 0.8, 16]}>
          <meshStandardMaterial color="#f0f0f0" />
        </Cylinder>
        <Sphere args={[0.22, 16, 16]} position={[0, -0.5, 0.1]}>
          <meshStandardMaterial color="#d0d0d0" />
        </Sphere>
      </group>

      {/* Belt detail */}
      <Torus args={[0.82, 0.08, 16, 32]} position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#4a90e2" />
      </Torus>

      {/* Chest emblem */}
      <Sphere args={[0.15, 16, 16]} position={[0, 0.3, 0.75]}>
        <meshStandardMaterial color="#4a90e2" />
      </Sphere>
    </group>
  );
};
