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
            "mx-0.5 px-1.5 py-0.5 rounded font-semibold",
            highlight === "hidden"
              ? "bg-primary/30 text-primary ring-1 ring-primary/60"
              : "bg-muted/50 text-muted-foreground/70",
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
            "mx-1 italic text-sm",
            highlight === "direction"
              ? "text-primary font-semibold"
              : "text-muted-foreground/80",
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
            "mx-1 px-2 py-0.5 rounded-full text-xs",
            highlight === "pause"
              ? "bg-primary/20 text-primary ring-1 ring-primary"
              : "bg-muted/40 text-muted-foreground",
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
          "px-0.5",
          cueActive && highlight === "cue" && "rounded",
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
  return <p className="text-base md:text-lg leading-loose">{nodes}</p>;
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
        "Sermable has a handful of small marks you can sprinkle in your script to make practice and presentation feel alive. Takes 20 seconds.",
      demo: () => (
        <div className="flex items-center justify-center">
          <Sparkle className="h-16 w-16 text-primary animate-pulse" />
        </div>
      ),
    },
    {
      id: "direction",
      titleKey: "tour.direction.title",
      titleFallback: "Stage directions",
      bodyKey: "tour.direction.body",
      bodyFallback:
        "Select any words in the editor and write what to do — like “smile” or “raise hand”. The words get a soft highlight, and the direction floats above your script in its own color while you read it.",
      demo: () => (
        <ScriptDemo
          text="Tack alla {{smile}}för att ni kom hit{{/}} ikväll."
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
          text="I want to ask you something. -3 Are you ready?"
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
        <div className="flex items-center justify-center">
          <Check className="h-16 w-16 text-primary" />
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
        className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-xl flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{ height: "100dvh" }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-between px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <div className="text-xs text-muted-foreground">
            {step + 1} / {steps.length}
          </div>
          <button
            type="button"
            onClick={close}
            className="w-9 h-9 rounded-full bg-card/70 border border-border/50 flex items-center justify-center"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl space-y-6 text-center"
            >
              <div className="rounded-2xl border border-border/60 bg-card/80 p-6 min-h-[140px] flex items-center justify-center">
                {s.demo()}
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {t(s.titleKey, s.titleFallback)}
                </h2>
                <p className="text-muted-foreground text-base leading-relaxed">
                  {t(s.bodyKey, s.bodyFallback)}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex-shrink-0 border-t border-border/50 bg-background/80 backdrop-blur-xl">
          <div
            className="max-w-xl mx-auto flex items-center justify-between gap-3 px-4 pt-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <Button
              variant="ghost"
              onClick={() => setStep((p) => Math.max(0, p - 1))}
              disabled={isFirst}
              className="gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("tour.back", "Back")}
            </Button>
            <button
              type="button"
              onClick={close}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t("tour.skip", "Skip")}
            </button>
            <Button
              onClick={() => (isLast ? close() : setStep((p) => p + 1))}
              size="lg"
              className="gap-1.5 min-w-28"
            >
              {isLast ? (
                <>
                  <Check className="w-4 h-4" />
                  {t("tour.done", "Got it")}
                </>
              ) : (
                <>
                  {t("tour.next", "Next")}
                  <ArrowRight className="w-4 h-4" />
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
