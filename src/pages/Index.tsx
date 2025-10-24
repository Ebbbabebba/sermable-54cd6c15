import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { AnimatedAstronaut } from "@/components/AnimatedAstronaut";
import { StarField } from "@/components/StarField";
import { Suspense } from "react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center relative overflow-hidden">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 z-0">
        <Canvas>
          <Suspense fallback={null}>
            <PerspectiveCamera makeDefault position={[0, 0, 8]} />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            
            <StarField />
            <AnimatedAstronaut />
            
            <OrbitControls 
              enableZoom={false} 
              enablePan={false}
              autoRotate
              autoRotateSpeed={0.5}
              maxPolarAngle={Math.PI / 2}
              minPolarAngle={Math.PI / 2}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Content Overlay - Duolingo Style */}
      <div className="relative z-10 text-center w-full h-full flex flex-col">
        {/* Main content centered */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Spacing for astronaut */}
          <div className="h-48 md:h-64"></div>
          
          {/* Logo text - Duolingo style */}
          <div className="animate-fade-in mb-4">
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight" style={{ color: 'hsl(140, 81%, 47%)' }}>
              sermable
            </h1>
          </div>
          
          {/* Tagline */}
          <p className="text-lg md:text-xl text-muted-foreground mb-8 animate-fade-in">
            Master your speech.
          </p>
        </div>

        {/* Buttons at bottom - Duolingo style */}
        <div className="px-6 pb-8 space-y-3 max-w-md w-full mx-auto animate-slide-up">
          <Button 
            size="lg" 
            onClick={() => navigate("/auth")}
            className="w-full text-base font-bold py-6 uppercase tracking-wider shadow-lg hover:shadow-xl transition-all"
            style={{ backgroundColor: 'hsl(140, 81%, 47%)', color: 'white' }}
          >
            Get Started
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/auth")}
            className="w-full text-base font-bold py-6 uppercase tracking-wider border-2"
            style={{ 
              borderColor: 'hsl(140, 81%, 47%)', 
              color: 'hsl(140, 81%, 47%)',
              backgroundColor: 'white'
            }}
          >
            I already have an account
          </Button>
        </div>
      </div>

    </div>
  );
};

export default Index;
