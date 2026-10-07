import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Undo2, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { stripStageDirections } from "@/utils/stageDirections";
import { getKeywordIndices, normalizeForKeyword } from "@/utils/keywordExtraction";

interface Props {
  speechId: string;
  speechText: string;
  onBack: () => void;
}

const STOP = new Set(["och","att","det","som","en","ett","the","and","that","with","this","from","have","which","there","their","about","would","could","should","und","der","die","das","nicht","eine","pour","dans","avec","para","como","sono","della","para","porque"]);
const LEVEL_KEY = (id: string) => `sermable:keycards:${id}`;
const BASE = 2;
const STEP = 2;

type Swipe = { index: number; dir: "left" | "right" };

const readLevels = (id: string): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(LEVEL_KEY(id)) || "{}"); } catch { return {}; }
};

export default function KeycardsView({ speechId, speechText, onBack }: Props) {
  const { t } = useTranslation();
  const sentences = useMemo(
    () => (stripStageDirections(speechText).match(/[^.!?]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean),
    [speechText]
  );
  const [levels, setLevels] = useState<Record<string, number>>(() => readLevels(speechId));
  const [order, setOrder] = useState<number[]>(() => sentences.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [history, setHistory] = useState<Swipe[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [drag, setDrag] = useState(0);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const start = useRef<number | null>(null);
  const moved = useRef(false);

  const keywordsFor = (si: number) => {
    const words = sentences[si].split(/\s+/);
    const idx = [...getKeywordIndices(words, STOP)];
    const ranked = idx.sort((a, b) => normalizeForKeyword(words[b]).length - normalizeForKeyword(words[a]).length);
    const n = Math.min(ranked.length, BASE + (levels[si] ?? 0) * STEP);
    return ranked.slice(0, Math.max(1, n)).sort((a, b) => a - b).map((i) => words[i].replace(/[.,!?;:]+$/, ""));
  };

  const done = pos >= order.length;
  const current = done ? -1 : order[pos];

  const commit = (dir: "left" | "right") => {
    if (done) return;
    setLeaving(dir);
    setTimeout(() => {
      if (dir === "left") {
        const next = { ...levels, [current]: (levels[current] ?? 0) + 1 };
        setLevels(next);
        localStorage.setItem(LEVEL_KEY(speechId), JSON.stringify(next));
      }
      setHistory((h) => [...h, { index: current, dir }]);
      setPos((p) => p + 1);
      setFlipped(false);
      setDrag(0);
      setLeaving(null);
    }, 220);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    if (last.dir === "left") {
      const next = { ...levels, [last.index]: Math.max(0, (levels[last.index] ?? 1) - 1) };
      setLevels(next);
      localStorage.setItem(LEVEL_KEY(speechId), JSON.stringify(next));
    }
    setHistory((h) => h.slice(0, -1));
    setPos((p) => p - 1);
    setFlipped(false);
  };

  const restart = (onlyHard: boolean) => {
    const hard = history.filter((h) => h.dir === "left").map((h) => h.index);
    setOrder(onlyHard && hard.length ? hard : sentences.map((_, i) => i));
    setPos(0); setHistory([]); setFlipped(false);
  };

  const left = history.filter((h) => h.dir === "left").length;
  const right = history.length - left;
  const offset = leaving ? (leaving === "left" ? -600 : 600) : drag;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden"
      style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 1rem)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 1rem)" }}>
      <div className="flex items-center justify-between px-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={onBack} aria-label={t("common.exit")}>
          <X className="h-5 w-5" />
        </Button>
        <span className="text-sm font-semibold text-muted-foreground">
          {t("keycards.left", { count: Math.max(0, order.length - pos), defaultValue: "{{count}} left" })}
        </span>
        <Button variant="ghost" size="sm" className="rounded-full gap-1" onClick={undo} disabled={!history.length || done}>
          <Undo2 className="h-4 w-4" /> {t("keycards.undo", "Undo")}
        </Button>
      </div>

      {done ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-6">
          <h2 className="text-3xl font-bold">{t("keycards.doneTitle", "Round complete")}</h2>
          <div className="flex gap-4">
            <div className="rounded-3xl bg-primary/10 px-6 py-4"><p className="text-3xl font-bold text-primary">{right}</p><p className="text-xs text-muted-foreground">{t("keycards.gotIt", "Got it")}</p></div>
            <div className="rounded-3xl bg-destructive/10 px-6 py-4"><p className="text-3xl font-bold text-destructive">{left}</p><p className="text-xs text-muted-foreground">{t("keycards.needSupport", "More support")}</p></div>
          </div>
          {left > 0 && <p className="text-sm text-muted-foreground max-w-xs">{t("keycards.supportAdded", "Extra keywords were added to the sentences you swiped left.")}</p>}
          <div className="w-full max-w-xs space-y-2">
            {left > 0 && <Button className="w-full rounded-2xl" onClick={() => restart(true)}><RotateCcw className="h-4 w-4 mr-2" />{t("keycards.repeatHard", "Repeat difficult cards")}</Button>}
            <Button variant="outline" className="w-full rounded-2xl" onClick={() => restart(false)}>{t("keycards.repeatAll", "Repeat all")}</Button>
            <Button variant="ghost" className="w-full rounded-2xl" onClick={onBack}>{t("common.exit")}</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center px-6 relative">
            {pos + 1 < order.length && (
              <div className="absolute w-full max-w-sm aspect-[3/4] rounded-[2rem] bg-card border border-border scale-95 translate-y-3 opacity-60" />
            )}
            <div
              className={cn("relative w-full max-w-sm aspect-[3/4] select-none touch-none cursor-grab", !start.current && "transition-transform duration-200")}
              style={{ transform: `translateX(${offset}px) rotate(${offset / 20}deg)`, perspective: "1200px" }}
              onPointerDown={(e) => { start.current = e.clientX; moved.current = false; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
              onPointerMove={(e) => { if (start.current === null) return; const d = e.clientX - start.current; if (Math.abs(d) > 6) moved.current = true; setDrag(d); }}
              onPointerUp={() => {
                const d = drag; start.current = null;
                if (d < -100) commit("left"); else if (d > 100) commit("right");
                else { setDrag(0); if (!moved.current) setFlipped((f) => !f); }
              }}
            >
              <div className="absolute inset-0 transition-transform duration-500" style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}>
                <div className={cn("absolute inset-0 rounded-[2rem] border-2 bg-card shadow-xl p-6 flex flex-col", offset < -40 ? "border-destructive" : offset > 40 ? "border-primary" : "border-border")}
                  style={{ backfaceVisibility: "hidden" }}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("keycards.sentence", { n: current + 1, defaultValue: "Sentence {{n}}" })}
                  </p>
                  <div className="flex-1 flex flex-wrap content-center justify-center gap-2">
                    {keywordsFor(current).map((w, i) => (
                      <span key={i} className="rounded-full bg-primary/15 text-foreground px-4 py-2 text-lg font-bold">{w}</span>
                    ))}
                  </div>
                  <p className="text-center text-xs text-muted-foreground">{t("keycards.tapToFlip", "Tap to show the full sentence")}</p>
                </div>
                <div className="absolute inset-0 rounded-[2rem] border-2 border-border bg-card shadow-xl p-6 flex items-center overflow-y-auto"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <p className="text-xl leading-relaxed">{sentences[current]}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-8 pb-4">
            <Button size="icon" variant="outline" className="h-16 w-16 rounded-full border-2 border-destructive text-destructive" onClick={() => commit("left")} aria-label={t("keycards.needSupport", "More support")}>
              <X className="h-7 w-7" />
            </Button>
            <Button size="icon" variant="outline" className="h-16 w-16 rounded-full border-2 border-primary text-primary" onClick={() => commit("right")} aria-label={t("keycards.gotIt", "Got it")}>
              <Check className="h-7 w-7" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
