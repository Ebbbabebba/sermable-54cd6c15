import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PauseSlidersList } from "@/components/PauseSlidersList";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Calendar as CalendarIcon,
  Brain,
  BookOpen,
  Camera,
  FileText,
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Target,
  Wind,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  switchLanguageBasedOnText,
  detectTextLanguage,
} from "@/utils/languageDetection";
import { AiSpeechBuilderDialog } from "@/components/AiSpeechBuilderDialog";

interface UploadSpeechDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step =
  | "intro"
  | "title"
  | "date"
  | "text"
  | "familiarity"
  | "learning"
  | "strictness"
  | "submitting";

const ORDER: Step[] = [
  "intro",
  "title",
  "date",
  "text",
  "familiarity",
  "learning",
  "strictness",
];

const UploadSpeechDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: UploadSpeechDialogProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  // ----- form state -----
  const [step, setStep] = useState<Step>("intro");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [familiarityLevel, setFamiliarityLevel] = useState("beginner");
  const [learningMode, setLearningMode] = useState("word_by_word");
  const [strictness, setStrictness] = useState<"strict" | "flow">("strict");

  // ----- meta -----
  const [loading, setLoading] = useState(false);
  const [userTier, setUserTier] = useState<
    "free" | "student" | "regular" | "enterprise"
  >("free");
  const [wordLimit, setWordLimit] = useState(500);
  const [canCreateSpeech, setCanCreateSpeech] = useState(true);

  // ----- text-input helpers -----
  const [isScanning, setIsScanning] = useState(false);
  const [showAiBuilder, setShowAiBuilder] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setStep("intro");
    } else {
      stopCamera();
    }
  }, [open]);

  // Load tier limits when opened
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "subscription_tier, monthly_speeches_count, monthly_speeches_reset_date"
          )
          .eq("id", user.id)
          .single();
        if (profile) {
          setUserTier(profile.subscription_tier);
          const { data: limitData } = await supabase.rpc("get_word_limit", {
            p_user_id: user.id,
          });
          if (limitData) setWordLimit(limitData);
          const { data: canCreate } = await supabase.rpc("can_create_speech", {
            p_user_id: user.id,
          });
          if (canCreate !== null) setCanCreateSpeech(canCreate);
        }
      } catch (err) {
        console.error("Error loading user limits:", err);
      }
    })();
  }, [open]);

  // ----- camera / scan -----
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCamera(true);
    } catch {
      toast({
        variant: "destructive",
        title: t("upload.cameraError"),
        description: t("upload.cameraErrorDesc"),
      });
    }
  };
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    stopCamera();
    await processImageDirectly(imageData);
  };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) =>
      processImageDirectly(ev.target?.result as string);
    reader.readAsDataURL(file);
  };
  const processImageDirectly = async (imageData: string) => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-document", {
        body: { image: imageData },
      });
      if (error) throw error;
      if (data?.text) {
        handleTextChange(text ? `${text}\n\n${data.text}` : data.text);
        toast({
          title: t("upload.scanSuccess"),
          description: t("upload.scanSuccessDesc"),
        });
      } else throw new Error("No text extracted");
    } catch {
      toast({
        variant: "destructive",
        title: t("upload.scanError"),
        description: t("upload.scanErrorDesc"),
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    if (newText.length > 50) {
      const switched = switchLanguageBasedOnText(
        newText,
        i18n.language,
        i18n.changeLanguage
      );
      if (switched) {
        toast({
          title: t("common.success"),
          description: `${t("upload.languageDetected")} (${i18n.language.toUpperCase()})`,
          duration: 3000,
        });
      }
    }
  };

  // ----- progress -----
  const progressIndex = ORDER.indexOf(step);
  const progressPct =
    step === "submitting"
      ? 100
      : ((progressIndex + 1) / ORDER.length) * 100;

  const wordCount = useMemo(
    () => text.split(/\s+/).filter(Boolean).length,
    [text]
  );

  // ----- step gating -----
  const canAdvance = (): boolean => {
    switch (step) {
      case "intro":
        return true;
      case "title":
        return title.trim().length > 0;
      case "date":
        return goalDate.length > 0;
      case "text":
        return text.trim().length >= 5 && wordCount <= wordLimit;
      case "familiarity":
        return !!familiarityLevel;
      case "learning":
        return !!learningMode;
      case "strictness":
        return !!strictness;
      default:
        return false;
    }
  };

  const hapticTap = () => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10);
      }
    } catch {}
  };

  const goNext = () => {
    if (!canAdvance()) return;
    hapticTap();
    if (step === "strictness") {
      handleSubmit();
      return;
    }
    const next = ORDER[ORDER.indexOf(step) + 1];
    if (next) setStep(next);
  };
  const goBack = () => {
    hapticTap();
    const prev = ORDER[ORDER.indexOf(step) - 1];
    if (prev) setStep(prev);
  };

  // ----- submit -----
  const handleSubmit = async () => {
    if (wordCount > wordLimit) {
      toast({
        variant: "destructive",
        title: t("upload.error"),
        description:
          t("upload.wordLimitExceeded", {
            count: wordCount,
            limit: wordLimit,
          }) +
          (userTier === "free" ? " " + t("upload.wordLimitUpgrade") : ""),
      });
      return;
    }
    if (!canCreateSpeech) {
      toast({
        variant: "destructive",
        title: t("upload.limitReached"),
        description: t("upload.limitReachedDesc"),
      });
      return;
    }
    setLoading(true);
    setStep("submitting");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const detectedLanguage = detectTextLanguage(text) || "en";

      const { data: newSpeech, error } = await supabase
        .from("speeches")
        .insert({
          user_id: user.id,
          title,
          text_original: text,
          text_current: text,
          goal_date: goalDate,
          familiarity_level: familiarityLevel,
          speech_language: detectedLanguage,
          speech_type: "general",
          learning_mode: learningMode,
          practice_strictness: strictness,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: segmentError } = await supabase.functions.invoke(
        "segment-speech",
        { body: { speechId: newSpeech.id } }
      );
      if (segmentError) console.error("Segment error:", segmentError);

      if (goalDate) {
        try {
          await supabase.functions.invoke("generate-speech-schedule", {
            body: { speechId: newSpeech.id },
          });
        } catch (e) {
          console.error("Schedule error:", e);
        }
      }

      const { data: feasibilityData } = await (supabase as any).rpc(
        "assess_memorization_feasibility",
        { p_speech_id: newSpeech.id }
      );
      if (
        feasibilityData &&
        Array.isArray(feasibilityData) &&
        feasibilityData.length > 0
      ) {
        const a = feasibilityData[0];
        if (a.warning_level === "critical" || a.warning_level === "emergency") {
          toast({
            variant: "destructive",
            title: t("upload.deadlineWarning.critical"),
            description: a.message,
            duration: 8000,
          });
        } else if (a.warning_level === "challenging") {
          toast({
            title: t("upload.deadlineWarning.challenging"),
            description: a.message,
            duration: 6000,
          });
        } else if (a.warning_level === "tight") {
          toast({
            title: t("upload.deadlineWarning.tight"),
            description: a.message,
            duration: 5000,
          });
        } else {
          toast({
            title: t("upload.success"),
            description: t("upload.successDesc"),
          });
        }
      } else {
        toast({
          title: t("upload.success"),
          description: t("upload.successDesc"),
        });
      }

      // reset
      setTitle("");
      setText("");
      setGoalDate("");
      setFamiliarityLevel("beginner");
      setLearningMode("word_by_word");
      setStrictness("strict");
      onSuccess();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("upload.error"),
        description: err.message,
      });
      setStep("strictness");
    } finally {
      setLoading(false);
    }
  };

  const minDate = format(new Date(), "yyyy-MM-dd");

  // ===== step content =====
  const renderStep = () => {
    switch (step) {
      case "intro":
        return (
          <StepShell
            eyebrow={t("upload.interview.intro.eyebrow", "Let's begin")}
            title={t(
              "upload.interview.intro.title",
              "Create your speech, your way"
            )}
            subtitle={t(
              "upload.interview.intro.subtitle",
              "I'll ask a few quick questions and tailor your practice. Takes less than a minute."
            )}
          >
            <div className="flex justify-center pt-2">
              <motion.div
                className="relative"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="absolute inset-0 rounded-full bg-primary/25 blur-2xl animate-pulse" />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl">
                  <Sparkles className="w-10 h-10 text-primary-foreground" />
                </div>
              </motion.div>
            </div>
          </StepShell>
        );

      case "title":
        return (
          <StepShell
            eyebrow={t("upload.interview.title.eyebrow", "First, the basics")}
            title={t(
              "upload.interview.title.title",
              "What should we call your speech?"
            )}
            subtitle={t(
              "upload.interview.title.subtitle",
              "A short name to help you find it later."
            )}
          >
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("upload.speechTitlePlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAdvance()) {
                  e.preventDefault();
                  goNext();
                }
              }}
              className="text-lg h-14 text-center"
            />
          </StepShell>
        );

      case "date":
        return (
          <StepShell
            eyebrow={t("upload.interview.date.eyebrow", "Set your deadline")}
            title={t(
              "upload.interview.date.title",
              "When do you give the speech?"
            )}
            subtitle={t(
              "upload.interview.date.subtitle",
              "We'll plan your practice schedule around this date."
            )}
          >
            <div className="relative">
              <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                autoFocus
                type="date"
                min={minDate}
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
                className="pl-12 h-14 text-lg"
              />
            </div>
          </StepShell>
        );

      case "text":
        return (
          <StepShell
            eyebrow={t("upload.interview.text.eyebrow", "Your speech")}
            title={t(
              "upload.interview.text.title",
              "Add your text"
            )}
            subtitle={t(
              "upload.interview.text.subtitle",
              "Paste, write, scan or build with AI — whichever feels easiest."
            )}
            wide
          >
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => setShowAiBuilder(true)}
                disabled={loading || isScanning}
                className="gap-1.5"
              >
                <Sparkles className="h-4 w-4" />
                {t("upload.buildWithAi", "Build with AI")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={startCamera}
                disabled={loading || isScanning}
                className="gap-1.5"
              >
                <Camera className="h-4 w-4" />
                {t("upload.scanDocument")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || isScanning}
                className="gap-1.5"
              >
                <FileText className="h-4 w-4" />
                {t("upload.uploadImage")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {showCamera && (
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full max-h-[40vh]"
                />
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={stopCamera}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    onClick={capturePhoto}
                    className="rounded-full w-14 h-14"
                  >
                    <Camera className="h-6 w-6" />
                  </Button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}

            <div className="relative">
              {isScanning && (
                <div className="absolute inset-0 bg-background/85 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-sm font-medium">{t("upload.extracting")}</p>
                </div>
              )}
              <Textarea
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={t("upload.pasteText")}
                rows={8}
                className="resize-none text-base"
                disabled={isScanning}
              />
              <PauseSlidersList text={text} onChange={handleTextChange} />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span
                className={cn(
                  "text-muted-foreground",
                  wordCount > wordLimit && "text-destructive font-medium"
                )}
              >
                {wordCount} / {wordLimit} {t("dashboard.words")}
              </span>
              {userTier === "free" && (
                <span className="text-muted-foreground">
                  {t("upload.wordLimit")}
                </span>
              )}
            </div>
          </StepShell>
        );

      case "familiarity":
        return (
          <StepShell
            eyebrow={t(
              "upload.interview.familiarity.eyebrow",
              "Your starting point"
            )}
            title={t(
              "upload.interview.familiarity.title",
              "How well do you know the text already?"
            )}
            subtitle={t(
              "upload.interview.familiarity.subtitle",
              "We'll adjust the difficulty so practice feels right from day one."
            )}
          >
            <div className="grid gap-3">
              {[
                {
                  id: "beginner",
                  label: t("upload.familiarity.beginner"),
                  desc: t(
                    "upload.interview.familiarity.beginnerDesc",
                    "Brand new — I'm reading it for the first time."
                  ),
                },
                {
                  id: "intermediate",
                  label: t("upload.familiarity.intermediate"),
                  desc: t(
                    "upload.interview.familiarity.intermediateDesc",
                    "I've read it a few times and know the gist."
                  ),
                },
                {
                  id: "confident",
                  label: t("upload.familiarity.confident"),
                  desc: t(
                    "upload.interview.familiarity.confidentDesc",
                    "I almost know it — I just need polish."
                  ),
                },
              ].map((opt) => (
                <Choice
                  key={opt.id}
                  active={familiarityLevel === opt.id}
                  onClick={() => setFamiliarityLevel(opt.id)}
                  label={opt.label}
                  description={opt.desc}
                />
              ))}
            </div>
          </StepShell>
        );

      case "learning":
        return (
          <StepShell
            eyebrow={t("upload.interview.learning.eyebrow", "Your style")}
            title={t(
              "upload.interview.learning.title",
              "How do you want to learn it?"
            )}
            subtitle={t(
              "upload.interview.learning.subtitle",
              "You can change this later."
            )}
          >
            <div className="grid gap-3">
              <Choice
                active={learningMode === "word_by_word"}
                onClick={() => setLearningMode("word_by_word")}
                icon={<Brain className="w-5 h-5" />}
                label={t("upload.learningMode.wordByWord")}
                description={t("upload.learningMode.wordByWordDesc")}
              />
              <Choice
                active={learningMode === "general_overview"}
                onClick={() => setLearningMode("general_overview")}
                icon={<BookOpen className="w-5 h-5" />}
                label={t("upload.learningMode.generalOverview")}
                description={t("upload.learningMode.generalOverviewDesc")}
              />
            </div>
          </StepShell>
        );

      case "strictness":
        return (
          <StepShell
            eyebrow={t("upload.interview.strictness.eyebrow", "Last one")}
            title={t(
              "upload.interview.strictness.title",
              "How strict should practice be?"
            )}
            subtitle={t(
              "upload.interview.strictness.subtitle",
              "Strict trains exact words. Flow rewards meaning over precision."
            )}
          >
            <div className="grid gap-3">
              <Choice
                active={strictness === "strict"}
                onClick={() => setStrictness("strict")}
                icon={<Target className="w-5 h-5" />}
                label={t("upload.interview.strictness.strict", "Strict")}
                description={t(
                  "upload.interview.strictness.strictDesc",
                  "Every word matters. Best for memorization."
                )}
              />
              <Choice
                active={strictness === "flow"}
                onClick={() => setStrictness("flow")}
                icon={<Wind className="w-5 h-5" />}
                label={t("upload.interview.strictness.flow", "Flow")}
                description={t(
                  "upload.interview.strictness.flowDesc",
                  "Get the meaning across. Best for natural delivery."
                )}
              />
            </div>
          </StepShell>
        );

      case "submitting":
        return (
          <div className="flex flex-col items-center justify-center py-16 gap-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/40 blur-3xl animate-pulse" />
              <Loader2 className="relative h-14 w-14 text-primary animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-xl font-semibold">
                {t("upload.interview.creating", "Crafting your speech…")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(
                  "upload.interview.creatingDesc",
                  "Segmenting, scheduling and tuning your plan."
                )}
              </p>
            </div>
          </div>
        );
    }
  };

  if (!open && !showAiBuilder) {
    // unmount overlay when closed (AI builder may still need state)
  }

  const overlay = open
    ? createPortal(
        <AnimatePresence>
          <motion.div
            key="upload-overlay"
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) onOpenChange(false);
            }}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute z-20 w-10 h-10 rounded-full bg-card/70 hover:bg-card border border-border/50 flex items-center justify-center backdrop-blur-md transition"
              style={{
                top: "calc(env(safe-area-inset-top, 0px) + 1rem)",
                right: "calc(env(safe-area-inset-right, 0px) + 1rem)",
              }}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Progress */}
            {step !== "submitting" && (
              <div
                className="absolute left-1/2 -translate-x-1/2 w-[min(360px,60vw)] z-10"
                style={{ top: "calc(env(safe-area-inset-top, 0px) + 1.4rem)" }}
              >
                <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={false}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            {/* Card scroll area */}
            <div
              className="absolute inset-0 overflow-y-auto"
              style={{
                paddingTop: "calc(env(safe-area-inset-top, 0px) + 4.5rem)",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full max-w-2xl mx-auto px-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.98 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="rounded-3xl bg-card/95 border border-border/60 shadow-2xl backdrop-blur-md p-6 sm:p-10"
                  >
                    {renderStep()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Footer nav */}
            {step !== "submitting" && (
              <div
                className="absolute bottom-0 left-0 right-0 z-10 border-t border-border/50 bg-background/80 backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="max-w-2xl mx-auto flex items-center justify-between px-5 py-4"
                  style={{
                    paddingBottom:
                      "calc(1rem + env(safe-area-inset-bottom, 0px))",
                  }}
                >
                  <Button
                    variant="ghost"
                    onClick={goBack}
                    disabled={progressIndex === 0}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {t("upload.interview.back", "Back")}
                  </Button>
                  <Button
                    onClick={goNext}
                    disabled={!canAdvance() || loading}
                    size="lg"
                    className="gap-1.5 min-w-32"
                  >
                    {step === "intro" && (
                      <>
                        {t("upload.interview.start", "Start")}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                    {step === "strictness" && (
                      <>
                        <Check className="w-4 h-4" />
                        {t("upload.interview.create", "Create speech")}
                      </>
                    )}
                    {step !== "intro" && step !== "strictness" && (
                      <>
                        {t("upload.interview.next", "Continue")}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>,
        document.body
      )
    : null;

  return (
    <>
      {overlay}

      <AiSpeechBuilderDialog
        open={showAiBuilder}
        onOpenChange={setShowAiBuilder}
        language={i18n.language}
        onDraftReady={({ title: aiTitle, speech: aiSpeech }) => {
          if (aiTitle && !title.trim()) setTitle(aiTitle);
          handleTextChange(aiSpeech);
        }}
      />
    </>
  );
};

// ============= helpers =============

const StepShell = ({
  eyebrow,
  title,
  subtitle,
  children,
  wide,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}) => (
  <div className={cn("space-y-6", wide ? "" : "max-w-md mx-auto")}>
    <motion.div
      className="text-center space-y-2"
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
      }}
    >
      <motion.p
        variants={{
          hidden: { opacity: 0, y: 8 },
          show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
        }}
        className="text-xs font-medium uppercase tracking-[0.18em] text-primary/80"
      >
        {eyebrow}
      </motion.p>
      <motion.h2
        variants={{
          hidden: { opacity: 0, y: 10 },
          show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
        }}
        className="text-2xl sm:text-3xl font-bold tracking-tight"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          variants={{
            hidden: { opacity: 0, y: 10 },
            show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
          }}
          className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto"
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  </div>
);

const Choice = ({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  description: string;
}) => (
  <motion.button
    type="button"
    onClick={() => {
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(8);
        }
      } catch {}
      onClick();
    }}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    whileHover={{ scale: 1.015 }}
    whileTap={{ scale: 0.98 }}
    className={cn(
      "w-full text-left p-4 rounded-2xl border transition-colors flex items-start gap-3",
      active
        ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md"
        : "border-border bg-card hover:border-primary/40 hover:bg-accent/40"
    )}
  >
    {icon && (
      <div
        className={cn(
          "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-sm sm:text-base">{label}</div>
      <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug">
        {description}
      </div>
    </div>
    {active && (
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
      >
        <Check className="w-5 h-5 text-primary shrink-0 mt-1" strokeWidth={3} />
      </motion.div>
    )}
  </motion.button>
);

export default UploadSpeechDialog;
