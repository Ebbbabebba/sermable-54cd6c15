import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import { Suspense } from "react";
import { motion } from "framer-motion";
import type { Environment as EnvType, AudienceState } from "./types";
import { AudienceRoom } from "./3d/AudienceRoom";
import { Audience3DCharacters } from "./3d/Audience3DCharacters";

interface Audience3DSceneProps {
  environment: EnvType;
  audienceState: AudienceState;
  onClose?: () => void;
}

export const Audience3DScene = ({ 
  environment, 
  audienceState,
  onClose 
}: Audience3DSceneProps) => {
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      
      {/* Mood indicator overlay */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
        <MoodIndicator3D mood={audienceState.overallMood} />
      </div>
      
      {/* 3D Canvas */}
      <Canvas shadows>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 1.6, 4]} fov={60} />
          
          {/* Lighting based on environment */}
          <SceneLighting environment={environment} />
          
          {/* Environment preset for reflections */}
          <Environment preset={getEnvironmentPreset(environment)} />
          
          {/* The 3D room */}
          <AudienceRoom environment={environment} />
          
          {/* The 3D audience characters */}
          <Audience3DCharacters audienceState={audienceState} />
          
          {/* Subtle camera controls for immersion */}
          <OrbitControls 
            enableZoom={false}
            enablePan={false}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={Math.PI / 4}
            maxAzimuthAngle={Math.PI / 6}
            minAzimuthAngle={-Math.PI / 6}
          />
        </Suspense>
      </Canvas>
    </motion.div>
  );
};

// Scene lighting based on environment
const SceneLighting = ({ environment }: { environment: EnvType }) => {
  switch (environment) {
    case 'conference':
      return (
        <>
          <ambientLight intensity={0.2} />
          <spotLight position={[0, 5, 0]} angle={0.4} penumbra={0.5} intensity={2} castShadow color="#ffe4c4" />
          <spotLight position={[-3, 4, 2]} angle={0.3} penumbra={0.5} intensity={1} color="#4488ff" />
          <spotLight position={[3, 4, 2]} angle={0.3} penumbra={0.5} intensity={1} color="#ff8844" />
        </>
      );
    case 'wedding':
      return (
        <>
          <ambientLight intensity={0.4} color="#fff5f0" />
          <pointLight position={[0, 4, 0]} intensity={1.5} color="#ffe4d4" />
          <pointLight position={[-2, 3, 2]} intensity={0.5} color="#ffcccc" />
          <pointLight position={[2, 3, 2]} intensity={0.5} color="#ffcccc" />
        </>
      );
    case 'office_meeting':
      return (
        <>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
          <pointLight position={[0, 3, 0]} intensity={0.5} color="#fff8f0" />
        </>
      );
    case 'school_presentation':
      return (
        <>
          <ambientLight intensity={0.6} color="#fffaf0" />
          <directionalLight position={[3, 5, 2]} intensity={0.7} castShadow />
          <pointLight position={[-2, 2, 3]} intensity={0.3} color="#ffe8cc" />
        </>
      );
    case 'interview':
      return (
        <>
          <ambientLight intensity={0.5} />
          <directionalLight position={[2, 4, 3]} intensity={0.6} castShadow />
          <spotLight position={[0, 4, 2]} angle={0.5} penumbra={0.3} intensity={0.8} />
        </>
      );
    default:
      return (
        <>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={0.7} castShadow />
        </>
      );
  }
};

// Get environment preset for reflections
const getEnvironmentPreset = (environment: EnvType): "apartment" | "city" | "dawn" | "forest" | "lobby" | "night" | "park" | "studio" | "sunset" | "warehouse" => {
  switch (environment) {
    case 'conference':
      return 'night';
    case 'wedding':
      return 'sunset';
    case 'office_meeting':
      return 'lobby';
    case 'school_presentation':
      return 'apartment';
    case 'interview':
      return 'studio';
    default:
      return 'apartment';
  }
};

// 3D Mood indicator
const MoodIndicator3D = ({ mood }: { mood: 'positive' | 'neutral' | 'negative' }) => {
  const moodConfig = {
    positive: { emoji: '👏', label: 'Great job!', bgClass: 'bg-primary' },
    neutral: { emoji: '👀', label: 'Listening...', bgClass: 'bg-secondary' },
    negative: { emoji: '😬', label: 'Keep going!', bgClass: 'bg-accent' },
  };
  
  const config = moodConfig[mood];
  
  return (
    <motion.div
      className={`px-4 py-2 rounded-full ${config.bgClass} text-primary-foreground text-sm font-medium flex items-center gap-2 shadow-2xl backdrop-blur-sm`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      key={mood}
    >
      <span className="text-lg">{config.emoji}</span>
      <span>{config.label}</span>
    </motion.div>
  );
};
