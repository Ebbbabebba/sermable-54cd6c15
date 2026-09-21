import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { convertPauseDirectionsToMarkers } from "@/utils/pauses";
import LoadingOverlay from "@/components/LoadingOverlay";

interface AiSpeechBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language?: string;
  /** Called when the user accepts the generated draft. */
  onDraftReady: (payload: { title: string; speech: string }) => void;
}

type Step = "prompt" | "questions" | "preview";

interface QA {
  question: string;
  answer: string;
}

export const AiSpeechBuilderDialog = ({
  open,
  onOpenChange,
  language = "en",
  onDraftReady,
}: AiSpeechBuilderDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("prompt");
  const [prompt, setPrompt] = useState("");
  const [targetMinutes, setTargetMinutes] = useState<number>(3);
  const [qa, setQa] = useState<QA[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSpeech, setDraftSpeech] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRichLoading, setShowRichLoading] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowRichLoading(false);
      return;
    }

    const timer = setTimeout(() => setShowRichLoading(true), 700);
    return () => clearTimeout(timer);
  }, [loading]);

  const reset = () => {
    setStep("prompt");
    setPrompt("");
    setTargetMinutes(3);
    setQa([]);
    setDraftTitle("");
    setDraftSpeech("");
    setLoading(false);
  };

  const lengthOptions = [1, 2, 3, 5, 7, 10];

  const closeAndReset = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const fetchQuestions = async () => {
    const trimmed = prompt.trim();
    if (trimmed.length < 5) {
      toast({
        title: t("aiBuilder.tooShortTitle", "Berätta lite mer"),
        description: t(
          "aiBuilder.tooShortDesc",
          "Skriv en kort mening om vad det är för tal.",
        ),
      });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("build-speech", {
        body: { mode: "questions", prompt: trimmed, language },
      });
      if (error) throw error;
      const questions: string[] = Array.isArray(data?.questions)
        ? data.questions
        : [];
      if (questions.length === 0) {
        // No clarification needed → skip straight to draft
        await fetchDraft([], trimmed);
        return;
      }
      setQa(questions.map((q) => ({ question: q, answer: "" })));
      setStep("questions");
    } catch (err) {
      console.error("build-speech questions failed:", err);
      toast({
        variant: "destructive",
        title: t("aiBuilder.errorTitle", "AI svarade inte"),
        description: String((err as Error)?.message ?? err),
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDraft = async (answers: QA[], promptOverride?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("build-speech", {
        body: {
          mode: "draft",
          prompt: promptOverride ?? prompt,
          language,
          answers,
          targetMinutes,
        },
      });
      if (error) throw error;
      setDraftTitle((data?.title as string) || "");
      setDraftSpeech(
        convertPauseDirectionsToMarkers((data?.speech as string) || ""),
      );
      setStep("preview");
    } catch (err) {
      console.error("build-speech draft failed:", err);
      toast({
        variant: "destructive",
        title: t("aiBuilder.errorTitle", "AI svarade inte"),
        description: String((err as Error)?.message ?? err),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    onDraftReady({
      title: draftTitle.trim(),
      speech: draftSpeech.trim(),
    });
    closeAndReset(false);
  };

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
      <LoadingOverlay isVisible={showRichLoading} />
      <DialogContent
        overlayClassName="!z-[60] bg-background/65 backdrop-blur-none"
        className="!z-[70] !inset-0 sm:!inset-auto sm:!left-1/2 sm:!top-1/2 !grid-rows-[auto_minmax(0,1fr)_auto] w-full max-w-[100dvw] h-[100dvh] min-h-0 sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:h-auto sm:max-h-[min(86dvh,720px)] !translate-x-0 !translate-y-0 sm:!-translate-x-1/2 sm:!-translate-y-1/2 overflow-hidden rounded-none sm:rounded-3xl border-border/60 bg-card p-0 shadow-2xl backdrop-blur-none"
      >
        <DialogHeader className="min-w-0 px-[max(1.25rem,env(safe-area-inset-left))] pr-[max(3.5rem,calc(1.25rem+env(safe-area-inset-right)))] sm:px-6 pt-[max(1.25rem,env(safe-area-inset-top))] sm:pt-6 pb-3 border-b border-border/60 shrink-0 text-left">
          <DialogTitle className="flex min-w-0 items-center gap-2 leading-snug">
            <Wand2 className="h-5 w-5 text-primary" />
            {t("aiBuilder.title", "Bygg tal med AI")}
          </DialogTitle>
          <DialogDescription className="leading-snug">
            {step === "prompt" &&
              t(
                "aiBuilder.promptDesc",
                "Beskriv vilket tal du vill ha. AI ställer några korta frågor och skriver sedan ett utkast åt dig.",
              )}
            {step === "questions" &&
              t(
                "aiBuilder.questionsDesc",
                "Svara så detaljerat eller kort du vill — du kan hoppa över frågor.",
              )}
            {step === "preview" &&
              t(
                "aiBuilder.previewDesc",
                "Redigera utkastet fritt. När du är nöjd, klicka Använd.",
              )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:px-6 py-4 [-webkit-overflow-scrolling:touch]">
        {step === "prompt" && (
          <div className="space-y-3 py-2">
            <Label htmlFor="ai-prompt">
              {t("aiBuilder.promptLabel", "Vad är det för tal?")}
            </Label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t(
                "aiBuilder.promptPlaceholder",
                "Skriv ett tal till min brors bröllop. Han är 32, jag har känt honom hela mitt liv. Vill att det ska vara varmt och lite roligt.",
              )}
              rows={6}
              className="min-h-36 resize-none"
              disabled={loading}
            />
            <div className="space-y-2 pt-2">
              <Label>
                {t("aiBuilder.lengthLabel", "Ungefärlig längd")}
              </Label>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                {lengthOptions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTargetMinutes(m)}
                    disabled={loading}
                    className={`min-w-0 px-2 py-2 rounded-full border text-sm transition ${
                      targetMinutes === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted"
                    }`}
                  >
                    {m} {t("aiBuilder.minutesShort", "min")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "questions" && (
          <div className="space-y-4 py-2">
            {qa.map((item, i) => (
              <div key={i} className="space-y-2">
                <Label htmlFor={`q-${i}`} className="leading-snug">
                  {item.question}
                </Label>
                <Textarea
                  id={`q-${i}`}
                  value={item.answer}
                  onChange={(e) => {
                    const next = [...qa];
                    next[i] = { ...next[i], answer: e.target.value };
                    setQa(next);
                  }}
                  rows={2}
                  className="resize-none"
                  placeholder={t("aiBuilder.skipPlaceholder", "Lämna tomt för att hoppa över")}
                  disabled={loading}
                />
              </div>
            ))}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="draft-title">
                {t("aiBuilder.draftTitleLabel", "Titel")}
              </Label>
              <input
                id="draft-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="flex h-10 w-full max-w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-speech">
                {t("aiBuilder.draftSpeechLabel", "Talet")}
              </Label>
              <Textarea
                id="draft-speech"
                value={draftSpeech}
                onChange={(e) => setDraftSpeech(e.target.value)}
                rows={10}
                 className="min-h-48 max-h-none resize-none overflow-y-auto font-serif leading-relaxed sm:min-h-64 sm:max-h-[34dvh]"
              />
              <p className="text-xs text-muted-foreground">
                {draftSpeech.split(/\s+/).filter(Boolean).length}{" "}
                {t("dashboard.words", "ord")}
              </p>
            </div>
          </div>
        )}
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 px-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border/60 shrink-0 bg-card sm:flex sm:px-6 sm:py-4">
          {step === "prompt" && (
            <>
              <Button
                variant="ghost"
                onClick={() => closeAndReset(false)}
                disabled={loading}
                className="min-w-0"
              >
                {t("common.cancel", "Avbryt")}
              </Button>
              <Button onClick={fetchQuestions} disabled={loading} className="min-w-0">
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                {t("aiBuilder.getQuestions", "Fortsätt")}
              </Button>
            </>
          )}
          {step === "questions" && (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep("prompt")}
                disabled={loading}
                className="min-w-0"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("common.back", "Tillbaka")}
              </Button>
              <Button onClick={() => fetchDraft(qa)} disabled={loading} className="min-w-0">
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                {t("aiBuilder.writeSpeech", "Skriv talet")}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep("questions")}
                disabled={loading}
                className="min-w-0 px-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("aiBuilder.regenerate", "Ändra svar")}
              </Button>
              <Button onClick={handleAccept} disabled={!draftSpeech.trim()} className="min-w-0">
                <Check className="h-4 w-4 mr-2" />
                {t("aiBuilder.useDraft", "Använd")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AiSpeechBuilderDialog;
