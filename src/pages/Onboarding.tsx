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
  const [isTyping, setIsTyping] = useState(true);
  const [displayedText, setDisplayedText] = useState("");

  const currentContent = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  // Typing animation effect
  useEffect(() => {
    setIsTyping(true);
    setDisplayedText("");
    
    const fullText = currentContent.message;
    let index = 0;
    
    const typingInterval = setInterval(() => {
      if (index < fullText.length) {
        setDisplayedText(fullText.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(typingInterval);
      }
    }, 25); // Typing speed

    return () => clearInterval(typingInterval);
  }, [currentStep, currentContent.message]);

  const handleNext = () => {
    if (isLastStep) {
      // Mark onboarding as complete
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
      {/* Animated space background */}
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

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        {/* Astronaut */}
        <div className="mb-6">
          <FloatingAstronaut2D />
        </div>

        {/* Speech bubble */}
        <div className="relative max-w-md w-full animate-fade-in">
          {/* Bubble pointer */}
          <div 
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '12px solid transparent',
              borderRight: '12px solid transparent',
              borderBottom: '12px solid hsl(240, 20%, 18%)',
            }}
          />
          
          {/* Bubble content */}
          <div 
            className="rounded-2xl p-6 border border-primary/30"
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
            <p className="text-foreground/80 leading-relaxed min-h-[80px]">
              {displayedText}
              {isTyping && <span className="animate-pulse">|</span>}
            </p>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 mt-8">
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
      </div>

      {/* Bottom button */}
      <div className="px-6 pb-8 max-w-md w-full mx-auto relative z-10">
        <Button
          size="lg"
          onClick={handleNext}
          disabled={isTyping}
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
