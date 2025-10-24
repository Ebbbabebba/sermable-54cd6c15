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
    <group ref={groupRef} scale={0.6}>
      {/* Body - Rounded beige suit */}
      <Sphere args={[1.1, 32, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#e8dcc8" roughness={0.8} metalness={0.05} />
      </Sphere>

      {/* Helmet - Beige rounded */}
      <Sphere args={[0.85, 32, 32]} position={[0, 1.5, 0]}>
        <meshStandardMaterial 
          color="#e8dcc8" 
          roughness={0.8} 
          metalness={0.05}
        />
      </Sphere>

      {/* Helmet visor - Large dark visor */}
      <Sphere args={[0.75, 32, 32]} position={[0, 1.5, 0.3]} scale={[1.1, 1, 0.6]}>
        <meshStandardMaterial 
          color="#2a2a2a" 
          roughness={0.2} 
          metalness={0.7}
        />
      </Sphere>

      {/* Helmet ring/collar */}
      <Torus args={[0.88, 0.08, 16, 32]} position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#c9b89a" roughness={0.7} />
      </Torus>

      {/* Left Arm - Rounded beige */}
      <group ref={leftArmRef} position={[-0.95, 0.4, 0]}>
        {/* Upper arm */}
        <Sphere args={[0.25, 16, 16]} position={[0, 0, 0]} scale={[1, 1.5, 1]}>
          <meshStandardMaterial color="#e8dcc8" roughness={0.8} />
        </Sphere>
        {/* Forearm */}
        <Sphere args={[0.22, 16, 16]} position={[-0.35, 0, 0]} scale={[1, 1.3, 1]}>
          <meshStandardMaterial color="#c9b89a" roughness={0.8} />
        </Sphere>
        {/* Hand - rounded glove */}
        <Sphere args={[0.2, 16, 16]} position={[-0.6, 0, 0]} scale={[0.8, 1, 1]}>
          <meshStandardMaterial color="#c9b89a" roughness={0.9} />
        </Sphere>
      </group>

      {/* Right Arm - Rounded beige */}
      <group ref={rightArmRef} position={[0.95, 0.4, 0]}>
        {/* Upper arm */}
        <Sphere args={[0.25, 16, 16]} position={[0, 0, 0]} scale={[1, 1.5, 1]}>
          <meshStandardMaterial color="#e8dcc8" roughness={0.8} />
        </Sphere>
        {/* Forearm */}
        <Sphere args={[0.22, 16, 16]} position={[0.35, 0, 0]} scale={[1, 1.3, 1]}>
          <meshStandardMaterial color="#c9b89a" roughness={0.8} />
        </Sphere>
        {/* Hand - rounded glove */}
        <Sphere args={[0.2, 16, 16]} position={[0.6, 0, 0]} scale={[0.8, 1, 1]}>
          <meshStandardMaterial color="#c9b89a" roughness={0.9} />
        </Sphere>
      </group>

      {/* Left Leg - Rounded beige */}
      <group ref={leftLegRef} position={[-0.35, -0.9, 0]}>
        {/* Thigh */}
        <Sphere args={[0.28, 16, 16]} position={[0, -0.1, 0]} scale={[1, 1.4, 1]}>
          <meshStandardMaterial color="#e8dcc8" roughness={0.8} />
        </Sphere>
        {/* Shin */}
        <Sphere args={[0.25, 16, 16]} position={[0, -0.5, 0]} scale={[1, 1.2, 1]}>
          <meshStandardMaterial color="#c9b89a" roughness={0.8} />
        </Sphere>
        {/* Boot - rounded */}
        <Sphere args={[0.28, 16, 16]} position={[0, -0.85, 0.08]} scale={[0.9, 0.7, 1.3]}>
          <meshStandardMaterial color="#c9b89a" roughness={0.9} />
        </Sphere>
      </group>

      {/* Right Leg - Rounded beige */}
      <group ref={rightLegRef} position={[0.35, -0.9, 0]}>
        {/* Thigh */}
        <Sphere args={[0.28, 16, 16]} position={[0, -0.1, 0]} scale={[1, 1.4, 1]}>
          <meshStandardMaterial color="#e8dcc8" roughness={0.8} />
        </Sphere>
        {/* Shin */}
        <Sphere args={[0.25, 16, 16]} position={[0, -0.5, 0]} scale={[1, 1.2, 1]}>
          <meshStandardMaterial color="#c9b89a" roughness={0.8} />
        </Sphere>
        {/* Boot - rounded */}
        <Sphere args={[0.28, 16, 16]} position={[0, -0.85, 0.08]} scale={[0.9, 0.7, 1.3]}>
          <meshStandardMaterial color="#c9b89a" roughness={0.9} />
        </Sphere>
      </group>

      {/* Chest panel background */}
      <Box args={[0.55, 0.5, 0.1]} position={[0, 0.15, 1.08]}>
        <meshStandardMaterial color="#e8dcc8" roughness={0.6} />
      </Box>

      {/* "sermable" text above buttons */}
      <Text
        position={[0, 0.32, 1.14]}
        fontSize={0.1}
        color="#000000"
        anchorX="center"
        anchorY="middle"
      >
        sermable
      </Text>

      {/* Control panel buttons - three colored circles */}
      {/* Left button - beige/tan */}
      <Box args={[0.12, 0.12, 0.05]} position={[-0.15, 0.05, 1.13]}>
        <meshStandardMaterial color="#c9b89a" roughness={0.5} />
      </Box>
      
      {/* Center button - orange/red */}
      <Sphere args={[0.07, 16, 16]} position={[0, 0.05, 1.15]}>
        <meshStandardMaterial color="#d66b4a" roughness={0.5} />
      </Sphere>
      
      {/* Right button - blue */}
      <Sphere args={[0.07, 16, 16]} position={[0.15, 0.05, 1.15]}>
        <meshStandardMaterial color="#7ba7c4" roughness={0.5} />
      </Sphere>

      {/* Waist ring */}
      <Torus args={[1.12, 0.1, 16, 32]} position={[0, -0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#c9b89a" roughness={0.7} />
      </Torus>
    </group>
  );
};
