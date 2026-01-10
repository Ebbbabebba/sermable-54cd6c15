import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, Mic, Brain, TrendingUp, Presentation, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

const ONBOARDING_STEPS = [
  { key: 'welcome', icon: Sparkles },
  { key: 'practice', icon: Mic },
  { key: 'adaptive', icon: Brain },
  { key: 'learning', icon: TrendingUp },
  { key: 'presentation', icon: Presentation },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const { t } = useTranslation();

  const { key: currentKey, icon: CurrentIcon } = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  useEffect(() => {
    setShowContent(false);
    const timer = setTimeout(() => setShowContent(true), 200);
    return () => clearTimeout(timer);
  }, [currentStep]);

  const handleNext = () => {
    if (isLastStep) {
      localStorage.setItem("onboarding_complete", "true");
      navigate("/auth");
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("onboarding_complete", "true");
    navigate("/auth");
  };

  return (
    <div 
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, hsl(240, 20%, 12%), hsl(240, 20%, 6%))' }}
    >
      {/* Starfield background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 3 + 1 + 'px',
              height: Math.random() * 3 + 1 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              background: ['hsl(217, 91%, 60%)', 'hsl(270, 100%, 70%)', 'hsl(330, 100%, 70%)', 'hsl(180, 100%, 60%)', 'white'][Math.floor(Math.random() * 5)],
              opacity: Math.random() * 0.5 + 0.2,
              animation: `pulse ${8 + Math.random() * 6}s ease-in-out infinite`,
              animationDelay: Math.random() * 4 + 's',
              boxShadow: '0 0 6px currentColor',
            }}
          />
        ))}
      </div>

      {/* Skip button */}
      <div className="absolute top-6 right-6 z-20">
        <Button
          variant="ghost"
          onClick={handleSkip}
          className="text-foreground/60 hover:text-foreground/90"
        >
          {t('onboarding.skip')}
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div 
          className={`flex flex-col items-center text-center max-w-md w-full transition-all duration-500 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Icon */}
          <div 
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8"
            style={{ 
              background: 'linear-gradient(135deg, hsl(270, 100%, 70%), hsl(330, 100%, 70%))',
              boxShadow: '0 0 40px rgba(139, 92, 246, 0.4)',
            }}
          >
            <CurrentIcon className="w-10 h-10 text-white" />
          </div>

          {/* Title */}
          <h2 
            className="text-2xl md:text-3xl font-bold mb-4 bg-clip-text text-transparent"
            style={{ 
              backgroundImage: 'linear-gradient(135deg, hsl(217, 91%, 60%), hsl(270, 100%, 70%))',
            }}
          >
            {t(`onboarding.steps.${currentKey}.title`)}
          </h2>

          {/* Message */}
          <p className="text-foreground/70 text-lg leading-relaxed">
            {t(`onboarding.steps.${currentKey}.message`)}
          </p>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 pb-4 relative z-10">
        {ONBOARDING_STEPS.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentStep(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentStep 
                ? 'w-6 bg-primary' 
                : index < currentStep 
                  ? 'w-2 bg-primary/60' 
                  : 'w-2 bg-foreground/20'
            }`}
          />
        ))}
      </div>

      {/* Continue button */}
      <div className="px-6 pb-8 max-w-md w-full mx-auto relative z-10">
        <Button
          size="lg"
          onClick={handleNext}
          disabled={!showContent}
          className="w-full text-base font-semibold py-6 uppercase tracking-wider shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-primary via-accent to-cosmic-pink text-white hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.25)' }}
        >
          {isLastStep ? t('onboarding.getStarted') : t('onboarding.continue')}
          <ChevronRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
