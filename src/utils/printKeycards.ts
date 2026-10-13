export interface PrintableCard {
  label: string;
  keywords: { w: string; hard: boolean }[];
  text: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function buildKeycardsHtml(title: string, cards: PrintableCard[], counter: (i: number, n: number) => string) {
  const body = cards
    .map(
      (c, i) => `<section class="card">
  <header><div class="logo"><span>SERM</span><span>ABLE</span></div><div class="meta">${esc(c.label)}<br>${esc(counter(i + 1, cards.length))}</div></header>
  <div class="kw">${c.keywords.map((k) => `<span class="${k.hard ? "hard" : ""}">${esc(k.w)}</span>`).join(" ")}</div>
  <footer>${esc(c.text)}</footer>
</section>`
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:A4;margin:10mm}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;color:#111}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:0}
.card{height:138mm;padding:8mm;border:1px dashed #bbb;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid}
header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6mm}
.logo{display:flex;flex-direction:column;font-weight:800;letter-spacing:.08em;font-size:11pt;line-height:1}
.logo span:last-child{color:#2f6fe4}
.meta{font-size:8pt;color:#666;text-align:right}
.kw{flex:1;font-size:17pt;font-weight:600;line-height:1.5}
.kw span{margin-right:.35em}
.kw .hard{color:#c62828;text-decoration:underline}
footer{border-top:1px dashed #ccc;padding-top:3mm;font-size:8pt;color:#777;line-height:1.4}
</style></head><body><div class="grid">${body}</div></body></html>`;
}

export function printKeycards(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 60000);
    }
  }, 250);
}

import { stripStageDirections } from "@/utils/stageDirections";
import { getKeywordIndices, normalizeForKeyword } from "@/utils/keywordExtraction";
import { getSpeechWordErrors } from "@/utils/wordDifficulty";

type T = (key: string, opts: Record<string, unknown>) => string;
const STOP = new Set(["och","att","det","som","en","ett","the","and","that","with","this","from","have","which","there","their","about","would","could","should","und","der","die","das","nicht","eine","pour","dans","avec","para","como","sono","della","porque"]);

/** Builds keycards from a speech using the words the user actually missed or hesitated on in practice. */
export function printSpeechKeycards(speechId: string, speechText: string, t: T) {
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
  const cards: PrintableCard[] = groups.map((g, si) => {
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
  printKeycards(buildKeycardsHtml("Sermable", cards, (i, n) => t("keycards.printCounter", { i, n, defaultValue: "Card {{i}} of {{n}}" })));
}
