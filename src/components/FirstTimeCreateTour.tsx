import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, X, Check, Lightbulb } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sermable.tour.create.v1";

interface FirstTimeCreateTourProps {
  /** Force-open the tour regardless of localStorage flag. */
  forceOpen?: boolean;
  onClose?: () => void;
}

interface DemoStep {
  id: string;
  titleKey: string;
  titleFallback: string;
  bodyKey: string;
  bodyFallback: string;
  demo: () => JSX.Element;
}

/** Mini-renderer: highlight `[hidden]`, `(direction)`, `-pause-` and `{{cue}}…{{/}}`. */
const ScriptDemo = ({
  text,
  highlight,
}: {
  text: string;
  highlight: "hidden" | "direction" | "cue" | "pause" | "none";
}) => {
  // Walk text into nodes
  const nodes: JSX.Element[] = [];
  const TOKEN_RE =
    /\{\{\/\}\}|\{\{([^{}]+)\}\}|\[([^\[\]]+)\]|\(([^()]*)\)|-(\d{1,2})?s?(?=\s|$)|\s+|[^\s\[\]{}()-]+/g;
  let m: RegExpExecArray | null;
  let i = 0;
  let cueActive: string | null = null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const tok = m[0];
    if (tok === "{{/}}") {
      cueActive = null;
      continue;
    }
    if (m[1] !== undefined) {
      cueActive = m[1].trim();
      continue;
    }
    if (m[2] !== undefined) {
      nodes.push(
        <span
          key={i++}
          className={cn(
            "s-m3 s-om s-ox s-q8 s-d3",
            highlight === "hidden"
              ? "s-5h s-uw s-pl s-q0"
              : "s-56 s-up",
          )}
        >
          {"•".repeat(Math.max(1, Math.ceil(m[2].length / 2)))}
        </span>,
      );
      continue;
    }
    if (m[3] !== undefined) {
      nodes.push(
        <span
          key={i++}
          className={cn(
            "s-m4 italic s-v9",
            highlight === "direction"
              ? "s-uw s-d3"
              : "s-uq",
          )}
        >
          ({m[3]})
        </span>,
      );
      continue;
    }
    if (/^-(\d{1,2})?s?$/.test(tok)) {
      nodes.push(
        <span
          key={i++}
          className={cn(
            "s-m4 s-op s-ox s-qe s-vj",
            highlight === "pause"
              ? "s-5g s-uw s-pl s-pw"
              : "s-55 s-ul",
          )}
        >
          —
        </span>,
      );
      continue;
    }
    if (/^\s+$/.test(tok)) {
      nodes.push(<span key={i++}> </span>);
      continue;
    }
    nodes.push(
      <span
        key={i++}
        className={cn(
          "s-ok",
          cueActive && highlight === "cue" && "s-q8",
        )}
        style={
          cueActive && highlight === "cue"
            ? { backgroundColor: "hsl(var(--prop-cue-bg-strong))", color: "hsl(var(--prop-cue-fg))" }
            : undefined
        }
      >
        {tok}
      </span>,
    );
  }
  return <p className="s-tw s-kp s-in">{nodes}</p>;
};

const FirstTimeCreateTour = ({ forceOpen = false, onClose }: FirstTimeCreateTourProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      return;
    }
    try {
      const seen = typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {}
  }, [forceOpen]);

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setOpen(false);
    onClose?.();
  };

  const steps: DemoStep[] = [
    {
      id: "welcome",
      titleKey: "tour.welcome.title",
      titleFallback: "A few tricks before you start",
      bodyKey: "tour.welcome.body",
      bodyFallback:
        "Learn Sermable's text features to make your practice and presentation come alive.",
      demo: () => (
        <div className="s-c5 s-ib s-ig">
          <Lightbulb className="s-fr s-xj s-uw s-30" />
        </div>
      ),
    },
    {
      id: "direction",
      titleKey: "tour.direction.title",
      titleFallback: "Stage directions",
      bodyKey: "tour.direction.body",
      bodyFallback:
        "Select any words in the editor and write what to do — like “smile” or “raise hand”. The direction appears above your script while you present.",
      demo: () => (
        <ScriptDemo
          text={t("tour.direction.demoText", "Tack alla {{smile}}för att ni kom hit{{/}} ikväll.")}
          highlight="cue"
        />
      ),
    },
    {
      id: "pause",
      titleKey: "tour.pause.title",
      titleFallback: "Pauses with a single dash",
      bodyKey: "tour.pause.body",
      bodyFallback:
        "Add a standalone `-` for a 2-second pause, or `-5s` for a custom length. Practice will dim the screen and count down for you.",
      demo: () => (
        <ScriptDemo
          text={t("tour.pause.demoText", "I want to ask you something. -3 Are you ready?")}
          highlight="pause"
        />
      ),
    },
    {
      id: "complete",
      titleKey: "tour.complete.title",
      titleFallback: "You're set",
      bodyKey: "tour.complete.body",
      bodyFallback:
        "Mix any of these marks freely. You can edit them later in the script too.",
      demo: () => (
        <div className="s-c5 s-ib s-ig">
          <Check className="s-fr s-xj s-uw" />
        </div>
      ),
    },
  ];

  if (!open) return null;

  const s = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="tour-overlay"
        className="s-c4 s-i5 s-yk s-42 s-3i s-c5 s-c7"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{ height: "100dvh" }}
      >
        <div
          className="s-ca s-c5 s-ib s-if s-os"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <div className="s-vj s-ul">
            {step + 1} / {steps.length}
          </div>
          <button
            type="button"
            onClick={close}
            className="s-y2 s-g8 s-qe s-4d s-6l s-70 s-c5 s-ib s-ig"
            aria-label="Close tour"
          >
            <X className="s-fz s-xt" />
          </button>
        </div>

        <div className="s-c6 s-ku s-mq s-os s-p9 s-c5 s-ib s-ig">
          <AnimatePresence mode="wait">
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="s-y7 s-jt s-t3 s-u0"
            >
              <div className="s-q9 s-6l s-71 s-4e s-my s-kz s-c5 s-ib s-ig">
                {s.demo()}
              </div>
              <div className="s-sy">
                <h2 className="s-t9 s-sh s-cx s-wh">
                  {t(s.titleKey, s.titleFallback)}
                </h2>
                <p className="s-ul s-tw s-ip">
                  {t(s.bodyKey, s.bodyFallback)}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="s-ca s-82 s-70 s-40 s-3i">
          <div
            className="s-jt s-m9 s-c5 s-ib s-if s-dp s-os s-oc"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <Button
              variant="ghost"
              onClick={() => setStep((p) => Math.max(0, p - 1))}
              disabled={isFirst}
              className="s-dm"
            >
              <ArrowLeft className="s-xt s-fz" />
              {t("tour.back", "Back")}
            </Button>
            <button
              type="button"
              onClick={close}
              className="s-vj s-ul s-wz s-i1"
            >
              {t("tour.skip", "Skip")}
            </button>
            <Button
              onClick={() => (isLast ? close() : setStep((p) => p + 1))}
              size="lg"
              className="s-dm s-l9"
            >
              {isLast ? (
                <>
                  <Check className="s-xt s-fz" />
                  {t("tour.done", "Got it")}
                </>
              ) : (
                <>
                  {t("tour.next", "Next")}
                  <ArrowRight className="s-xt s-fz" />
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

export default FirstTimeCreateTour;
