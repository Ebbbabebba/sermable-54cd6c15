import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

const useIsMobileDevice = () => {
  return useMemo(() => {
    const ua = navigator.userAgent || navigator.vendor || "";
    return /android|iphone|ipad|ipod|mobile/i.test(ua);
  }, []);
};

const Index = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();
  const isMobileDevice = useIsMobileDevice();
  const [showDownloadLinks, setShowDownloadLinks] = useState(false);

  useEffect(() => {
    const checkAuthAndOnboarding = async () => {
      // Desktop users only see download links, no login needed
      if (!isMobileDevice) {
        setIsLoading(false);
        return;
      }

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
  }, [navigate, isMobileDevice]);

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
          {isMobileDevice ? (
            <>
              <Button 
                size="lg" 
                onClick={() => navigate("/auth?mode=signup")}
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
            </>
          ) : showDownloadLinks ? (
            <>
              <p className="text-sm text-muted-foreground mb-2">
                {t('home.mobileOnly', 'sermable is available on mobile devices. Download the app to log in.')}
              </p>
              <a
                href="https://apps.apple.com/app/sermable/id0000000000"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button 
                  size="lg" 
                  className="w-full text-base font-semibold py-6 gap-2"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  Download on App Store
                </Button>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=app.sermable"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button 
                  size="lg" 
                  variant="outline"
                  className="w-full text-base font-semibold py-6 gap-2"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 1.33a1 1 0 0 1 0 1.724l-2.302 1.33-2.535-2.535 2.535-2.849zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/>
                  </svg>
                  Get it on Google Play
                </Button>
              </a>
            </>
          ) : (
            <>
              <Button 
                size="lg" 
                onClick={() => setShowDownloadLinks(true)}
                className="w-full text-base font-semibold py-6"
              >
                {t('home.getStarted')}
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => setShowDownloadLinks(true)}
                className="w-full text-base font-semibold py-6"
              >
                {t('home.haveAccount')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
