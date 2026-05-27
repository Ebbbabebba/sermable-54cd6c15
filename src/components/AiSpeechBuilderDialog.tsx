import { useState } from "react";
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
import { Loader2, Sparkles, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
      setDraftSpeech((data?.speech as string) || "");
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
      <DialogContent
        overlayClassName="!z-[60] bg-background/65 backdrop-blur-none"
        className="!z-[70] !inset-auto !left-1/2 !top-1/2 w-[calc(100%-2rem)] max-w-2xl max-h-[min(86dvh,720px)] !-translate-x-1/2 !-translate-y-1/2 overflow-y-auto rounded-3xl border-border/60 bg-card p-5 shadow-2xl backdrop-blur-none sm:p-6"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("aiBuilder.title", "Bygg tal med AI")}
          </DialogTitle>
          <DialogDescription>
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
              className="resize-none"
              disabled={loading}
            />
            <div className="space-y-2 pt-2">
              <Label>
                {t("aiBuilder.lengthLabel", "Ungefärlig längd")}
              </Label>
              <div className="flex flex-wrap gap-2">
                {lengthOptions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTargetMinutes(m)}
                    disabled={loading}
                    className={`px-3 py-1.5 rounded-full border text-sm transition ${
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
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
                className="max-h-[34dvh] resize-none overflow-y-auto font-serif leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                {draftSpeech.split(/\s+/).filter(Boolean).length}{" "}
                {t("dashboard.words", "ord")}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "prompt" && (
            <>
              <Button
                variant="ghost"
                onClick={() => closeAndReset(false)}
                disabled={loading}
              >
                {t("common.cancel", "Avbryt")}
              </Button>
              <Button onClick={fetchQuestions} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
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
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("common.back", "Tillbaka")}
              </Button>
              <Button onClick={() => fetchDraft(qa)} disabled={loading}>
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
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("aiBuilder.regenerate", "Ändra svar")}
              </Button>
              <Button onClick={handleAccept} disabled={!draftSpeech.trim()}>
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
