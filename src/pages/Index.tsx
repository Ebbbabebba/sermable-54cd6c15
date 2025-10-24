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
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
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

      {/* Content Overlay */}
      <div className="relative z-10 text-center space-y-8 px-4 max-w-md mx-auto">
        {/* Spacing for astronaut */}
        <div className="h-64 md:h-80"></div>
        
        {/* Tagline */}
        <div className="animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
            Master your speech.
          </h1>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 animate-slide-up">
          <Button 
            size="lg" 
            onClick={() => navigate("/auth")}
            className="w-full text-lg py-6 shadow-lg hover:shadow-xl transition-shadow"
          >
            Get Started
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/auth")}
            className="w-full text-lg py-6 bg-background/80 backdrop-blur-sm"
          >
            Log In
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4 left-0 right-0 text-center text-sm text-muted-foreground z-10">
        <p>&copy; {new Date().getFullYear()} Sermable</p>
      </footer>
    </div>
  );
};

export default Index;
