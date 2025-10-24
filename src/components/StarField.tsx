import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const StarField = () => {
  const pointsRef = useRef<THREE.Points>(null);
  
  const [positions, colors, scales] = useMemo(() => {
    const positions = new Float32Array(200 * 3);
    const colors = new Float32Array(200 * 3);
    const scales = new Float32Array(200);
    
    for (let i = 0; i < 200; i++) {
      // Spread stars across the view
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 10;
      
      // Random colors between white and light blue/yellow
      const colorChoice = Math.random();
      if (colorChoice > 0.7) {
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 0.9;
        colors[i * 3 + 2] = 0.6; // Yellowish
      } else if (colorChoice > 0.4) {
        colors[i * 3] = 0.8;
        colors[i * 3 + 1] = 0.9;
        colors[i * 3 + 2] = 1; // Blueish
      } else {
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 1;
        colors[i * 3 + 2] = 1; // White
      }
      
      scales[i] = Math.random() * 0.3 + 0.1;
    }
    
    return [positions, colors, scales];
  }, []);

  useFrame(({ clock }) => {
    if (pointsRef.current) {
      const time = clock.getElapsedTime();
      const colors = pointsRef.current.geometry.attributes.color.array as Float32Array;
      
      for (let i = 0; i < 200; i++) {
        // Pulse effect with different phases for each star
        const phase = i * 0.1;
        const pulse = Math.sin(time * 0.5 + phase) * 0.3 + 0.7;
        
        const baseR = colors[i * 3];
        const baseG = colors[i * 3 + 1];
        const baseB = colors[i * 3 + 2];
        
        colors[i * 3] = baseR * pulse;
        colors[i * 3 + 1] = baseG * pulse;
        colors[i * 3 + 2] = baseB * pulse;
      }
      
      pointsRef.current.geometry.attributes.color.needsUpdate = true;
    }
  });

  return (
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
        size={0.15}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
};
