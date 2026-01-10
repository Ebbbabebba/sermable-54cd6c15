import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const checkAuthAndOnboarding = async () => {
      const onboardingComplete = localStorage.getItem("onboarding_complete");
      
      if (!onboardingComplete) {
        navigate("/onboarding", { replace: true });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        navigate("/dashboard", { replace: true });
        return;
      }

      setIsLoading(false);
    };

    checkAuthAndOnboarding();
  }, [navigate]);

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at center, hsl(240, 20%, 12%), hsl(240, 20%, 6%))' }}
      >
        <div className="flex flex-col items-center gap-4">
          <h1 
            className="text-4xl font-bold bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, hsl(217, 91%, 60%), hsl(270, 100%, 70%), hsl(330, 100%, 70%))' }}
          >
            sermable
          </h1>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'radial-gradient(ellipse at center, hsl(240, 20%, 12%), hsl(240, 20%, 6%))' }}>
      <div className="fixed inset-0 pointer-events-none z-0">
        {Array.from({ length: 100 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-pulse"
            style={{
              width: Math.random() * 3 + 1 + 'px',
              height: Math.random() * 3 + 1 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              background: ['hsl(217, 91%, 60%)', 'hsl(270, 100%, 70%)', 'hsl(330, 100%, 70%)', 'hsl(180, 100%, 60%)', 'white'][Math.floor(Math.random() * 5)],
              opacity: Math.random() * 0.7 + 0.3,
              animationDuration: Math.random() * 3 + 2 + 's',
              animationDelay: Math.random() * 2 + 's',
              boxShadow: '0 0 10px currentColor',
            }}
          />
        ))}
      </div>
      <div className="relative z-10 text-center w-full h-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="animate-fade-in mb-4">
            <h1 
              className="text-6xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent"
              style={{ 
                backgroundImage: 'linear-gradient(135deg, hsl(217, 91%, 60%), hsl(270, 100%, 70%), hsl(330, 100%, 70%))',
                textShadow: '0 0 30px rgba(139, 92, 246, 0.5)'
              }}
            >
              sermable
            </h1>
          </div>
          
          <p className="text-lg md:text-xl text-foreground/70 mb-8 animate-fade-in">
            {t('app.tagline')}
          </p>
        </div>

        <div className="px-6 pb-8 space-y-3 max-w-md w-full mx-auto animate-slide-up">
          <Button 
            size="lg" 
            onClick={() => navigate("/auth")}
            className="w-full text-base font-semibold py-6 uppercase tracking-wider shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-primary via-accent to-cosmic-pink text-white hover:scale-105"
            style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.25)' }}
          >
            {t('home.getStarted')}
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/auth")}
            className="w-full text-base font-semibold py-6 uppercase tracking-wider border-2 border-primary/40 text-foreground/90 bg-card/30 backdrop-blur-sm hover:bg-card/50 hover:border-primary/60 hover:scale-105 transition-all"
            style={{ boxShadow: '0 0 15px rgba(66, 153, 225, 0.15)' }}
          >
            {t('home.haveAccount')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
