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
