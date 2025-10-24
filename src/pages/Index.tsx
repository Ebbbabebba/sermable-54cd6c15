import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import FloatingAstronaut2D from "@/components/FloatingAstronaut2D";
import { useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const [flyAway, setFlyAway] = useState(false);

  const handleNavigation = (path: string) => {
    setFlyAway(true);
    // Navigate when astronaut's feet leave screen (~1 second into 2.5s animation)
    setTimeout(() => {
      navigate(path);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center relative overflow-hidden">
      {/* Content Overlay */}
      <div className="relative z-10 text-center w-full h-full flex flex-col">
        {/* Main content centered */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* 2D Floating Astronaut */}
          <FloatingAstronaut2D triggerFlyAway={flyAway} />
          
          {/* Logo text - Navy blue */}
          <div className="animate-fade-in mb-4">
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight" style={{ color: 'hsl(220, 80%, 25%)' }}>
              sermable
            </h1>
          </div>
          
          {/* Tagline */}
          <p className="text-lg md:text-xl text-gray-600 mb-8 animate-fade-in">
            Master your speech.
          </p>
        </div>

        {/* Buttons at bottom - Navy blue */}
        <div className="px-6 pb-8 space-y-3 max-w-md w-full mx-auto animate-slide-up">
          <Button 
            size="lg" 
            onClick={() => handleNavigation("/auth")}
            className="w-full text-base font-bold py-6 uppercase tracking-wider shadow-lg hover:shadow-xl transition-all"
            style={{ backgroundColor: 'hsl(220, 80%, 25%)', color: 'white' }}
          >
            Get Started
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => handleNavigation("/auth")}
            className="w-full text-base font-bold py-6 uppercase tracking-wider border-2"
            style={{ 
              borderColor: 'hsl(220, 80%, 25%)', 
              color: 'hsl(220, 80%, 25%)',
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
