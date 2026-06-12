import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, MessageCircle, GraduationCap, TrendingUp, Theater } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

type StepTheme = {
  key: string;
  icon: typeof MessageCircle | null;
  // Full vibrant background gradient
  bg: string;
  // Accent circle behind icon
  accent: string;
  // CTA button colors
  buttonBg: string;
  buttonText: string;
  // Foreground text color
  text: string;
  subtext: string;
};

const ONBOARDING_STEPS: StepTheme[] = [
  {
    key: "welcome",
    icon: null,
    bg: "bg-gradient-to-br from-[#60A5FA] via-[#3B82F6] to-[#2563EB]",
    accent: "bg-white/15",
    buttonBg: "bg-white hover:bg-white/95",
    buttonText: "text-[#2563EB]",
    text: "text-white",
    subtext: "text-white/90",
  },
  {
    key: "practice",
    icon: MessageCircle,
    bg: "bg-gradient-to-br from-[#38BDF8] via-[#0EA5E9] to-[#0284C7]",
    accent: "bg-white/15",
    buttonBg: "bg-white hover:bg-white/95",
    buttonText: "text-[#0284C7]",
    text: "text-white",
    subtext: "text-white/90",
  },
  {
    key: "adaptive",
    icon: GraduationCap,
    bg: "bg-gradient-to-br from-[#818CF8] via-[#6366F1] to-[#4338CA]",
    accent: "bg-white/15",
    buttonBg: "bg-white hover:bg-white/95",
    buttonText: "text-[#4338CA]",
    text: "text-white",
    subtext: "text-white/90",
  },
  {
    key: "learning",
    icon: TrendingUp,
    bg: "bg-gradient-to-br from-[#22D3EE] via-[#06B6D4] to-[#0891B2]",
    accent: "bg-white/15",
    buttonBg: "bg-white hover:bg-white/95",
    buttonText: "text-[#0891B2]",
    text: "text-white",
    subtext: "text-white/90",
  },
  {
    key: "presentation",
    icon: Theater,
    bg: "bg-gradient-to-br from-[#A5B4FC] via-[#7C8AE8] to-[#4F5ECD]",
    accent: "bg-white/15",
    buttonBg: "bg-white hover:bg-white/95",
    buttonText: "text-[#4F5ECD]",
    text: "text-white",
    subtext: "text-white/90",
  },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const { t } = useTranslation();

  const step = ONBOARDING_STEPS[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      localStorage.setItem("onboarding_complete", "true");
      navigate("/auth");
    } else {
      setCurrentStep((p) => p + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("onboarding_complete", "true");
    navigate("/auth");
  };

  // Swipe support
  useEffect(() => {
    let startX = 0;
    const onStart = (e: TouchEvent) => (startX = e.touches[0].clientX);
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (dx < -60 && currentStep < ONBOARDING_STEPS.length - 1) setCurrentStep((p) => p + 1);
      if (dx > 60 && currentStep > 0) setCurrentStep((p) => p - 1);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [currentStep]);

  return (
    <div className={`fixed inset-0 flex flex-col overflow-hidden transition-colors duration-500 ${step.bg}`}>
      {/* Floating shapes for playful feel */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-20 -left-16 w-72 h-72 rounded-full bg-white/10 blur-2xl"
          animate={{ x: [0, 20, 0], y: [0, 30, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-32 -right-20 w-80 h-80 rounded-full bg-white/10 blur-2xl"
          animate={{ x: [0, -25, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Top bar: progress + skip */}
      <div
        className="relative z-10 flex items-center gap-3 px-5 pt-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <div className="flex-1 flex gap-1.5">
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} className="flex-1 h-1.5 rounded-full bg-white/25 overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                initial={false}
                animate={{ width: i < currentStep ? "100%" : i === currentStep ? "100%" : "0%" }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleSkip}
          className={`text-sm font-bold ${step.text} opacity-80 hover:opacity-100 transition-opacity`}
        >
          {t("onboarding.skip")}
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.key}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center text-center max-w-sm w-full"
          >
            {/* Big bouncy icon (omitted on welcome step for a typographic intro) */}
            {Icon && (
              <motion.div
                className={`relative w-40 h-40 rounded-full ${step.accent} flex items-center justify-center mb-10 shadow-2xl`}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* Pulse ring */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-white/20"
                  animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                />
                <Icon className={`w-20 h-20 ${step.text}`} strokeWidth={2.2} />
              </motion.div>
            )}

            <h2
              className={`font-extrabold tracking-tight mb-4 ${step.text} ${
                Icon ? "text-3xl md:text-4xl" : "text-5xl md:text-7xl leading-[1.05]"
              }`}
            >
              {t(`onboarding.steps.${step.key}.title`)}
            </h2>
            <p
              className={`leading-relaxed ${step.subtext} ${
                Icon ? "text-base md:text-lg" : "text-lg md:text-2xl mt-2"
              }`}
            >
              {t(`onboarding.steps.${step.key}.message`)}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div
        className="relative z-10 px-6 pb-6 max-w-md w-full mx-auto"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
      >
        <Button
          size="lg"
          onClick={handleNext}
          className={`w-full text-base font-extrabold py-7 rounded-2xl uppercase tracking-wide shadow-[0_4px_0_0_rgba(0,0,0,0.18)] active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(0,0,0,0.18)] transition-all ${step.buttonBg} ${step.buttonText}`}
        >
          {isLastStep ? t("onboarding.getStarted") : t("onboarding.continue")}
          <ChevronRight className="ml-1 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
