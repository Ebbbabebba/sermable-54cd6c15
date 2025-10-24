import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const StarField = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const starsRef = useRef<THREE.Group>(null);
  
  const [positions, colors, scales] = useMemo(() => {
    const positions = new Float32Array(500 * 3);
    const colors = new Float32Array(500 * 3);
    const scales = new Float32Array(500);
    
    for (let i = 0; i < 500; i++) {
      // Spread stars across the view with more depth
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 15;
      
      // More varied and vibrant colors
      const colorChoice = Math.random();
      if (colorChoice > 0.85) {
        // Pink/Magenta stars
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 0.4;
        colors[i * 3 + 2] = 0.8;
      } else if (colorChoice > 0.7) {
        // Golden yellow stars
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 0.85;
        colors[i * 3 + 2] = 0.3;
      } else if (colorChoice > 0.55) {
        // Cyan/blue stars
        colors[i * 3] = 0.4;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 1;
      } else if (colorChoice > 0.4) {
        // Purple stars
        colors[i * 3] = 0.7;
        colors[i * 3 + 1] = 0.4;
        colors[i * 3 + 2] = 1;
      } else if (colorChoice > 0.25) {
        // Orange stars
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 0.6;
        colors[i * 3 + 2] = 0.2;
      } else {
        // White stars
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 1;
        colors[i * 3 + 2] = 1;
      }
      
      // More varied sizes
      scales[i] = Math.random() * 0.5 + 0.15;
    }
    
    return [positions, colors, scales];
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    if (pointsRef.current) {
      const colors = pointsRef.current.geometry.attributes.color.array as Float32Array;
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i < 500; i++) {
        // Pulse effect with different phases and speeds for each star
        const phase = i * 0.1;
        const speed = 0.3 + (i % 10) * 0.1; // Varied speeds
        const pulse = Math.sin(time * speed + phase) * 0.4 + 0.6;
        
        // Get original color (stored in a way that preserves base hue)
        const colorIndex = i * 3;
        const baseIntensity = Math.sqrt(
          colors[colorIndex] ** 2 + 
          colors[colorIndex + 1] ** 2 + 
          colors[colorIndex + 2] ** 2
        );
        
        // Apply pulse while maintaining color ratios
        if (baseIntensity > 0) {
          const ratio = pulse / baseIntensity;
          colors[colorIndex] *= ratio;
          colors[colorIndex + 1] *= ratio;
          colors[colorIndex + 2] *= ratio;
        }
        
        // Gentle floating motion
        positions[i * 3 + 1] += Math.sin(time * 0.2 + i) * 0.002;
      }
      
      pointsRef.current.geometry.attributes.color.needsUpdate = true;
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
    
    // Rotate entire star field slowly
    if (starsRef.current) {
      starsRef.current.rotation.y = Math.sin(time * 0.05) * 0.1;
    }
  });

  return (
    <group ref={starsRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-scale"
            count={scales.length}
            array={scales}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.25}
          vertexColors
          transparent
          opacity={0.9}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};
