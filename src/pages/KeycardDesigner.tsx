import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronLeft, ChevronRight, Hand, Pencil, MousePointerClick, Eraser, Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildSpeechCards, sharePdf } from "@/utils/printKeycards";
import { cn } from "@/lib/utils";

type Tool = "select" | "move" | "draw";
interface DWord { id: number; w: string; hard: boolean; x: number; y: number; kept: boolean }
interface DCard { label: string; text: string; words: DWord[]; strokes: [number, number][][] }

/** Card themes reference the app's colour tokens, so the logo always follows the chosen theme. */
const THEMES = [
  { id: "sky", bg: "--card", fg: "--foreground", accent: "--primary" },
  { id: "mint", bg: "--mint", fg: "--mint-foreground", accent: "--mint-foreground" },
  { id: "sun", bg: "--sun", fg: "--sun-foreground", accent: "--sun-foreground" },
  { id: "bubblegum", bg: "--bubblegum", fg: "--bubblegum-foreground", accent: "--bubblegum-foreground" },
  { id: "lavender", bg: "--lavender", fg: "--lavender-foreground", accent: "--lavender-foreground" },
] as const;

const tok = (name: string) =>
  `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "0 0% 50%"})`;
const clean = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
const FS = 0.075; // font size relative to card width

function layout(card: { label: string; text: string; keywords: { w: string; hard: boolean }[] }): DCard {
  const pool = card.keywords.map((k) => ({ ...k, used: false }));
  const all = card.text.split(/\s+/).map(clean).filter(Boolean);
  let x = 0.08, y = 0.3, id = 0;
  const words: DWord[] = all.map((w) => {
    const m = pool.find((p) => !p.used && p.w.toLowerCase() === w.toLowerCase());
    if (m) m.used = true;
    return { id: id++, w, hard: !!m?.hard, x: 0, y: 0, kept: !!m };
  });
  for (const word of words.filter((w) => w.kept)) {
    const width = word.w.length * FS * 0.58;
    if (x + width > 0.92 && x > 0.08) { x = 0.08; y += FS * 1.7; }
    word.x = x; word.y = Math.min(y, 0.85); x += width + FS * 0.4;
  }
  words.filter((w) => !w.kept).forEach((w) => { w.x = 0.08; w.y = 0.5; });
  return { label: card.label, text: card.text, words, strokes: [] };
}

