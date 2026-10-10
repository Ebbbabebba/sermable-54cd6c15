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
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        overlayClassName="s-6 s-3y s-3g"
        className="s-7 s-2 s-r9 s-ra s-rb s-0 s-y7 s-jh s-g9 s-ku s-sr s-rx s-ro s-rw s-4 s-5 s-r7 s-r8 s-mn s-qj s-sd s-71 s-4b s-mr s-qr s-3g"
      >
        <DialogHeader className="s-l8 s-ow s-o5 s-sa s-oj s-s8 s-n6 s-6v s-71 s-r5 s-uj">
          <DialogTitle className="s-c5 s-l8 s-ib s-dn s-iq">
            <Wand2 className="s-g1 s-xv s-uw" />
            {t("aiBuilder.title", "Bygg tal med AI")}
          </DialogTitle>
          <DialogDescription className="s-iq">
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

        <div className="s-ku s-l8 s-mp s-mq overscroll-contain s-ow s-o4 s-sa s-p7 s-1z">
        {step === "prompt" && (
          <div className="s-t0 s-p3">
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
              className="s-kw resize-none"
              disabled={loading}
            />
            <div className="s-sy s-o9">
              <Label>
                {t("aiBuilder.lengthLabel", "Ungefärlig längd")}
              </Label>
              <div className="s-e0 s-e3 s-dn s-rh s-rk">
                {lengthOptions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTargetMinutes(m)}
                    disabled={loading}
                    className={`s-l8 s-op s-p3 s-qe s-6l s-v9 s-wl ${
                      targetMinutes === m
                        ? "s-5c s-ux s-7n"
                        : "s-3v s-6x s-h0"
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
          <div className="s-t1 s-p3">
            {qa.map((item, i) => (
              <div key={i} className="s-sy">
                <Label htmlFor={`q-${i}`} className="s-iq">
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
          <div className="s-t0 s-p3">
            <div className="s-sy">
              <Label htmlFor="draft-title">
                {t("aiBuilder.draftTitleLabel", "Titel")}
              </Label>
              <input
                id="draft-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="s-c5 s-fn s-y7 s-jn s-qi s-6l s-7g s-3v s-or s-p3 s-tw s-kq s-pu"
              />
            </div>
            <div className="s-sy">
              <Label htmlFor="draft-speech">
                {t("aiBuilder.draftSpeechLabel", "Talet")}
              </Label>
              <Textarea
                id="draft-speech"
                value={draftSpeech}
                onChange={(e) => setDraftSpeech(e.target.value)}
                rows={10}
                 className="s-kx s-ja resize-none s-mq s-d4 s-ip s-s2 s-rv"
              />
              <p className="s-vj s-ul">
                {draftSpeech.split(/\s+/).filter(Boolean).length}{" "}
                {t("dashboard.words", "ord")}
              </p>
            </div>
          </div>
        )}
        </div>

        <DialogFooter className="s-e0 s-e2 s-dn s-ow s-o4 s-oc s-nf s-82 s-71 s-r5 s-4b s-rh s-sa s-sb">
          {step === "prompt" && (
            <>
              <Button
                variant="ghost"
                onClick={() => closeAndReset(false)}
                disabled={loading}
                className="s-l8"
              >
                {t("common.cancel", "Avbryt")}
              </Button>
              <Button onClick={fetchQuestions} disabled={loading} className="s-l8">
                {loading ? (
                  <Loader2 className="s-fz s-xt s-lp s-32" />
                ) : (
                  <Wand2 className="s-fz s-xt s-lp" />
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
                className="s-l8"
              >
                <ArrowLeft className="s-fz s-xt s-lp" />
                {t("common.back", "Tillbaka")}
              </Button>
              <Button onClick={() => fetchDraft(qa)} disabled={loading} className="s-l8">
                {loading ? (
                  <Loader2 className="s-fz s-xt s-lp s-32" />
                ) : (
                  <ArrowRight className="s-fz s-xt s-lp" />
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
                className="s-l8 s-op"
              >
                <ArrowLeft className="s-fz s-xt s-lp" />
                {t("aiBuilder.regenerate", "Ändra svar")}
              </Button>
              <Button onClick={handleAccept} disabled={!draftSpeech.trim()} className="s-l8">
                <Check className="s-fz s-xt s-lp" />
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
