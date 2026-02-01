import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Box, Plane, Cylinder } from "@react-three/drei";
import * as THREE from "three";
import type { Environment } from "../types";

interface AudienceRoomProps {
  environment: Environment;
}

export const AudienceRoom = ({ environment }: AudienceRoomProps) => {
  switch (environment) {
    case 'office_meeting':
      return <OfficeRoom />;
    case 'school_presentation':
      return <ClassroomRoom />;
    case 'conference':
      return <ConferenceRoom />;
    case 'wedding':
      return <WeddingRoom />;
    case 'interview':
      return <InterviewRoom />;
    default:
      return <GeneralRoom />;
  }
};

// Office Meeting Room
const OfficeRoom = () => {
  return (
    <group>
      {/* Floor */}
      <Plane args={[12, 12]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#8B7355" roughness={0.8} />
      </Plane>
      
      {/* Back wall */}
      <Plane args={[12, 5]} position={[0, 2.5, -4]} receiveShadow>
        <meshStandardMaterial color="#E8E4DF" roughness={0.9} />
      </Plane>
      
      {/* Left wall */}
      <Plane args={[8, 5]} rotation={[0, Math.PI / 2, 0]} position={[-6, 2.5, 0]} receiveShadow>
        <meshStandardMaterial color="#E0DCD7" roughness={0.9} />
      </Plane>
      
      {/* Right wall with window */}
      <Plane args={[8, 5]} rotation={[0, -Math.PI / 2, 0]} position={[6, 2.5, 0]} receiveShadow>
        <meshStandardMaterial color="#E0DCD7" roughness={0.9} />
      </Plane>
      
      {/* Window */}
      <group position={[5.9, 2.5, -1]}>
        <Box args={[0.1, 2.5, 3]}>
          <meshStandardMaterial color="#87CEEB" emissive="#87CEEB" emissiveIntensity={0.3} />
        </Box>
        {/* Window frame */}
        <Box args={[0.15, 2.6, 0.1]} position={[0, 0, 1.5]}>
          <meshStandardMaterial color="#4A4A4A" />
        </Box>
        <Box args={[0.15, 2.6, 0.1]} position={[0, 0, -1.5]}>
          <meshStandardMaterial color="#4A4A4A" />
        </Box>
      </group>
      
      {/* Conference Table */}
      <Box args={[4, 0.1, 2]} position={[0, 0.75, 0]} castShadow>
        <meshStandardMaterial color="#5C4033" roughness={0.4} />
      </Box>
      {/* Table legs */}
      {[[-1.8, 0.375, -0.8], [1.8, 0.375, -0.8], [-1.8, 0.375, 0.8], [1.8, 0.375, 0.8]].map((pos, i) => (
        <Cylinder key={i} args={[0.05, 0.05, 0.75]} position={pos as [number, number, number]}>
          <meshStandardMaterial color="#3D2914" metalness={0.5} />
        </Cylinder>
      ))}
      
      {/* Whiteboard */}
      <group position={[0, 2.5, -3.9]}>
        <Box args={[3, 1.5, 0.1]}>
          <meshStandardMaterial color="#FFFFFF" roughness={0.1} />
        </Box>
        <Box args={[3.2, 1.7, 0.05]} position={[0, 0, -0.05]}>
          <meshStandardMaterial color="#808080" />
        </Box>
      </group>
      
      {/* Ceiling */}
      <Plane args={[12, 12]} rotation={[Math.PI / 2, 0, 0]} position={[0, 5, 0]}>
        <meshStandardMaterial color="#F5F5F5" />
      </Plane>
      
      {/* Ceiling lights */}
      <Box args={[2, 0.1, 0.5]} position={[0, 4.9, -1]}>
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.8} />
      </Box>
    </group>
  );
};

