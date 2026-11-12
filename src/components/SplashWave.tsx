import { useEffect, useRef, useState } from "react";

/**
 * SplashWave – Apple-inspirerad startanimation.
 *
 * 1. SERM/ABLE glider upp rad för rad ur en mask – skarpt, utan oskärpa.
 * 2. En fin ljudvåg skrivs fram från vänster till höger med mjuk fjädring.
 * 3. Vågen lägger sig till en prickad linje.
 * 4. Allt zoomar lätt och tonas ut – som när en iOS-app öppnas.
 * Totalt ~2,8 s. Ingen mikrofon används. "Reducera rörelse" ger en lugn version.
 *
 * Användning (t.ex. i App.tsx):
 *   const [ready, setReady] = useState(false);
 *   if (!ready) return <SplashWave onDone={() => setReady(true)} />;
 *
 * Visa den bara vid kallstart och dölj Capacitors egen splash direkt:
 *   import { SplashScreen } from "@capacitor/splash-screen"; SplashScreen.hide();
 */

type Props = { onDone?: () => void };

// blå → indigo → lila → rosa → orange. Läses från --wave-1 … --wave-6 i index.css,
// så startskärmen alltid har samma färger som resten av appen. Värdena nedan är reserv.
const FALLBACK: [number, number, number][] = [
  [204, 90, 58], [232, 78, 64], [268, 70, 66], [322, 72, 66], [356, 85, 66], [28, 92, 60],
];

function readStops(): [number, number, number][] {
  const cs = getComputedStyle(document.documentElement);
  const stops = FALLBACK.map((fb, i) => {
    const m = cs.getPropertyValue(`--wave-${i + 1}`).trim().match(/^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
    return m ? ([+m[1], +m[2], +m[3]] as [number, number, number]) : fb;
  });
  // gå den korta vägen runt färghjulet så att orange inte passerar grönt
  for (let i = 1; i < stops.length; i++) while (stops[i][0] < stops[i - 1][0]) stops[i][0] += 360;
  return stops;
}

const T_START = 380, T_WRITE = 900, T_GROW = 380;   // vågen skrivs fram
const T_SETTLE = 1550, T_SWEEP = 350, T_FALL = 420;  // vågen lägger sig
const T_LEAVE = 2350, T_LEAVE_DUR = 450;             // utgång

const BARS = 56;
const H = 110;

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (x: number) => { x = clamp(x); return x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2; };
const spring = (x: number) => { x = clamp(x); const c1 = 1.1, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };

function colorAt(stops: [number, number, number][], x: number) {
  x = clamp(x);
  const p = x * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(p)), f = p - i;
  const a = stops[i], b = stops[i + 1];
  return `hsl(${a[0] + (b[0] - a[0]) * f} ${a[1] + (b[1] - a[1]) * f}% ${a[2] + (b[2] - a[2]) * f}%)`;
}

function makeSpeech() {
  const raw: number[] = [];
  while (raw.length < BARS) {
    const len = 4 + Math.floor(Math.random() * 5), peak = 0.45 + Math.random() * 0.55;
    for (let k = 0; k < len && raw.length < BARS; k++)
      raw.push(peak * Math.sin((Math.PI * (k + 0.5)) / len) * (0.8 + Math.random() * 0.2));
    if (Math.random() < 0.5 && raw.length < BARS) raw.push(0.05);
  }
  return raw.map((v, j) => {
    const s = (raw[j - 1] ?? v) * 0.25 + v * 0.5 + (raw[j + 1] ?? v) * 0.25;
    return s * (0.35 + 0.65 * Math.sin((Math.PI * (j + 0.5)) / BARS));
  });
}

// Ordmärket SERM/ABLE – samma kraftiga grotesk som loggan (resten av appen använder Figtree)
const LOGO_FONT = '"Helvetica Neue", Helvetica, -apple-system, BlinkMacSystemFont, Arial, sans-serif';

export function SplashWave({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showLogo, setShowLogo] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dark =
      document.documentElement.classList.contains("dark") ||
      (!document.documentElement.classList.contains("light") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const stops = readStops();
    const glow = dark ? 0.25 : 0; // svagt sken bara i mörkt läge
    const resize = () => {
      const d = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * d;
      canvas.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const heights = makeSpeech();
    let t0 = Infinity, raf = 0, left = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const kick = requestAnimationFrame(() =>
      requestAnimationFrame(() => { setShowLogo(true); t0 = performance.now(); }),
    );

    const frame = (now: number) => {
      const t = Math.max(0, now - t0);
      const w = canvas.clientWidth;
      ctx.clearRect(0, 0, w, H);
      const gap = 3, x0 = 28, mid = H / 2;
      const bw = Math.max(1.5, (w - x0 * 2 - gap * (BARS - 1)) / BARS);

      for (let j = 0; j < BARS; j++) {
        const x = j / (BARS - 1);
        const tw = reduce ? 0 : T_START + x * T_WRITE;
        const ts = T_SETTLE + (reduce ? 0 : x * T_SWEEP);
        if (t0 === Infinity || t < tw) continue;
        const grow = reduce ? 1 : spring((t - tw) / T_GROW);
        const fall = easeInOut((t - ts) / T_FALL);
        const live = 0.9 + 0.1 * Math.sin(now / 220 + j * 0.45) * Math.cos(now / 340 - j * 0.2);
        const v = Math.max(0, heights[j] * grow * live * (1 - fall));
        const bh = Math.max(bw, v * (H - 20));
        const col = colorAt(stops, x);
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 8 * glow * Math.min(1, v * 2);
        ctx.globalAlpha = (0.55 + 0.45 * Math.min(1, v * 1.8)) * (1 - 0.35 * fall);
        ctx.beginPath();
        ctx.roundRect(x0 + j * (bw + gap), mid - bh / 2, bw, bh, bw / 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      if (t > T_LEAVE && !left) {
        left = true;
        setLeaving(true);
        timer = setTimeout(() => doneRef.current?.(), T_LEAVE_DUR);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(kick);
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      window.removeEventListener("resize", resize);
    };
  }, [reduce]);

  const curve = "cubic-bezier(.22,1,.36,1)";
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "hsl(var(--background, 0 0% 100%))",
        color: "hsl(var(--foreground, 222 30% 11%))",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 18, paddingBottom: 40,
        opacity: leaving ? 0 : 1,
        transform: leaving && !reduce ? "scale(1.02)" : "none",
        transition: `opacity ${T_LEAVE_DUR}ms cubic-bezier(.4,0,.2,1), transform ${T_LEAVE_DUR}ms cubic-bezier(.4,0,.2,1)`,
      }}
    >
      <h1
        aria-label="Sermable"
        style={{ margin: 0, textAlign: "center", fontFamily: LOGO_FONT, fontWeight: 800, fontSize: 56, lineHeight: 0.9, letterSpacing: "-0.5px" }}
      >
        {["SERM", "ABLE"].map((word, i) => (
          <span key={word} style={{ display: "block", overflow: "hidden", padding: "2px 4px 4px" }}>
            <span
              style={{
                display: "block",
                opacity: showLogo ? 1 : 0,
                transform: showLogo || reduce ? "none" : "translateY(105%)",
                transition: `transform 750ms ${curve} ${i * 90}ms, opacity 400ms ease ${i * 90}ms`,
              }}
            >
              {word}
            </span>
          </span>
        ))}
      </h1>
      <canvas ref={canvasRef} aria-hidden="true" style={{ width: "100%", height: H, display: "block" }} />
    </div>
  );
}

export default SplashWave;
