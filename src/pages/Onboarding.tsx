import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import FloatingAstronaut2D from "@/components/FloatingAstronaut2D";
import { ChevronRight } from "lucide-react";

const ONBOARDING_STEPS = [
  {
    title: "Welcome to Sermable!",
    message: "I'm here to help you memorize your speeches and presentations with ease. Let me show you how it works!",
  },
  {
    title: "Speech Practice",
    message: "Paste your speech text and practice speaking it out loud. I'll track your progress in real-time and highlight any words you miss or hesitate on.",
  },
  {
    title: "Adaptive Cue Words",
    message: "As you improve, I'll gradually hide words to challenge your memory. Struggling? I'll show them again. It's like having a smart teleprompter!",
  },
  {
    title: "Learning Mode",
    message: "I use spaced repetition - a scientifically proven technique - to schedule your practice sessions for optimal memorization. You'll master your speech faster!",
  },
  {
    title: "Presentation Mode",
    message: "When you're ready, switch to Presentation Mode for a full run-through. Get detailed feedback on accuracy, timing, and areas to improve.",
  },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [showText, setShowText] = useState(false);
  const [triggerWave, setTriggerWave] = useState(false);

  const currentContent = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  // Show text after 1 second and trigger wave
  useEffect(() => {
    setShowText(false);
    setTriggerWave(false);
    
    const timer = setTimeout(() => {
      setShowText(true);
      setTriggerWave(true);
    }, 1000);

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
      {/* Slow moving stars background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {Array.from({ length: 80 }).map((_, i) => (
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
          Skip
        </Button>
      </div>

      {/* Main content - Astronaut and speech bubble side by side */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 max-w-4xl w-full">
          {/* Astronaut */}
          <div className="flex-shrink-0">
            <FloatingAstronaut2D triggerWave={triggerWave} />
          </div>

          {/* Speech bubble - beside astronaut */}
          <div className="relative flex-1 max-w-md w-full">
            {/* Bubble pointer - points left on desktop */}
            <div 
              className="hidden md:block absolute top-1/2 -left-3 -translate-y-1/2 w-0 h-0"
              style={{
                borderTop: '12px solid transparent',
                borderBottom: '12px solid transparent',
                borderRight: '12px solid hsl(240, 20%, 18%)',
              }}
            />
            {/* Bubble pointer - points up on mobile */}
            <div 
              className="md:hidden absolute -top-3 left-8 w-0 h-0"
              style={{
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderBottom: '12px solid hsl(240, 20%, 18%)',
              }}
            />
            
            {/* Bubble content */}
            <div 
              className={`rounded-2xl p-6 border border-primary/30 transition-all duration-500 ${showText ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
              style={{ 
                background: 'linear-gradient(135deg, hsl(240, 20%, 18%), hsl(240, 20%, 14%))',
                boxShadow: '0 0 30px rgba(139, 92, 246, 0.2)',
              }}
            >
              <h2 
                className="text-xl font-bold mb-3 bg-clip-text text-transparent"
                style={{ 
                  backgroundImage: 'linear-gradient(135deg, hsl(217, 91%, 60%), hsl(270, 100%, 70%))',
                }}
              >
                {currentContent.title}
              </h2>
              <p className="text-foreground/80 leading-relaxed">
                {currentContent.message}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 pb-4 relative z-10">
        {ONBOARDING_STEPS.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentStep(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentStep 
                ? 'w-6 bg-primary' 
                : index < currentStep 
                  ? 'bg-primary/60' 
                  : 'bg-foreground/20'
            }`}
          />
        ))}
      </div>

      {/* Bottom button */}
      <div className="px-6 pb-8 max-w-md w-full mx-auto relative z-10">
        <Button
          size="lg"
          onClick={handleNext}
          disabled={!showText}
          className="w-full text-base font-semibold py-6 uppercase tracking-wider shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-primary via-accent to-cosmic-pink text-white hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.25)' }}
        >
          {isLastStep ? "Get Started" : "Continue"}
          <ChevronRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
