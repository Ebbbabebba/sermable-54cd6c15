export interface PrintableCard {
  label: string;
  keywords: { w: string; hard: boolean }[];
  text: string;
}

type Counter = (i: number, n: number) => string;
const safe = (s: string) => s.replace(/[\u2013\u2014]/g, "-");

/** Renders the cards to an A4 PDF (4 cut-out cards per page) and opens the native share sheet
 *  (Print, AirDrop, Mail, Save to Files) when available, otherwise downloads/opens the PDF. */
export async function printKeycards(cards: PrintableCard[], counter: Counter) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 10, cw = (W - 2 * M) / 2, ch = (H - 2 * M) / 2, pad = 7;
  cards.forEach((c, i) => {
    const slot = i % 4;
    if (i > 0 && slot === 0) doc.addPage();
    const x = M + (slot % 2) * cw, y = M + Math.floor(slot / 2) * ch;
    doc.setLineDashPattern([2, 2], 0); doc.setDrawColor(190); doc.rect(x, y, cw, ch);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(17);
    doc.text("SERM", x + pad, y + pad + 4); doc.setTextColor(47, 111, 228); doc.text("ABLE", x + pad, y + pad + 8.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110);
    doc.text([safe(c.label), safe(counter(i + 1, cards.length))], x + cw - pad, y + pad + 4, { align: "right" });
    // keywords, wrapped manually so hard words can be red
    doc.setFont("helvetica", "bold"); doc.setFontSize(17);
    let cx = x + pad, cy = y + pad + 24; const maxX = x + cw - pad, lh = 9;
    const footerTop = y + ch - pad - 22;
    for (const k of c.keywords) {
      const w = safe(k.w), ww = doc.getTextWidth(w), sp = doc.getTextWidth(" ");
      if (cx + ww > maxX && cx > x + pad) { cx = x + pad; cy += lh; }
      if (cy > footerTop - 2) break;
      if (k.hard) doc.setTextColor(198, 40, 40); else doc.setTextColor(17);
      doc.text(w, cx, cy);
      if (k.hard) { doc.setDrawColor(198, 40, 40); doc.setLineDashPattern([], 0); doc.line(cx, cy + 1, cx + ww, cy + 1); }
      cx += ww + sp;
    }
    doc.setLineDashPattern([1, 1], 0); doc.setDrawColor(200); doc.line(x + pad, footerTop, maxX, footerTop);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(doc.splitTextToSize(safe(c.text), cw - 2 * pad).slice(0, 5), x + pad, footerTop + 5);
  });
  await sharePdf(doc.output("blob"));
}

/** Opens the native share sheet (Print, AirDrop, Mail, Files) or downloads the PDF. */
export async function sharePdf(blob: Blob) {
  const file = new File([blob], "sermable-keycards.pdf", { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: "Sermable" }); return; }
    catch (e) { if ((e as Error)?.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "sermable-keycards.pdf"; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

import { stripStageDirections } from "@/utils/stageDirections";
import { getKeywordIndices, normalizeForKeyword } from "@/utils/keywordExtraction";
import { getSpeechWordErrors } from "@/utils/wordDifficulty";

type T = (key: string, opts: Record<string, unknown>) => string;
const STOP = new Set(["och","att","det","som","en","ett","the","and","that","with","this","from","have","which","there","their","about","would","could","should","und","der","die","das","nicht","eine","pour","dans","avec","para","como","sono","della","porque"]);

/** Builds keycards from a speech using the words the user actually missed or hesitated on in practice. */
export function buildSpeechCards(speechId: string, speechText: string, t: T): PrintableCard[] {
  const sentences = (stripStageDirections(speechText).match(/[^.!?]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean);
  const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const groups: { text: string; first: number; last: number }[] = [];
  let cur: string[] = []; let first = 0;
  sentences.forEach((s, i) => {
    const n = cur.reduce((a, c) => a + wc(c), 0);
    if (cur.length && n >= 6 && n + wc(s) > 15) { groups.push({ text: cur.join(" "), first, last: i - 1 }); cur = []; first = i; }
    cur.push(s);
  });
  if (cur.length) groups.push({ text: cur.join(" "), first, last: sentences.length - 1 });
  let levels: Record<string, number> = {};
  try { levels = JSON.parse(localStorage.getItem(`sermable:keycards:${speechId}`) || "{}"); } catch { /* ignore */ }
  const errors = getSpeechWordErrors(speechId);
  return groups.map((g, si) => {
    const words = g.text.split(/\s+/);
    const err = (i: number) => errors[normalizeForKeyword(words[i])] ?? 0;
    const hard = words.map((_, i) => i).filter((i) => err(i) > 0).sort((a, b) => err(b) - err(a));
    const kw = [...getKeywordIndices(words, STOP)].filter((i) => !hard.includes(i))
      .sort((a, b) => normalizeForKeyword(words[b]).length - normalizeForKeyword(words[a]).length);
    const n = Math.max(1, hard.length, Math.min(hard.length + kw.length, 4 + (levels[si] ?? 0) * 2));
    const chosen = [...new Set([...hard, ...kw].slice(0, n))].sort((a, b) => a - b);
    return {
      label: g.first === g.last
        ? t("keycards.printSentence", { n: g.first + 1, defaultValue: "Sentence {{n}}" })
        : t("keycards.printSentences", { a: g.first + 1, b: g.last + 1, defaultValue: "Sentence {{a}}–{{b}}" }),
      keywords: chosen.map((i) => ({ w: words[i].replace(/[.,!?;:]+$/, ""), hard: err(i) > 0 })),
      text: g.text,
    };
  });
}

export function printSpeechKeycards(speechId: string, speechText: string, t: T) {
  return printKeycards(buildSpeechCards(speechId, speechText, t), (i, n) => t("keycards.printCounter", { i, n, defaultValue: "Card {{i}} of {{n}}" }));
}
