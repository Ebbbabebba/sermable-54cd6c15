import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  // Group consecutive sentences into cards with roughly equal word counts,
  // so a 1-word sentence never becomes its own near-empty card.
  const cards = useMemo(() => {
    const MIN_WORDS = 6;
    const MAX_WORDS = 15;
    const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
    const groups: { text: string; first: number; last: number }[] = [];
    let cur: string[] = [];
    let first = 0;
    sentences.forEach((s, i) => {
      const curWords = cur.reduce((a, c) => a + wc(c), 0);
      if (cur.length > 0 && curWords >= MIN_WORDS && curWords + wc(s) > MAX_WORDS) {
        groups.push({ text: cur.join(" "), first, last: i - 1 });
        cur = [];
        first = i;
      }
      cur.push(s);
    });
    if (cur.length) groups.push({ text: cur.join(" "), first, last: sentences.length - 1 });
    return groups;
  }, [sentences]);
  const [levels, setLevels] = useState<Record<string, number>>(() => readLevels(speechId));
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [history, setHistory] = useState<Swipe[]>([]);
  const [flipped, setFlipped] = useState(false);
  const start = useRef<number | null>(null);
  const moved = useRef(false);

  const errors = useMemo(() => getSpeechWordErrors(speechId), [speechId]);
  // Precompute keywords for every sentence once per level-change so swipe
  // re-renders (every pointermove) stay cheap.
  const allKeywords = useMemo(
    () =>
      cards.map((card, si) => {
        const words = card.text.split(/\s+/);
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
      }),
    [sentences, levels, errors]
  );

  const done = pos >= order.length;
  const current = done ? -1 : order[pos];

  // Drag is handled entirely through refs + direct style writes (no React
  // re-render per pointermove) so the card follows the finger at 60fps.
  const cardRef = useRef<HTMLDivElement | null>(null);
  const nextRef = useRef<HTMLDivElement | null>(null);
  const greenRef = useRef<HTMLDivElement | null>(null);
  const redRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const busy = useRef(false);

  const apply = (offset: number, transition: string | null) => {
    const card = cardRef.current;
    if (card) {
      card.style.transition = transition ?? "none";
      card.style.transform = `translate3d(${offset}px,0,0) rotate(${offset / 35}deg)`;
    }
    const g = greenRef.current, r = redRef.current;
    if (g) { g.style.transition = transition ? "opacity 250ms ease-out" : "none"; g.style.opacity = String(Math.min(1, Math.max(0, offset) / 120)); }
    if (r) { r.style.transition = transition ? "opacity 250ms ease-out" : "none"; r.style.opacity = String(Math.min(1, Math.max(0, -offset) / 120)); }
    const n = nextRef.current;
    if (n) {
      const p = Math.min(1, Math.abs(offset) / 300);
      n.style.transition = transition ? "transform 300ms ease-out, opacity 300ms ease-out" : "none";
      n.style.transform = `translate3d(0,${10 - p * 10}px,0)`;
      n.style.opacity = String(0.6 + p * 0.4);
    }
  };

  // Reset positions whenever a new card becomes the top card.
  useLayoutEffect(() => {
    dragRef.current = 0;
    busy.current = false;
    apply(0, null);
  }, [pos, order]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // Fully lock the screen while the deck is open: no page scroll, no rubber-band,
  // no pinch / double-tap zoom (iOS Safari ignores user-scalable=no, so the
  // gesture events must be cancelled manually).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow, htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow, bodyPosition: body.style.position, bodyInset: body.style.inset,
      bodyWidth: body.style.width, bodyTouch: body.style.touchAction, bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.inset = "0";
    body.style.width = "100%";
    body.style.touchAction = "none";
    body.style.overscrollBehavior = "none";
    const block = (e: Event) => e.preventDefault();
    const blockTouch = (e: TouchEvent) => {
      // Allow scrolling only inside the flipped card's full-sentence view.
      const target = e.target as HTMLElement | null;
      if (e.touches.length > 1 || !target?.closest("[data-keycard-scroll]")) e.preventDefault();
    };
    document.addEventListener("touchmove", blockTouch, { passive: false });
    document.addEventListener("gesturestart", block, { passive: false } as AddEventListenerOptions);
    document.addEventListener("gesturechange", block, { passive: false } as AddEventListenerOptions);
    document.addEventListener("gestureend", block, { passive: false } as AddEventListenerOptions);
    return () => {
      document.removeEventListener("touchmove", blockTouch);
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("gestureend", block);
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.inset = prev.bodyInset;
      body.style.width = prev.bodyWidth;
      body.style.touchAction = prev.bodyTouch;
      body.style.overscrollBehavior = prev.bodyOverscroll;
    };
  }, []);

  const commit = (dir: "left" | "right") => {
    if (done || busy.current) return;
    busy.current = true;
    start.current = null;
    const w = (typeof window !== "undefined" ? window.innerWidth : 600) + 200;
    apply(dir === "left" ? -w : w, "transform 300ms cubic-bezier(0.3, 0.6, 0.4, 1)");
    setTimeout(() => {
      if (dir === "left") {
        const next = { ...levels, [current]: (levels[current] ?? 0) + 1 };
        setLevels(next);
        localStorage.setItem(LEVEL_KEY(speechId), JSON.stringify(next));
      }
      setHistory((h) => [...h, { index: current, dir }]);
      setPos((p) => p + 1);
      setFlipped(false);
    }, 300);
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busy.current) return;
    start.current = e.clientX;
    moved.current = false;
    dragRef.current = 0;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (start.current === null || busy.current) return;
    const d = e.clientX - start.current;
    if (Math.abs(d) > 6) moved.current = true;
    dragRef.current = d;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!busy.current) apply(dragRef.current, null);
      });
    }
  };
  const onEnd = (cancelled: boolean) => {
    if (start.current === null) return;
    start.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const d = dragRef.current;
    if (!cancelled && d < -100) commit("left");
    else if (!cancelled && d > 100) commit("right");
    else {
      dragRef.current = 0;
      apply(0, "transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      if (!cancelled && !moved.current) setFlipped((f) => !f);
    }
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

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden select-none"
      style={{ height: "100dvh", paddingTop: "max(env(safe-area-inset-top, 0px), 1rem)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 1rem)", touchAction: "none", overscrollBehavior: "none" }}>
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
          <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-3">
           <div
             className="relative"
             style={{ aspectRatio: "3 / 4", height: "min(100%, calc((100vw - 3rem) * 4 / 3), 38rem)" }}
           >
            {pos + 1 < order.length && (() => {
              const next = order[pos + 1];
              return (
                <div
                  ref={nextRef}
                  className="absolute inset-0 rounded-[2rem] bg-card border-2 border-border shadow-lg p-6 flex flex-col pointer-events-none"
                  style={{ transform: "translate3d(0,10px,0)", opacity: 0.6, willChange: "transform, opacity" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("keycards.sentence", { n: next + 1, defaultValue: "Sentence {{n}}" })}
                  </p>
                  <div className="flex-1 flex flex-wrap content-center justify-center gap-2">
                    {allKeywords[next].map(({ w, hard }, i) => (
                      <span key={i} className={cn("rounded-full px-3 py-1.5 text-base font-bold", hard ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-foreground")}>{w}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div
              key={`${pos}-${current}`}
              ref={cardRef}
              className="absolute inset-0 select-none touch-none cursor-grab"
              style={{ perspective: "1200px", willChange: "transform", backfaceVisibility: "hidden", WebkitTapHighlightColor: "transparent" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={() => onEnd(false)}
              onPointerCancel={() => onEnd(true)}
              onLostPointerCapture={() => onEnd(false)}
            >
              <div className="absolute inset-0 transition-transform duration-500" style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}>
                <div className="absolute inset-0 rounded-[2rem] border-2 border-border bg-card shadow-xl p-6 flex flex-col"
                  style={{ backfaceVisibility: "hidden" }}>
                  <div ref={greenRef} className="absolute inset-0 rounded-[2rem] border-2 pointer-events-none flex items-center justify-center"
                    style={{ opacity: 0, background: "hsl(142 70% 45% / 0.18)", borderColor: "hsl(142 70% 40%)" }}>
                    <span className="rounded-full border-2 px-4 py-2 text-base font-bold rotate-12" style={{ color: "hsl(142 70% 35%)", borderColor: "hsl(142 70% 40%)" }}>{t("keycards.knowIt", "Know it")}</span>
                  </div>
                  <div ref={redRef} className="absolute inset-0 rounded-[2rem] border-2 border-destructive pointer-events-none flex items-center justify-center"
                    style={{ opacity: 0, background: "hsl(var(--destructive) / 0.18)" }}>
                    <span className="rounded-full border-2 border-destructive px-4 py-2 text-base font-bold text-destructive -rotate-12">{t("keycards.tryAgain", "Try again")}</span>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("keycards.sentence", { n: current + 1, defaultValue: "Sentence {{n}}" })}
                  </p>
                  <div className="flex-1 flex flex-wrap content-center justify-center gap-2">
                    {allKeywords[current].map(({ w, hard }, i) => (
                      <span key={i} className={cn("rounded-full px-3 py-1.5 text-base font-bold", hard ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-foreground")}>{w}</span>
                    ))}
                  </div>
                  <p className="text-center text-xs text-muted-foreground">{t("keycards.tapToFlip", "Tap to show the full sentence")}</p>
                </div>
                <div data-keycard-scroll className="absolute inset-0 rounded-[2rem] border-2 border-border bg-card shadow-xl p-6 flex items-center overflow-y-auto"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <p className="text-xl leading-relaxed">{sentences[current]}</p>
                </div>
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
