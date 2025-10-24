import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import astronautImage from "@/assets/astronaut.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center relative overflow-hidden">
      {/* Content - Duolingo Style */}
      <div className="relative z-10 text-center w-full h-full flex flex-col">
        {/* Main content centered */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16">
          {/* Astronaut Image with Logo */}
          <div className="relative mb-8 animate-fade-in">
            <img 
              src={astronautImage} 
              alt="Astronaut" 
              className="w-64 h-64 md:w-80 md:h-80 object-contain"
            />
            {/* Sermable logo on uniform */}
            <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2">
              <div className="bg-white/90 px-3 py-1 rounded-md shadow-md">
                <span className="text-sm md:text-base font-bold text-black">sermable</span>
              </div>
            </div>
          </div>
          
          {/* Logo text - Duolingo style */}
          <div className="animate-fade-in mb-4">
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight" style={{ color: 'hsl(140, 81%, 47%)' }}>
              sermable
            </h1>
          </div>
          
          {/* Tagline */}
          <p className="text-lg md:text-xl text-gray-600 mb-8 animate-fade-in">
            Master your speech.
          </p>
        </div>

        {/* Buttons at bottom - Duolingo style with navy blue */}
        <div className="px-6 pb-8 space-y-3 max-w-md w-full mx-auto animate-slide-up">
          <Button 
            size="lg" 
            onClick={() => navigate("/auth")}
            className="w-full text-base font-bold py-6 uppercase tracking-wider shadow-lg hover:shadow-xl transition-all"
            style={{ backgroundColor: 'hsl(220, 80%, 25%)', color: 'white' }}
          >
            Get Started
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/auth")}
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
