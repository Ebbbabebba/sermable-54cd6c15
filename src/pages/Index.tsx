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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold text-foreground">
            sermable
          </h1>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center w-full h-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="animate-fade-in mb-4">
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight text-foreground">
              sermable
            </h1>
          </div>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 animate-fade-in">
            {t('app.tagline')}
          </p>
        </div>

        <div className="px-6 pb-8 space-y-3 max-w-md w-full mx-auto animate-fade-in">
          <Button 
            size="lg" 
            onClick={() => navigate("/auth")}
            className="w-full text-base font-semibold py-6"
          >
            {t('home.getStarted')}
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/auth")}
            className="w-full text-base font-semibold py-6"
          >
            {t('home.haveAccount')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
