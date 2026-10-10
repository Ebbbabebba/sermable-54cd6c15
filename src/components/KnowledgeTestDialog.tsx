import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Check, HelpCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pushMessage } from "@/components/InlineMessages";
import { cn } from "@/lib/utils";
import { stripPropCueMarkers } from "@/utils/propCues";

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

      let all: Beat[] = [];
      if (!error && data && data.length > 0) {
        all = data.map((r) => ({
          id: r.id,
          beat_index: r.beat_order,
          text_original: stripPropCueMarkers([r.sentence_1_text, r.sentence_2_text, r.sentence_3_text]
            .filter((s) => s && s.trim().length > 0)
            .join(" ")),
        }));
      }

      // Fallback: if no practice_beats yet, derive chunks from speech text
      if (all.length === 0) {
        const { data: sp } = await supabase
          .from("speeches")
          .select("text_original")
          .eq("id", speechId)
          .single();
        const raw = stripPropCueMarkers(sp?.text_original ?? "").trim();
        if (raw.length > 0) {
          const sentences = raw
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter(Boolean);
          const chunkCount = Math.min(4, Math.max(1, sentences.length));
          const perChunk = Math.ceil(sentences.length / chunkCount);
          all = Array.from({ length: chunkCount }, (_, i) => ({
            id: `chunk-${i}`,
            beat_index: i,
            text_original: sentences.slice(i * perChunk, (i + 1) * perChunk).join(" "),
          })).filter((b) => b.text_original.length > 0);
        }
      }

      if (all.length <= 4) {
        setBeats(all);
      } else {
        const step = all.length / 4;
        setBeats(
          Array.from({ length: 4 }, (_, i) => all[Math.floor(i * step)])
        );
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
        className="s-c4 s-i5 s-yh s-3z s-3i s-c5 s-c7"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ height: "100dvh" }}
      >
        <div
          className="s-c5 s-ib s-if s-os s-n6"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <div className="s-c5 s-ib s-dn s-v9 s-ul">
            <Sparkles className="s-fz s-xt s-uw" />
            {!finished && beats && beats.length > 0 && (
              <span>
                {idx + 1} / {beats.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="s-y2 s-g8 s-qe s-4b s-6l s-70 s-c5 s-ib s-ig"
            aria-label="Close"
          >
            <X className="s-fz s-xt" />
          </button>
        </div>

        <div className="s-c6 s-mq s-os s-n9 s-c5 s-ib s-ig">
          <div className="s-y7 s-jt s-qa s-6l s-71 s-4f s-my s-s7 s-r4 s-t3">
            {loading && (
              <p className="s-u0 s-v9 s-ul s-p0">
                …
              </p>
            )}

            {!loading && !finished && current && (
              <>
                <div className="s-u0 s-sw">
                  <p className="s-vj s-d0 s-x1 s-wj s-uy">
                    <HelpCircle className="s-i2 s-fx s-xq s-ln" />
                    {t("knowledgeTest.question")}
                  </p>
                  <h3 className="s-uk s-d3">
                    {t("knowledgeTest.bannerTitle")}
                  </h3>
                </div>
                <div className="s-q9 s-56 s-6l s-6z s-mx s-tw s-ip s-d4 s-yd">
                  {partial}
                </div>
                <div className="s-e0 s-e1 s-rm s-dn">
                  <Button
                    variant="outline"
                    onClick={() => answer("no")}
                    className="s-dn"
                  >
                    <ThumbsDown className="s-fz s-xt" />
                    {t("knowledgeTest.no")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => answer("partial")}
                    className="s-dn"
                  >
                    {t("knowledgeTest.partial")}
                  </Button>
                  <Button onClick={() => answer("yes")} className="s-dn">
                    <ThumbsUp className="s-fz s-xt" />
                    {t("knowledgeTest.yes")}
                  </Button>
                </div>
              </>
            )}

            {!loading && finished && (
              <div className="s-u0 s-t2">
                <div className="s-sw">
                  <h3 className="s-vi s-cx">
                    {t("knowledgeTest.resultTitle")}
                  </h3>
                  <p className="s-v9 s-ul">
                    {t(
                      `knowledgeTest.result${level.charAt(0).toUpperCase() + level.slice(1)}`
                    )}
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={finish}
                  disabled={saving}
                  className="s-lb"
                >
                  {t("knowledgeTest.done")}
                </Button>
              </div>
            )}

            {!loading && !finished && beats && beats.length === 0 && (
              <p className="s-u0 s-v9 s-ul s-p0">
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
