import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Check, HelpCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pushMessage } from "@/components/InlineMessages";
import { cn } from "@/lib/utils";

interface Beat {
  id: string;
  text_original: string;
  beat_index: number;
}


interface Props {
  open: boolean;
  onClose: () => void;
  speechId: string;
  onCompleted: () => void;
}

type Answer = "yes" | "partial" | "no";

const hideRandomWords = (text: string, ratio = 0.4): string => {
  const words = text.split(/(\s+)/);
  const contentIdx = words
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => /\w{3,}/.test(w))
    .map(({ i }) => i);
  const hideCount = Math.ceil(contentIdx.length * ratio);
  const shuffled = [...contentIdx].sort(() => Math.random() - 0.5).slice(0, hideCount);
  const hideSet = new Set(shuffled);
  return words
    .map((w, i) => (hideSet.has(i) ? "▁".repeat(Math.max(2, w.length)) : w))
    .join("");
};

const KnowledgeTestDialog = ({ open, onClose, speechId, onCompleted }: Props) => {
  const { t } = useTranslation();
  const [beats, setBeats] = useState<Beat[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIdx(0);
    setAnswers([]);
    setFinished(false);
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("practice_beats")
        .select("id, sentence_1_text, sentence_2_text, sentence_3_text, beat_order")
        .eq("speech_id", speechId)
        .order("beat_order", { ascending: true });
      if (error) {
        console.error(error);
        setBeats([]);
      } else {
        const all: Beat[] = (data ?? []).map((r) => ({
          id: r.id,
          beat_index: r.beat_order,
          text_original: [r.sentence_1_text, r.sentence_2_text, r.sentence_3_text]
            .filter((s) => s && s.trim().length > 0)
            .join(" "),
        }));
        if (all.length <= 4) {
          setBeats(all);
        } else {
          const step = all.length / 4;
          setBeats(
            Array.from({ length: 4 }, (_, i) => all[Math.floor(i * step)])
          );
        }
      }

      setLoading(false);
    })();
  }, [open, speechId]);

  const current = beats?.[idx];
  const partial = useMemo(
    () => (current ? hideRandomWords(current.text_original) : ""),
    [current]
  );

  const level = useMemo<"beginner" | "intermediate" | "confident">(() => {
    if (answers.length === 0) return "beginner";
    const score = answers.reduce(
      (s, a) => s + (a === "yes" ? 1 : a === "partial" ? 0.5 : 0),
      0
    );
    const ratio = score / answers.length;
    if (ratio >= 0.75) return "confident";
    if (ratio >= 0.4) return "intermediate";
    return "beginner";
  }, [answers]);

  const answer = (a: Answer) => {
    const next = [...answers, a];
    setAnswers(next);
    if (!beats || idx + 1 >= beats.length) {
      setFinished(true);
    } else {
      setIdx(idx + 1);
    }
  };

  const finish = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("speeches")
      .update({
        familiarity_level: level,
        knowledge_test_completed_at: new Date().toISOString(),
      })
      .eq("id", speechId);
    setSaving(false);
    if (error) {
      pushMessage(t("common.error", "Something went wrong"), {
        description: error.message,
        variant: "error",
      });
      return;
    }
    pushMessage(t("knowledgeTest.resultTitle"), {
      description: t(`knowledgeTest.result${level.charAt(0).toUpperCase() + level.slice(1)}`),
      variant: "success",
    });
    onCompleted();
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-background/70 backdrop-blur-xl flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ height: "100dvh" }}
      >
        <div
          className="flex items-center justify-between px-4 pb-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            {!finished && beats && beats.length > 0 && (
              <span>
                {idx + 1} / {beats.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-card border border-border/50 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-3xl border border-border/60 bg-card/95 p-6 sm:p-8 shadow-xl space-y-6">
            {loading && (
              <p className="text-center text-sm text-muted-foreground py-10">
                …
              </p>
            )}

            {!loading && !finished && current && (
              <>
                <div className="text-center space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-primary/80">
                    <HelpCircle className="inline h-3.5 w-3.5 mr-1" />
                    {t("knowledgeTest.question")}
                  </p>
                  <h3 className="text-lg font-semibold">
                    {t("knowledgeTest.bannerTitle")}
                  </h3>
                </div>
                <div className="rounded-2xl bg-muted/50 border border-border/40 p-5 text-base leading-relaxed font-serif whitespace-pre-wrap">
                  {partial}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => answer("no")}
                    className="gap-2"
                  >
                    <ThumbsDown className="h-4 w-4" />
                    {t("knowledgeTest.no")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => answer("partial")}
                    className="gap-2"
                  >
                    {t("knowledgeTest.partial")}
                  </Button>
                  <Button onClick={() => answer("yes")} className="gap-2">
                    <ThumbsUp className="h-4 w-4" />
                    {t("knowledgeTest.yes")}
                  </Button>
                </div>
              </>
            )}

            {!loading && finished && (
              <div className="text-center space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mx-auto flex items-center justify-center">
                  <Check className="w-8 h-8 text-primary" strokeWidth={1.5} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">
                    {t("knowledgeTest.resultTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      `knowledgeTest.result${level.charAt(0).toUpperCase() + level.slice(1)}`
                    )}
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={finish}
                  disabled={saving}
                  className="min-w-40"
                >
                  {t("knowledgeTest.done")}
                </Button>
              </div>
            )}

            {!loading && !finished && beats && beats.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-10">
                —
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default KnowledgeTestDialog;