export default function KeycardDesigner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [cards, setCards] = useState<DCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [theme, setTheme] = useState<(typeof THEMES)[number]>(THEMES[0]);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ wid?: number; dx: number; dy: number; stroke?: boolean; sx?: number; moved?: boolean } | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("speeches").select("text_original").eq("id", id).maybeSingle().then(({ data }) => {
      setCards(data ? buildSpeechCards(id, data.text_original, t as never).map(layout) : []);
    });
  }, [id, t]);

  const card = cards?.[idx];
  const update = (fn: (c: DCard) => DCard) => setCards((cs) => cs && cs.map((c, i) => (i === idx ? fn(c) : c)));
  const rel = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] as [number, number];
  };
  const go = (d: number) => cards && setIdx((i) => Math.max(0, Math.min(cards.length - 1, i + d)));

  const onDown = (e: React.PointerEvent) => {
    const [px, py] = rel(e);
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* noop */ }
    const wid = (e.target as HTMLElement).closest("[data-wid]")?.getAttribute("data-wid");
    if (tool === "draw") { drag.current = { stroke: true, dx: 0, dy: 0 }; update((c) => ({ ...c, strokes: [...c.strokes, [[px, py]]] })); return; }
    if (tool === "move" && wid) {
      const w = card!.words[+wid];
      drag.current = { wid: +wid, dx: px - w.x, dy: py - w.y }; return;
    }
    drag.current = { dx: 0, dy: 0, sx: e.clientX, wid: wid ? +wid : undefined, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const [px, py] = rel(e);
    if (d.stroke) { update((c) => ({ ...c, strokes: c.strokes.map((s, i) => (i === c.strokes.length - 1 ? [...s, [px, py]] : s)) })); return; }
    if (tool === "move" && d.wid !== undefined) {
      const x = Math.max(0, Math.min(0.95, px - d.dx)), y = Math.max(0.2, Math.min(0.92, py - d.dy));
      update((c) => ({ ...c, words: c.words.map((w) => (w.id === d.wid ? { ...w, x, y } : w)) }));
    }
    if (d.sx !== undefined && Math.abs(e.clientX - d.sx) > 10) d.moved = true;
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null;
    if (!d || d.stroke || tool === "move") return;
    const dist = e.clientX - (d.sx ?? e.clientX);
    if (Math.abs(dist) > 60) { go(dist < 0 ? 1 : -1); return; }
    if (!d.moved && d.wid !== undefined) update((c) => ({ ...c, words: c.words.map((w) => (w.id === d.wid ? { ...w, kept: false } : w)) }));
  };
  const addBack = (wid: number) => update((c) => {
    const kept = c.words.filter((w) => w.kept);
    const last = kept.reduce((m, w) => (w.y > m ? w.y : m), 0.22);
    return { ...c, words: c.words.map((w) => (w.id === wid ? { ...w, kept: true, x: 0.08, y: Math.min(0.85, last + FS * 1.7) } : w)) };
  });

  const exportPdf = async () => {
    if (!cards) return;
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = 600, H = 800, M = 10, cw = 95, ch = 126.67;
      const bg = tok(theme.bg), fg = tok(theme.fg), ac = tok(theme.accent);
      cards.forEach((c, i) => {
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const g = cv.getContext("2d")!;
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.fillStyle = ac; g.font = "800 34px Figtree, sans-serif";
        g.fillText("SERM", 40, 70); g.fillText("ABLE", 40, 106);
        g.fillStyle = fg; g.globalAlpha = 0.7; g.font = "600 20px Figtree, sans-serif"; g.textAlign = "right";
        g.fillText(c.label, W - 40, 70); g.fillText(`${i + 1}/${cards.length}`, W - 40, 98); g.globalAlpha = 1; g.textAlign = "left";
        g.font = `800 ${W * FS}px Figtree, sans-serif`; g.textBaseline = "top";
        c.words.filter((w) => w.kept).forEach((w) => {
          g.fillStyle = w.hard ? tok("--bubblegum-foreground") : fg;
          g.fillText(w.w, w.x * W, w.y * H);
        });
        g.strokeStyle = ac; g.lineWidth = 5; g.lineCap = "round"; g.lineJoin = "round";
        c.strokes.forEach((s) => { g.beginPath(); s.forEach(([x, y], k) => (k ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H))); g.stroke(); });
        const slot = i % 4; if (i > 0 && slot === 0) doc.addPage();
        const x = M + (slot % 2) * cw + 2, y = M + Math.floor(slot / 2) * (ch + 4);
        doc.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", x, y, cw - 4, ch);
        doc.setLineDashPattern([2, 2], 0); doc.setDrawColor(190); doc.rect(x, y, cw - 4, ch);
      });
      await sharePdf(doc.output("blob"));
    } finally { setBusy(false); }
  };

  const tools: { id: Tool; Icon: typeof Hand; label: string }[] = [
    { id: "select", Icon: MousePointerClick, label: t("designer.select", "Choose words") },
    { id: "move", Icon: Hand, label: t("designer.move", "Move") },
    { id: "draw", Icon: Pencil, label: t("designer.draw", "Draw") },
  ];
  const removed = useMemo(() => card?.words.filter((w) => !w.kept) ?? [], [card]);

  return (
    <div className="kc-designer">
      <header className="kc-designer__top">
        <button className="kc-designer__icon" onClick={() => navigate(-1)} aria-label={t("common.back", "Back")}><ArrowLeft /></button>
        <h1>{t("designer.title", "Design your cards")}</h1>
        <button className="kc-designer__share" onClick={exportPdf} disabled={!cards?.length || busy}>
          {busy ? <Loader2 className="kc-spin" /> : <Share2 />} {t("designer.share", "Print / share")}
        </button>
      </header>

      {!cards ? <div className="kc-designer__empty"><Loader2 className="kc-spin" /></div> : !card ? (
        <p className="kc-designer__empty">{t("designer.empty", "No cards yet")}</p>
      ) : (
        <>
          <div className="kc-designer__themes" role="radiogroup" aria-label={t("designer.theme", "Colour theme")}>
            {THEMES.map((th) => (
              <button key={th.id} role="radio" aria-checked={theme.id === th.id} aria-label={th.id}
                className={cn("kc-swatch", theme.id === th.id && "is-active")}
                style={{ background: `hsl(var(${th.bg}))`, borderColor: `hsl(var(${th.accent}))` }} onClick={() => setTheme(th)} />
            ))}
          </div>

          <div className="kc-designer__stage">
            <button className="kc-designer__icon" onClick={() => go(-1)} disabled={idx === 0} aria-label={t("designer.prev", "Previous card")}><ChevronLeft /></button>
            <div ref={boxRef} className={cn("kc-card", `is-${tool}`)}
              style={{ background: `hsl(var(${theme.bg}))`, color: `hsl(var(${theme.fg}))` }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => (drag.current = null)}>
              <div className="kc-card__logo" style={{ color: `hsl(var(${theme.accent}))` }}>SERM<br />ABLE</div>
              <div className="kc-card__meta">{card.label}<br />{idx + 1}/{cards.length}</div>
              {card.words.filter((w) => w.kept).map((w) => (
                <span key={w.id} data-wid={w.id} className={cn("kc-card__word", w.hard && "is-hard")}
                  style={{ left: `${w.x * 100}%`, top: `${w.y * 100}%` }}>{w.w}</span>
              ))}
              <svg ref={svgRef} className="kc-card__ink" viewBox="0 0 1 1" preserveAspectRatio="none">
                {card.strokes.map((s, i) => (
                  <polyline key={i} points={s.map((p) => p.join(",")).join(" ")} fill="none"
                    stroke={`hsl(var(${theme.accent}))`} strokeWidth={4} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
            </div>
            <button className="kc-designer__icon" onClick={() => go(1)} disabled={idx === cards.length - 1} aria-label={t("designer.next", "Next card")}><ChevronRight /></button>
          </div>

          <div className="kc-designer__tools">
            {tools.map(({ id: tid, Icon, label }) => (
              <button key={tid} className={cn("kc-tool", tool === tid && "is-active")} onClick={() => setTool(tid)}><Icon />{label}</button>
            ))}
            <button className="kc-tool" onClick={() => update((c) => ({ ...c, strokes: [] }))} disabled={!card.strokes.length}><Eraser />{t("designer.clear", "Clear drawing")}</button>
          </div>
          <p className="kc-designer__hint">{t(`designer.hint_${tool}`, tool === "select" ? "Tap a word to remove it. Swipe the card to switch." : tool === "move" ? "Drag words to place them." : "Draw on the card with your finger.")}</p>

          <section className="kc-designer__tray">
            <h2>{t("designer.addWords", "Tap to add back to the card")}</h2>
            <div>
              {removed.map((w) => <button key={w.id} className="kc-chip" onClick={() => addBack(w.id)}>{w.w}</button>)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
