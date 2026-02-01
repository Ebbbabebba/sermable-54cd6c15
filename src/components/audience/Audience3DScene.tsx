import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import { Suspense } from "react";
import { motion } from "framer-motion";
import type { Environment as EnvType, AudienceState } from "./types";
import { AudienceRoom } from "./3d/AudienceRoom";
import { Audience3DCharacters } from "./3d/Audience3DCharacters";
import { X } from "lucide-react";

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
      className="fixed inset-0 z-50 bg-gradient-to-b from-slate-900 to-slate-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-3 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-200 group"
        >
          <X className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
        </button>
      )}
      
      {/* Environment label */}
      <motion.div 
        className="absolute top-4 left-4 z-40"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white/80 text-sm font-medium">
          {getEnvironmentLabel(environment)}
        </div>
      </motion.div>
      
      {/* Mood indicator overlay */}
      <motion.div 
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <MoodIndicator3D mood={audienceState.overallMood} />
      </motion.div>
      
      {/* 3D Canvas */}
      <Canvas shadows>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 1.8, 3.5]} fov={50} />
          
          {/* Soft ambient for toon shading */}
          <ambientLight intensity={0.6} />
          
          {/* Main key light */}
          <directionalLight
            position={[3, 5, 5]}
            intensity={1}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          
          {/* Fill light */}
          <directionalLight position={[-3, 3, 3]} intensity={0.4} />
          
          {/* Rim light for depth */}
          <pointLight position={[0, 3, -3]} intensity={0.5} color="#4488ff" />
          
          {/* Environment lighting */}
          <SceneLighting environment={environment} />
          <Environment preset={getEnvironmentPreset(environment)} />
          
          {/* The 3D room */}
          <AudienceRoom environment={environment} />
          
          {/* The Duolingo-style 3D audience characters */}
          <Audience3DCharacters audienceState={audienceState} />
          
          {/* Subtle camera controls */}
          <OrbitControls 
            enableZoom={false}
            enablePan={false}
            maxPolarAngle={Math.PI / 2.2}
            minPolarAngle={Math.PI / 4}
            maxAzimuthAngle={Math.PI / 8}
            minAzimuthAngle={-Math.PI / 8}
            rotateSpeed={0.3}
          />
        </Suspense>
      </Canvas>
    </motion.div>
  );
};

// Get readable environment label
const getEnvironmentLabel = (environment: EnvType): string => {
  const labels: Record<EnvType, string> = {
    office_meeting: '🏢 Office Meeting',
    school_presentation: '🎓 Classroom',
    conference: '🎤 Conference Hall',
    wedding: '💒 Wedding Reception',
    interview: '💼 Interview Room',
    general: '📋 General',
  };
  return labels[environment] || 'General';
};

// Scene lighting based on environment
const SceneLighting = ({ environment }: { environment: EnvType }) => {
  switch (environment) {
    case 'conference':
      return (
        <>
          <spotLight position={[0, 5, 0]} angle={0.4} penumbra={0.5} intensity={1.5} castShadow color="#ffe4c4" />
          <spotLight position={[-3, 4, 2]} angle={0.3} penumbra={0.5} intensity={0.8} color="#4488ff" />
          <spotLight position={[3, 4, 2]} angle={0.3} penumbra={0.5} intensity={0.8} color="#ff8844" />
        </>
      );
    case 'wedding':
      return (
        <>
          <pointLight position={[0, 4, 0]} intensity={1.2} color="#ffe4d4" />
          <pointLight position={[-2, 3, 2]} intensity={0.4} color="#ffcccc" />
          <pointLight position={[2, 3, 2]} intensity={0.4} color="#ffcccc" />
        </>
      );
    case 'office_meeting':
      return (
        <>
          <pointLight position={[0, 3, 0]} intensity={0.6} color="#fff8f0" />
        </>
      );
    case 'school_presentation':
      return (
        <>
          <pointLight position={[-2, 2, 3]} intensity={0.4} color="#ffe8cc" />
        </>
      );
    case 'interview':
      return (
        <>
          <spotLight position={[0, 4, 2]} angle={0.5} penumbra={0.3} intensity={0.7} />
        </>
      );
    default:
      return null;
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

// Duolingo-style mood indicator with bouncy animation
const MoodIndicator3D = ({ mood }: { mood: 'positive' | 'neutral' | 'negative' }) => {
  const moodConfig = {
    positive: { emoji: '🎉', label: 'Great job!', gradient: 'from-green-400 to-emerald-500' },
    neutral: { emoji: '👀', label: 'Listening...', gradient: 'from-blue-400 to-cyan-500' },
    negative: { emoji: '💪', label: 'Keep going!', gradient: 'from-orange-400 to-amber-500' },
  };
  
  const config = moodConfig[mood];
  
  return (
    <motion.div
      className={`px-6 py-3 rounded-2xl bg-gradient-to-r ${config.gradient} text-white text-base font-bold flex items-center gap-3 shadow-2xl`}
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      key={mood}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
    >
      <motion.span 
        className="text-2xl"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
      >
        {config.emoji}
      </motion.span>
      <span>{config.label}</span>
    </motion.div>
  );
};
