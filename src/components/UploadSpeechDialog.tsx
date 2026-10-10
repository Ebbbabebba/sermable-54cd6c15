import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Capacitor } from "@capacitor/core";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";

import { PauseSlidersList } from "@/components/PauseSlidersList";
import { supabase } from "@/integrations/supabase/client";
import { FORCE_PREMIUM } from "@/lib/premiumOverride";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Calendar as CalendarIcon,
  Brain,
  BookOpen,
  Camera,
  FileText,
  X,
  Wand2,
  ArrowRight,
  ArrowLeft,
  Target,
  Wind,
  Check,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
// Language detection pulls in the heavy `franc` dataset — load it on demand.
const loadLanguageDetection = () => import("@/utils/languageDetection");

import { AiSpeechBuilderDialog } from "@/components/AiSpeechBuilderDialog";
import PropCueTextarea from "@/components/PropCueTextarea";
import FirstTimeCreateTour from "@/components/FirstTimeCreateTour";


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

  // ----- camera / scan -----
  const startCamera = async () => {
    // On native (iOS/Android) use Capacitor Camera — the WebView getUserMedia
    // path renders black and lacks a proper permission prompt on iOS.
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await CapCamera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });
        if (photo.dataUrl) {
          await processImageDirectly(photo.dataUrl);
        }
      } catch (err: any) {
        // User cancelled — silent. Real errors → inline toast.
        if (err?.message && !/cancel/i.test(err.message)) {
          toast({
            variant: "destructive",
            title: t("upload.cameraError"),
            description: err.message || t("upload.cameraErrorDesc"),
          });
        }
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setShowCamera(true);
      // Attach stream on next tick so the <video> is mounted, then explicitly play().
      setTimeout(async () => {
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        v.muted = true;
        v.setAttribute("playsinline", "true");
        try {
          await v.play();
        } catch (e) {
          console.warn("video.play() failed:", e);
        }
      }, 0);
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
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      // Normalize to JPEG so Gemini reliably accepts the data URL (handles HEIC, PNG, webp, etc.)
      try {
        const img = new Image();
        img.src = dataUrl;
        await new Promise((res, rej) => {
          img.onload = () => res(null);
          img.onerror = rej;
        });
        const canvas = document.createElement("canvas");
        const maxDim = 2000;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no ctx");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        await processImageDirectly(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        await processImageDirectly(dataUrl);
      }
    };
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
      loadLanguageDetection().then(({ switchLanguageBasedOnText }) => {
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
      }).catch(() => {});
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
        return text.trim().length >= 5;
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
    setLoading(true);
    setStep("submitting");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Not authenticated");
      // For short texts (e.g. "kolla en bana"), franc cannot reliably detect.
      // Fall back to the user's current UI language rather than hard-coding "en",
      // otherwise Swedish short speeches get tagged English and speech
      // recognition uses en-US — no words ever turn blue.
      const { detectTextLanguage } = await loadLanguageDetection();
      const detectedLanguage =
        detectTextLanguage(text) || (i18n.language?.split("-")[0] ?? "en");

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
            <div />
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
              className="s-uk s-fq s-u0"
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
            <div className="s-pd">
              <CalendarIcon className="s-26 s-iw s-w4 s-9 s-g1 s-xv s-ul s-nx s-ye" />
              <Input
                autoFocus
                type="date"
                min={minDate}
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
                className="s-nr s-o2 s-fq s-uk s-3v s-u9 s-6x s-qo s-y7 appearance-none s-b s-a s-c"
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
            <div className="s-c5 s-cb s-dn s-ig">
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => setShowAiBuilder(true)}
                disabled={loading || isScanning}
                className="s-dm"
              >
                <Wand2 className="s-fz s-xt" />
                {t("upload.buildWithAi", "Build with AI")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={startCamera}
                disabled={loading || isScanning}
                className="s-dm"
              >
                <Camera className="s-fz s-xt" />
                {t("upload.scanDocument")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || isScanning}
                className="s-dm"
              >
                <FileText className="s-fz s-xt" />
                {t("upload.uploadImage")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="s-gm"
              />
            </div>

            {showCamera && (
              <div className="s-pd s-qo s-mn s-44">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="s-y7 s-j8"
                />
                <div className="s-26 s-8d s-is s-pe s-c5 s-ig s-dp">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={stopCamera}
                  >
                    <X className="s-g1 s-xv" />
                  </Button>
                  <Button
                    type="button"
                    onClick={capturePhoto}
                    className="s-qe s-xi s-fq"
                  >
                    <Camera className="s-g2 s-xw" />
                  </Button>
                </div>
                <canvas ref={canvasRef} className="s-gm" />
              </div>
            )}

            <div className="s-pd">
              {isScanning && (
                <div className="s-26 s-i5 s-41 s-3h s-qo s-c5 s-c7 s-ib s-ig s-ye">
                  <Loader2 className="s-g6 s-y0 s-32 s-uw s-jy" />
                  <p className="s-v9 s-d0">{t("upload.extracting")}</p>
                </div>
              )}
              <PropCueTextarea
                value={text}
                onChange={handleTextChange}
                placeholder={t("upload.pasteText")}
                rows={8}
                disabled={isScanning}
              />
              <PauseSlidersList text={text} onChange={handleTextChange} />
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
            <div className="s-e0 s-dp">
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
            <div className="s-e0 s-dp">
              <Choice
                active={learningMode === "word_by_word"}
                onClick={() => setLearningMode("word_by_word")}
                icon={<Brain className="s-xv s-g1" />}
                label={t("upload.learningMode.wordByWord")}
                description={t("upload.learningMode.wordByWordDesc")}
              />
              <Choice
                active={learningMode === "general_overview"}
                onClick={() => setLearningMode("general_overview")}
                icon={<BookOpen className="s-xv s-g1" />}
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
            <div className="s-e0 s-dp">
              <Choice
                active={strictness === "strict"}
                onClick={() => setStrictness("strict")}
                icon={<Target className="s-xv s-g1" />}
                label={t("upload.interview.strictness.strict", "Strict")}
                description={t(
                  "upload.interview.strictness.strictDesc",
                  "Every word matters. Best for memorization."
                )}
              />
              <Choice
                active={strictness === "flow"}
                onClick={() => setStrictness("flow")}
                icon={<Wind className="s-xv s-g1" />}
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
          <div className="s-c5 s-c7 s-ib s-ig s-p2 s-dr">
            <Loader2 className="s-fn s-xf s-uw s-32" strokeWidth={1.5} />

            <div className="s-u0 s-sw">
              <h3 className="s-vi s-d3">
                {t("upload.interview.creating", "Crafting your speech…")}
              </h3>
              <p className="s-v9 s-ul">
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
            className="s-c4 s-i5 s-yh s-3z s-3i s-c5 s-c7"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ height: "100dvh" }}
          >
            {/* Top bar: progress + close */}
            <div
              className="s-ca s-c5 s-ib s-dp s-os s-n6"
              style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
            >
              {step !== "submitting" ? (
                <div className="s-c6 s-fm s-qe s-56 s-mn">
                  <motion.div
                    className="s-gg s-5c"
                    initial={false}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              ) : (
                <div className="s-c6" />
              )}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="s-ca s-y2 s-g8 s-qe s-4d s-gu s-6l s-70 s-c5 s-ib s-ig s-3f s-wl"
                aria-label="Close"
              >
                <X className="s-fz s-xt" />
              </button>
            </div>

            {/* Card scroll area — center the card vertically when it fits */}
            <div className="s-c6 s-ku s-mq overscroll-contain">
              <div className="s-l5 s-y7 s-c5 s-ib s-ig s-os s-s9 s-p7">
                <div
                  className="s-y7 s-jc"
                  onClick={(e) => e.stopPropagation()}
                >

                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.98 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="s-qa s-4f s-6l s-71 s-qr s-3f s-mx s-s5"
                  >
                    {renderStep()}
                  </motion.div>
                </AnimatePresence>
                </div>
              </div>
            </div>


            {/* Footer nav */}
            {step !== "submitting" && (
              <div className="s-ca s-82 s-70 s-40 s-3i">
                <div
                  className="s-jc s-m9 s-c5 s-ib s-if s-dp s-os s-s9 s-oc"
                  style={{
                    paddingBottom:
                      "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
                  }}
                >
                  <Button
                    variant="ghost"
                    onClick={goBack}
                    disabled={progressIndex === 0}
                    className="s-dm"
                  >
                    <ArrowLeft className="s-xt s-fz" />
                    {t("upload.interview.back", "Back")}
                  </Button>
                  <Button
                    onClick={goNext}
                    disabled={!canAdvance() || loading}
                    size="lg"
                    className="s-dm s-la"
                  >
                    {step === "intro" && (
                      <>
                        {t("upload.interview.start", "Start")}
                        <ArrowRight className="s-xt s-fz" />
                      </>
                    )}
                    {step === "strictness" && (
                      <>
                        <Check className="s-xt s-fz" />
                        {t("upload.interview.create", "Create speech")}
                      </>
                    )}
                    {step !== "intro" && step !== "strictness" && (
                      <>
                        {t("upload.interview.next", "Continue")}
                        <ArrowRight className="s-xt s-fz" />
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

      {open && <FirstTimeCreateTour />}

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
  <div className={cn("s-t3", wide ? "" : "s-jq s-m9")}>
    <motion.div
      className="s-u0 s-sy"
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
        className="s-vj s-d0 s-x1 s-we s-uy"
      >
        {eyebrow}
      </motion.p>
      <motion.h2
        variants={{
          hidden: { opacity: 0, y: 10 },
          show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
        }}
        className="s-t9 s-sh s-cx s-wh"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          variants={{
            hidden: { opacity: 0, y: 10 },
            show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
          }}
          className="s-v9 s-ul s-ip s-jq s-m9"
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
    <motion.div
      className="s-t1"
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
    whileTap={{ scale: 0.97 }}
    className={cn(
      "s-y7 s-uj s-ot s-p7 s-q9 s-6n s-ws s-c5 s-ib s-dq",
      active
        ? "s-7n s-5j"
        : "s-6x s-4b s-hh"
    )}
  >
    {icon && (
      <div
        className={cn(
          "s-r5 s-xg s-fo s-qo s-c5 s-ib s-ig s-ws",
          active
            ? "s-5c s-ux"
            : "s-50 s-ul"
        )}
      >
        {icon}
      </div>
    )}
    <div className="s-c6 s-l8">
      <div className="s-d3 s-v9 s-sj">{label}</div>
      <div className="s-vj s-sl s-ul s-ls s-iq">
        {description}
      </div>
    </div>
    <div
      className={cn(
        "s-r5 s-xw s-g2 s-qe s-6n s-c5 s-ib s-ig s-ws",
        active ? "s-7n s-5c" : "s-6x"
      )}
    >
      {active && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
        >
          <Check className="s-xq s-fx s-ux" strokeWidth={3.5} />
        </motion.div>
      )}
    </div>
  </motion.button>
);

export default UploadSpeechDialog;
