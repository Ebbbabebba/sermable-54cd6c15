import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, MessageCircle, GraduationCap, TrendingUp, Theater, Star } from "lucide-react";
import { useTranslation } from "react-i18next";

const ONBOARDING_STEPS = [
  { key: 'welcome', icon: Star },
  { key: 'practice', icon: MessageCircle },
  { key: 'adaptive', icon: GraduationCap },
  { key: 'learning', icon: TrendingUp },
  { key: 'presentation', icon: Theater },
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
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      {/* Skip button */}
      <div className="absolute top-6 right-6 z-20">
        <Button
          variant="ghost"
          onClick={handleSkip}
          className="text-muted-foreground hover:text-foreground"
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
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8 bg-primary"
          >
            <CurrentIcon className="w-10 h-10 text-primary-foreground" />
          </div>

          {/* Title */}
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
            {t(`onboarding.steps.${currentKey}.title`)}
          </h2>

          {/* Message */}
          <p className="text-muted-foreground text-lg leading-relaxed">
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
                  : 'w-2 bg-muted-foreground/20'
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
          className="w-full text-base font-semibold py-6"
        >
          {isLastStep ? t('onboarding.getStarted') : t('onboarding.continue')}
          <ChevronRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