// Classroom
const ClassroomRoom = () => {
  return (
    <group>
      {/* Floor */}
      <Plane args={[12, 12]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#C4A77D" roughness={0.7} />
      </Plane>
      
      {/* Back wall */}
      <Plane args={[12, 5]} position={[0, 2.5, -4]} receiveShadow>
        <meshStandardMaterial color="#FFF8DC" roughness={0.9} />
      </Plane>
      
      {/* Side walls */}
      <Plane args={[8, 5]} rotation={[0, Math.PI / 2, 0]} position={[-6, 2.5, 0]} receiveShadow>
        <meshStandardMaterial color="#FFF5E6" roughness={0.9} />
      </Plane>
      <Plane args={[8, 5]} rotation={[0, -Math.PI / 2, 0]} position={[6, 2.5, 0]} receiveShadow>
        <meshStandardMaterial color="#FFF5E6" roughness={0.9} />
      </Plane>
      
      {/* Chalkboard */}
      <group position={[0, 2.2, -3.9]}>
        <Box args={[5, 2, 0.1]}>
          <meshStandardMaterial color="#2F4F4F" roughness={0.8} />
        </Box>
        {/* Frame */}
        <Box args={[5.2, 0.15, 0.15]} position={[0, 1.075, 0]}>
          <meshStandardMaterial color="#8B4513" />
        </Box>
        <Box args={[5.2, 0.15, 0.15]} position={[0, -1.075, 0]}>
          <meshStandardMaterial color="#8B4513" />
        </Box>
        {/* Chalk tray */}
        <Box args={[4, 0.1, 0.2]} position={[0, -1.15, 0.15]}>
          <meshStandardMaterial color="#8B4513" />
        </Box>
      </group>
      
      {/* Student desk */}
      <Box args={[2.5, 0.08, 1.5]} position={[0, 0.7, 1]} castShadow>
        <meshStandardMaterial color="#DEB887" roughness={0.6} />
      </Box>
      
      {/* Clock on wall */}
      <Cylinder args={[0.3, 0.3, 0.05]} rotation={[0, 0, 0]} position={[4, 3.5, -3.9]}>
        <meshStandardMaterial color="#FFFFFF" />
      </Cylinder>
      
      {/* Windows */}
      <group position={[5.9, 2.5, 0]}>
        <Box args={[0.1, 2, 2.5]}>
          <meshStandardMaterial color="#87CEEB" emissive="#FFFACD" emissiveIntensity={0.2} />
        </Box>
      </group>
      
      {/* Ceiling */}
      <Plane args={[12, 12]} rotation={[Math.PI / 2, 0, 0]} position={[0, 5, 0]}>
        <meshStandardMaterial color="#FFFFF0" />
      </Plane>
    </group>
  );
};

// Conference Hall
const ConferenceRoom = () => {
  return (
    <group>
      {/* Floor - dark stage */}
      <Plane args={[15, 15]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.1} />
      </Plane>
      
      {/* Back curtain */}
      <Plane args={[15, 8]} position={[0, 4, -5]} receiveShadow>
        <meshStandardMaterial color="#8B0000" roughness={0.9} />
      </Plane>
      
      {/* Side curtains */}
      <Plane args={[10, 8]} rotation={[0, Math.PI / 2, 0]} position={[-7, 4, 0]} receiveShadow>
        <meshStandardMaterial color="#800000" roughness={0.9} />
      </Plane>
      <Plane args={[10, 8]} rotation={[0, -Math.PI / 2, 0]} position={[7, 4, 0]} receiveShadow>
        <meshStandardMaterial color="#800000" roughness={0.9} />
      </Plane>
      
      {/* Podium */}
      <group position={[-3, 0, -2]}>
        <Box args={[0.8, 1.2, 0.6]} position={[0, 0.6, 0]}>
          <meshStandardMaterial color="#2F1810" roughness={0.4} />
        </Box>
        {/* Microphone */}
        <Cylinder args={[0.02, 0.02, 0.4]} position={[0, 1.4, 0.2]}>
          <meshStandardMaterial color="#333333" metalness={0.8} />
        </Cylinder>
      </group>
      
      {/* Stage edge/riser */}
      <Box args={[12, 0.3, 0.5]} position={[0, 0.15, 3]} castShadow>
        <meshStandardMaterial color="#333333" />
      </Box>
      
      {/* Audience seats suggestion (back rows) */}
      {[-2, -1, 0, 1, 2].map((x, i) => (
        <group key={i} position={[x * 1.5, 0.2, 5]}>
          <Box args={[0.8, 0.4, 0.4]}>
            <meshStandardMaterial color="#1a1a1a" />
          </Box>
        </group>
      ))}
      
      {/* Ceiling - dark */}
      <Plane args={[15, 15]} rotation={[Math.PI / 2, 0, 0]} position={[0, 8, 0]}>
        <meshStandardMaterial color="#0a0a0a" />
      </Plane>
    </group>
  );
};

// Wedding Venue
const WeddingRoom = () => {
  return (
    <group>
      {/* Floor - elegant marble */}
      <Plane args={[12, 12]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#F5F5F0" roughness={0.2} metalness={0.1} />
      </Plane>
      
      {/* Back wall - cream */}
      <Plane args={[12, 6]} position={[0, 3, -4]} receiveShadow>
        <meshStandardMaterial color="#FFF5EE" roughness={0.9} />
      </Plane>
      
      {/* Side walls */}
      <Plane args={[8, 6]} rotation={[0, Math.PI / 2, 0]} position={[-6, 3, 0]} receiveShadow>
        <meshStandardMaterial color="#FFF0F5" roughness={0.9} />
      </Plane>
      <Plane args={[8, 6]} rotation={[0, -Math.PI / 2, 0]} position={[6, 3, 0]} receiveShadow>
        <meshStandardMaterial color="#FFF0F5" roughness={0.9} />
      </Plane>
      
      {/* Arch decoration */}
      <group position={[0, 3, -3.8]}>
        {/* Arch posts */}
        <Cylinder args={[0.1, 0.1, 3]} position={[-2, 0, 0]}>
          <meshStandardMaterial color="#FFD700" metalness={0.6} roughness={0.3} />
        </Cylinder>
        <Cylinder args={[0.1, 0.1, 3]} position={[2, 0, 0]}>
          <meshStandardMaterial color="#FFD700" metalness={0.6} roughness={0.3} />
        </Cylinder>
      </group>
      
      {/* Flower arrangements */}
      {[[-4, 0.8, -3], [4, 0.8, -3]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <Cylinder args={[0.3, 0.25, 0.6]} position={[0, 0, 0]}>
            <meshStandardMaterial color="#DDA0DD" />
          </Cylinder>
          {/* Flowers */}
          <group position={[0, 0.5, 0]}>
            <Box args={[0.5, 0.4, 0.5]}>
              <meshStandardMaterial color="#FFB6C1" />
            </Box>
          </group>
        </group>
      ))}
      
      {/* Elegant table */}
      <Box args={[3, 0.08, 1.5]} position={[0, 0.75, 0.5]} castShadow>
        <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
      </Box>
      {/* Table cloth draping effect */}
      <Box args={[3.1, 0.5, 1.6]} position={[0, 0.5, 0.5]}>
        <meshStandardMaterial color="#FFF0F5" roughness={0.8} />
      </Box>
      
      {/* Ceiling with chandelier hint */}
      <Plane args={[12, 12]} rotation={[Math.PI / 2, 0, 0]} position={[0, 6, 0]}>
        <meshStandardMaterial color="#FFFAFA" />
      </Plane>
      
      {/* Chandelier */}
      <group position={[0, 5, 0]}>
        <Cylinder args={[0.02, 0.02, 1]} position={[0, 0.5, 0]}>
          <meshStandardMaterial color="#B8860B" metalness={0.8} />
        </Cylinder>
        <Cylinder args={[0.4, 0.3, 0.3]} position={[0, 0, 0]}>
          <meshStandardMaterial color="#FFD700" metalness={0.7} roughness={0.2} emissive="#FFD700" emissiveIntensity={0.2} />
        </Cylinder>
      </group>
    </group>
  );
};

// Interview Room
const InterviewRoom = () => {
  return (
    <group>
      {/* Floor - corporate carpet */}
      <Plane args={[10, 10]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#4A4A4A" roughness={0.9} />
      </Plane>
      
      {/* Back wall */}
      <Plane args={[10, 4]} position={[0, 2, -3.5]} receiveShadow>
        <meshStandardMaterial color="#E8E8E8" roughness={0.8} />
      </Plane>
      
      {/* Side walls */}
      <Plane args={[7, 4]} rotation={[0, Math.PI / 2, 0]} position={[-5, 2, 0]} receiveShadow>
        <meshStandardMaterial color="#E0E0E0" roughness={0.8} />
      </Plane>
      <Plane args={[7, 4]} rotation={[0, -Math.PI / 2, 0]} position={[5, 2, 0]} receiveShadow>
        <meshStandardMaterial color="#E0E0E0" roughness={0.8} />
      </Plane>
      
      {/* Interview desk */}
      <Box args={[3, 0.08, 1.2]} position={[0, 0.72, 0]} castShadow>
        <meshStandardMaterial color="#2F2F2F" roughness={0.3} metalness={0.2} />
      </Box>
      {/* Desk legs */}
      {[[-1.3, 0.36, -0.5], [1.3, 0.36, -0.5], [-1.3, 0.36, 0.5], [1.3, 0.36, 0.5]].map((pos, i) => (
        <Box key={i} args={[0.05, 0.72, 0.05]} position={pos as [number, number, number]}>
          <meshStandardMaterial color="#1F1F1F" metalness={0.5} />
        </Box>
      ))}
      
      {/* Company logo placeholder on wall */}
      <Box args={[1.5, 0.8, 0.05]} position={[0, 2.8, -3.45]}>
        <meshStandardMaterial color="#3B82F6" roughness={0.5} />
      </Box>
      
      {/* Framed certificates */}
      <Box args={[0.6, 0.8, 0.03]} position={[-3, 2.5, -3.45]}>
        <meshStandardMaterial color="#8B4513" />
      </Box>
      <Box args={[0.5, 0.7, 0.02]} position={[-3, 2.5, -3.43]}>
        <meshStandardMaterial color="#FFFFF0" />
      </Box>
      
      {/* Plant */}
      <group position={[4, 0, -2.5]}>
        <Cylinder args={[0.2, 0.25, 0.5]} position={[0, 0.25, 0]}>
          <meshStandardMaterial color="#4A4A4A" />
        </Cylinder>
        <Cylinder args={[0.1, 0.15, 0.8]} position={[0, 0.9, 0]}>
          <meshStandardMaterial color="#228B22" />
        </Cylinder>
      </group>
      
      {/* Ceiling */}
      <Plane args={[10, 10]} rotation={[Math.PI / 2, 0, 0]} position={[0, 4, 0]}>
        <meshStandardMaterial color="#F5F5F5" />
      </Plane>
      
      {/* Ceiling light panel */}
      <Box args={[2, 0.05, 1]} position={[0, 3.95, 0]}>
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.5} />
      </Box>
    </group>
  );
};

// General Room
const GeneralRoom = () => {
  return (
    <group>
      {/* Floor */}
      <Plane args={[10, 10]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#B8B8B8" roughness={0.6} />
      </Plane>
      
      {/* Walls */}
      <Plane args={[10, 4]} position={[0, 2, -3.5]} receiveShadow>
        <meshStandardMaterial color="#F0F0F0" roughness={0.9} />
      </Plane>
      <Plane args={[7, 4]} rotation={[0, Math.PI / 2, 0]} position={[-5, 2, 0]} receiveShadow>
        <meshStandardMaterial color="#E8E8E8" roughness={0.9} />
      </Plane>
      <Plane args={[7, 4]} rotation={[0, -Math.PI / 2, 0]} position={[5, 2, 0]} receiveShadow>
        <meshStandardMaterial color="#E8E8E8" roughness={0.9} />
      </Plane>
      
      {/* Simple table */}
      <Box args={[2.5, 0.08, 1.2]} position={[0, 0.72, 0.5]} castShadow>
        <meshStandardMaterial color="#8B7355" roughness={0.5} />
      </Box>
      
      {/* Ceiling */}
      <Plane args={[10, 10]} rotation={[Math.PI / 2, 0, 0]} position={[0, 4, 0]}>
        <meshStandardMaterial color="#FFFFFF" />
      </Plane>
    </group>
  );
};
