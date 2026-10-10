import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, MessageCircle, GraduationCap, TrendingUp, Theater } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const STEPS = [
  { key: "welcome", icon: null },
  { key: "practice", icon: MessageCircle },
  { key: "adaptive", icon: GraduationCap },
  { key: "learning", icon: TrendingUp },
  { key: "presentation", icon: Theater },
];
const Onboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const step = STEPS[currentStep] ?? STEPS[0];
  const Icon = step.icon;
  const isLastStep = currentStep === STEPS.length - 1;
  const finish = () => { localStorage.setItem("onboarding_complete", "true"); navigate("/auth"); };
  const next = () => { if (isLastStep) finish(); else setCurrentStep(p => p + 1); };
  useEffect(() => {
    let startX = 0;
    const start = (e: TouchEvent) => { startX = e.touches[0]?.clientX ?? 0; };
    const end = (e: TouchEvent) => {
      const x = e.changedTouches[0]?.clientX;
      if (x === undefined) return;
      const dx = x - startX;
      if (dx < -60) setCurrentStep(p => Math.min(p + 1, STEPS.length - 1));
      if (dx > 60) setCurrentStep(p => Math.max(p - 1, 0));
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    return () => { window.removeEventListener("touchstart", start); window.removeEventListener("touchend", end); };
  }, []);
  return (
    <div className={`onboarding onboarding--${step.key}`}>
      <header className="onboarding__header">
        <div className="onboarding__progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={currentStep + 1} aria-label={t("onboarding.continue")}>
          {STEPS.map((s, i) => <span key={s.key} className={`onboarding__track ${i <= currentStep ? "is-complete" : ""}`} />)}
        </div>
        <Button variant="ghost" size="sm" className="onboarding__skip" onClick={finish}>{t("onboarding.skip")}</Button>
      </header>
      <main className="onboarding__main">
        <AnimatePresence mode="wait">
          <motion.div key={step.key} className="onboarding__content" initial={{ opacity: reducedMotion ? 1 : 0, x: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: reducedMotion ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
            <span className="onboarding__step">{String(currentStep + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}</span>
            {Icon && <div className="onboarding__icon"><Icon aria-hidden="true" /></div>}
            <h1 className={`onboarding__title ${Icon ? "" : "onboarding__title--brand"}`}>{t(`onboarding.steps.${step.key}.title`)}</h1>
            <p className="onboarding__message">{t(`onboarding.steps.${step.key}.message`)}</p>
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="onboarding__footer">
        <Button size="lg" className="onboarding__next" onClick={next}>{isLastStep ? t("onboarding.getStarted") : t("onboarding.continue")}<ChevronRight aria-hidden="true" /></Button>
      </footer>
    </div>
  );
};
export default Onboarding;
