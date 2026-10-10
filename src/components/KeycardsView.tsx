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
    [cards, levels, errors]
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
    setOrder(onlyHard && hard.length ? hard : cards.map((_, i) => i));
    setPos(0); setHistory([]); setFlipped(false);
  };

  const left = history.filter((h) => h.dir === "left").length;
  const right = history.length - left;

  const cardLabel = (ci: number) => {
    const c = cards[ci];
    if (!c) return "";
    return c.first === c.last
      ? t("keycards.sentence", { n: c.first + 1, defaultValue: "Sentence {{n}}" })
      : t("keycards.sentencesRange", { a: c.first + 1, b: c.last + 1, defaultValue: "Sentences {{a}}–{{b}}" });
  };

  return (
    <div className="s-c4 s-i5 s-c5 s-c7 s-3v s-mn s-qq"
      style={{ height: "100dvh", paddingTop: "max(env(safe-area-inset-top, 0px), 1rem)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 1rem)", touchAction: "none", overscrollBehavior: "none" }}>
      <div className="s-c5 s-ib s-if s-os">
        <Button variant="ghost" size="icon" className="s-qe" onClick={onBack} aria-label={t("common.exit")}>
          <X className="s-g1 s-xv" />
        </Button>
        <span className="s-v9 s-d3 s-ul">
          {t("keycards.left", { count: Math.max(0, order.length - pos), defaultValue: "{{count}} left" })}
        </span>
        <Button variant="ghost" size="sm" className="s-qe s-dl" onClick={undo} disabled={!history.length || done}>
          <Undo2 className="s-fz s-xt" /> {t("keycards.undo", "Undo")}
        </Button>
      </div>

      {done ? (
        <div className="s-c6 s-c5 s-c7 s-ib s-ig s-ou s-u0 s-t3">
          <h2 className="s-ta s-cx">{t("keycards.doneTitle", "Round complete")}</h2>
          <div className="s-c5 s-dq">
            <div className="s-qa s-5e s-ou s-p7"><p className="s-ta s-cx s-uw">{right}</p><p className="s-vj s-ul">{t("keycards.gotIt", "Got it")}</p></div>
            <div className="s-qa s-4i s-ou s-p7"><p className="s-ta s-cx s-u2">{left}</p><p className="s-vj s-ul">{t("keycards.needSupport", "More support")}</p></div>
          </div>
          {left > 0 && <p className="s-v9 s-ul s-ju">{t("keycards.supportAdded", "Extra keywords were added to the sentences you swiped left.")}</p>}
          <div className="s-y7 s-ju s-sy">
            {left > 0 && <Button className="s-y7 s-q9" onClick={() => restart(true)}><RotateCcw className="s-fz s-xt s-lp" />{t("keycards.repeatHard", "Repeat difficult cards")}</Button>}
            <Button variant="outline" className="s-y7 s-q9" onClick={() => restart(false)}>{t("keycards.repeatAll", "Repeat all")}</Button>
            <Button variant="ghost" className="s-y7 s-q9" onClick={onBack}>{t("common.exit")}</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="s-c6 s-ku s-c5 s-ib s-ig s-ou s-p6">
           <div
             className="s-pd"
             style={{ aspectRatio: "3 / 4", height: "min(100%, calc((100vw - 3rem) * 4 / 3), 38rem)" }}
           >
            {pos + 1 < order.length && (() => {
              const next = order[pos + 1];
              return (
                <div
                  ref={nextRef}
                  className="s-26 s-i5 s-qc s-4b s-6n s-6x s-qx s-my s-c5 s-c7 s-nx"
                  style={{ transform: "translate3d(0,10px,0)", opacity: 0.6, willChange: "transform, opacity" }}
                >
                  <p className="s-vj s-d3 s-x1 s-wi s-ul">
                    {cardLabel(next)}
                  </p>
                  <div className="s-c6 s-c5 s-cb content-center s-ig s-dn">
                    {allKeywords[next].map(({ w, hard }, i) => (
                      <span key={i} className={cn("s-qe s-or s-oz s-tw s-cx", hard ? "s-4j s-u2" : "s-5f s-u9")}>{w}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div
              key={`${pos}-${current}`}
              ref={cardRef}
              className="s-26 s-i5 s-qq s-wd s-8l"
              style={{ perspective: "1200px", willChange: "transform", backfaceVisibility: "hidden", WebkitTapHighlightColor: "transparent" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={() => onEnd(false)}
              onPointerCancel={() => onEnd(true)}
              onLostPointerCapture={() => onEnd(false)}
            >
              <div className="s-26 s-i5 s-wu s-bq" style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}>
                <div className="s-26 s-i5 s-qc s-6n s-6x s-4b s-r4 s-my s-c5 s-c7"
                  style={{ backfaceVisibility: "hidden" }}>
                  <div ref={greenRef} className="s-26 s-i5 s-qc s-6n s-nx s-c5 s-ib s-ig"
                    style={{ opacity: 0, background: "hsl(142 70% 45% / 0.18)", borderColor: "hsl(142 70% 40%)" }}>
                    <span className="s-qe s-6n s-os s-p3 s-tw s-cx s-q5" style={{ color: "hsl(142 70% 35%)", borderColor: "hsl(142 70% 40%)" }}>{t("keycards.knowIt", "Know it")}</span>
                  </div>
                  <div ref={redRef} className="s-26 s-i5 s-qc s-6n s-75 s-nx s-c5 s-ib s-ig"
                    style={{ opacity: 0, background: "hsl(var(--destructive) / 0.18)" }}>
                    <span className="s-qe s-6n s-75 s-os s-p3 s-tw s-cx s-u2 -rotate-12">{t("keycards.tryAgain", "Try again")}</span>
                  </div>
                  <p className="s-vj s-d3 s-x1 s-wi s-ul">
                    {cardLabel(current)}
                  </p>
                  <div className="s-c6 s-c5 s-cb content-center s-ig s-dn">
                    {allKeywords[current].map(({ w, hard }, i) => (
                      <span key={i} className={cn("s-qe s-or s-oz s-tw s-cx", hard ? "s-4j s-u2" : "s-5f s-u9")}>{w}</span>
                    ))}
                  </div>
                  <p className="s-u0 s-vj s-ul">{t("keycards.tapToFlip", "Tap to show the full sentence")}</p>
                </div>
                <div data-keycard-scroll className="s-26 s-i5 s-qc s-6n s-6x s-4b s-r4 s-my s-c5 s-ib s-mq"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <p className="s-vi s-ip">{cards[current]?.text}</p>
                </div>
              </div>
            </div>
           </div>
          </div>
          <div className="s-c5 s-ig s-dt s-n8">
            <Button size="icon" variant="outline" className="s-fr s-xj s-qe s-6n s-75 s-u2" onClick={() => commit("left")} aria-label={t("keycards.needSupport", "More support")}>
              <X className="s-g4 s-xy" />
            </Button>
            <Button size="icon" variant="outline" className="s-fr s-xj s-qe s-6n s-6r s-to" onClick={() => commit("right")} aria-label={t("keycards.gotIt", "Got it")}>
              <Check className="s-g4 s-xy" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
