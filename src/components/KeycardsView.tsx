import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Undo2, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { stripStageDirections } from "@/utils/stageDirections";
import { getKeywordIndices, normalizeForKeyword } from "@/utils/keywordExtraction";
import { getSpeechWordErrors } from "@/utils/wordDifficulty";

interface Props {
  speechId: string;
  speechText: string;
  onBack: () => void;
}

const STOP = new Set(["och","att","det","som","en","ett","the","and","that","with","this","from","have","which","there","their","about","would","could","should","und","der","die","das","nicht","eine","pour","dans","avec","para","como","sono","della","para","porque"]);
const LEVEL_KEY = (id: string) => `sermable:keycards:${id}`;
const BASE = 4;
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

  const errors = useMemo(() => getSpeechWordErrors(speechId), [speechId]);
  const keywordsFor = (si: number) => {
    const words = sentences[si].split(/\s+/);
    const err = (i: number) => errors[normalizeForKeyword(words[i])] ?? 0;
    // Words you actually missed/hesitated on in practice are always shown.
    const hard = words.map((_, i) => i).filter((i) => err(i) > 0);
    const kw = [...getKeywordIndices(words, STOP)].filter((i) => !hard.includes(i));
    const ranked = [
      ...hard.sort((a, b) => err(b) - err(a)),
      ...kw.sort((a, b) => normalizeForKeyword(words[b]).length - normalizeForKeyword(words[a]).length),
    ];
    const n = Math.max(hard.length, Math.min(ranked.length, BASE + (levels[si] ?? 0) * STEP));
    const chosen = new Set(ranked.slice(0, Math.max(1, n)));
    return [...chosen].sort((a, b) => a - b).map((i) => ({ w: words[i].replace(/[.,!?;:]+$/, ""), hard: err(i) > 0 }));
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
    }, 300);
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
            {pos + 1 < order.length && (() => {
              const p = Math.min(1, Math.abs(offset) / 300);
              const next = order[pos + 1];
              return (
                <div
                  className="absolute w-full max-w-sm aspect-[3/4] rounded-[2rem] bg-card border-2 border-border shadow-lg p-6 flex flex-col pointer-events-none"
                  style={{ transform: `scale(${0.95 + p * 0.05}) translateY(${12 - p * 12}px)`, opacity: 0.6 + p * 0.4 }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("keycards.sentence", { n: next + 1, defaultValue: "Sentence {{n}}" })}
                  </p>
                  <div className="flex-1 flex flex-wrap content-center justify-center gap-2">
                    {keywordsFor(next).map(({ w, hard }, i) => (
                      <span key={i} className={cn("rounded-full px-3 py-1.5 text-base font-bold", hard ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-foreground")}>{w}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div
              key={`${pos}-${current}`}
              className={cn("relative w-full max-w-sm aspect-[3/4] select-none touch-none cursor-grab", (leaving || drag === 0) && "transition-transform duration-300 ease-out")}
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
                <div className={cn("absolute inset-0 rounded-[2rem] border-2 bg-card shadow-xl p-6 flex flex-col", offset < -40 ? "border-destructive" : offset > 40 ? "border-[hsl(142_70%_40%)]" : "border-border")}
                  style={{ backfaceVisibility: "hidden" }}>
                  <div className="absolute inset-0 rounded-[2rem] pointer-events-none flex items-center justify-center transition-opacity"
                    style={{ opacity: Math.min(1, Math.abs(offset) / 120), background: offset > 0 ? "hsl(142 70% 45% / 0.18)" : "hsl(var(--destructive) / 0.18)" }}>
                    {offset > 0
                      ? <span className="rounded-full border-2 px-4 py-2 text-base font-bold rotate-12" style={{ color: "hsl(142 70% 35%)", borderColor: "hsl(142 70% 40%)" }}>{t("keycards.knowIt", "Know it")}</span>
                      : <span className="rounded-full border-2 border-destructive px-4 py-2 text-base font-bold text-destructive -rotate-12">{t("keycards.tryAgain", "Try again")}</span>}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("keycards.sentence", { n: current + 1, defaultValue: "Sentence {{n}}" })}
                  </p>
                  <div className="flex-1 flex flex-wrap content-center justify-center gap-2">
                    {keywordsFor(current).map(({ w, hard }, i) => (
                      <span key={i} className={cn("rounded-full px-3 py-1.5 text-base font-bold", hard ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-foreground")}>{w}</span>
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
            <Button size="icon" variant="outline" className="h-16 w-16 rounded-full border-2 border-[hsl(142_70%_40%)] text-[hsl(142_70%_35%)]" onClick={() => commit("right")} aria-label={t("keycards.gotIt", "Got it")}>
              <Check className="h-7 w-7" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
