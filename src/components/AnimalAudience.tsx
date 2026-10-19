import { useMemo } from "react";
import { Mic, X } from "lucide-react";

interface AnimalAudienceProps {
  progress: number;
  celebrating?: boolean;
  /** Which animal to show — rotates between sentences/beats. */
  variant?: number;
  /** Text shown while the animal celebrates, e.g. "Sentence done!". */
  doneLabel?: string;
  /** Instruction shown above the animal, e.g. "Say the sentence out loud". */
  promptLabel?: string;
  /** Called when the user taps the exit marker. */
  onExit?: () => void | Promise<void>;
}

type AnimalKind = "fox" | "bunny" | "frog" | "cat" | "bear" | "owl";

type Palette = {
  body: string;
  belly: string;
  accent: string;
  detail: string;
};

export const ANIMALS: { kind: AnimalKind; palette: Palette }[] = [
  { kind: "fox", palette: { body: "hsl(var(--animal-fox))", belly: "hsl(var(--animal-fox-light))", accent: "hsl(var(--animal-fox-dark))", detail: "hsl(var(--animal-fox-detail))" } },
  { kind: "bunny", palette: { body: "hsl(var(--animal-bunny))", belly: "hsl(var(--animal-bunny-light))", accent: "hsl(var(--animal-bunny-dark))", detail: "hsl(var(--animal-bunny-detail))" } },
  { kind: "frog", palette: { body: "hsl(var(--animal-frog))", belly: "hsl(var(--animal-frog-light))", accent: "hsl(var(--animal-frog-dark))", detail: "hsl(var(--animal-frog-detail))" } },
  { kind: "cat", palette: { body: "hsl(var(--animal-cat))", belly: "hsl(var(--animal-cat-light))", accent: "hsl(var(--animal-cat-dark))", detail: "hsl(var(--animal-cat-detail))" } },
  { kind: "bear", palette: { body: "hsl(var(--animal-bear))", belly: "hsl(var(--animal-bear-light))", accent: "hsl(var(--animal-bear-dark))", detail: "hsl(var(--animal-bear-detail))" } },
  { kind: "owl", palette: { body: "hsl(var(--animal-owl))", belly: "hsl(var(--animal-owl-light))", accent: "hsl(var(--animal-owl-dark))", detail: "hsl(var(--animal-owl-detail))" } },
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const OUTLINE = "hsl(var(--animal-outline, 216 48% 23%))";
const SW = 3;

/**
 * Sticker-style critter on a 120 x 140 canvas: chunky navy outline, one
 * rounded silhouette, big glossy eyes with brows that lift with `mood`.
 */
const Ears = ({ kind, palette, mood }: { kind: AnimalKind; palette: Palette; mood: number }) => {
  const o = { stroke: OUTLINE, strokeWidth: SW, strokeLinejoin: "round" as const };
  if (kind === "fox" || kind === "cat") {
    const tip = kind === "fox" ? 6 : 12;
    return <>
      <path d={`M26 46 Q24 ${tip + 8} 34 ${tip} Q46 18 54 30 Z`} fill={palette.body} {...o} />
      <path d={`M94 46 Q96 ${tip + 8} 86 ${tip} Q74 18 66 30 Z`} fill={palette.body} {...o} />
      <path d={`M32 38 Q32 ${tip + 14} 36 ${tip + 10} Q42 24 46 31 Z`} fill={palette.belly} />
      <path d={`M88 38 Q88 ${tip + 14} 84 ${tip + 10} Q78 24 74 31 Z`} fill={palette.belly} />
    </>;
  }
  if (kind === "bunny") {
    const d = (1 - mood) * 16;
    return <>
      <g transform={`rotate(${-6 - d} 44 40)`}><ellipse cx="44" cy="16" rx="10" ry="26" fill={palette.body} {...o} /><ellipse cx="44" cy="18" rx="4.5" ry="16" fill={palette.belly} /></g>
      <g transform={`rotate(${6 + d} 76 40)`}><ellipse cx="76" cy="16" rx="10" ry="26" fill={palette.body} {...o} /><ellipse cx="76" cy="18" rx="4.5" ry="16" fill={palette.belly} /></g>
    </>;
  }
  if (kind === "bear") {
    return <>
      <circle cx="30" cy="28" r="13" fill={palette.body} {...o} /><circle cx="30" cy="28" r="6" fill={palette.belly} />
      <circle cx="90" cy="28" r="13" fill={palette.body} {...o} /><circle cx="90" cy="28" r="6" fill={palette.belly} />
    </>;
  }
  if (kind === "owl") {
    return <>
      <path d="M30 34 Q28 14 40 12 Q44 24 48 28 Z" fill={palette.accent} {...o} />
      <path d="M90 34 Q92 14 80 12 Q76 24 72 28 Z" fill={palette.accent} {...o} />
    </>;
  }
  return <>
    <circle cx="38" cy="30" r="15" fill={palette.body} {...o} />
    <circle cx="82" cy="30" r="15" fill={palette.body} {...o} />
  </>;
};

export const Animal = ({ kind, palette, mood, celebrating }: { kind: AnimalKind; palette: Palette; mood: number; celebrating: boolean }) => {
  const transition = "all 360ms cubic-bezier(0.34, 1.56, 0.64, 1)";
  const o = { stroke: OUTLINE, strokeWidth: SW, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const blush = "hsl(var(--bubblegum, 337 88% 80%))";
  const glint = "hsl(var(--animal-eye-glint))";
  const armAngle = 10 + mood * 70;

  const eyeY = kind === "frog" ? 30 : 58;
  const eyeLX = kind === "frog" ? 38 : 45;
  const eyeRX = kind === "frog" ? 82 : 75;
  const eyeR = 7 + mood * 1.5;
  const lid = Math.max(0, (1 - mood) * 7);
  const brow = 10 + mood * 4;
  const browTilt = (1 - mood) * 4;
  const mouthY = kind === "frog" ? 76 : 76;
  const smile = 2 + mood * 9;

  return (
    <svg viewBox="0 0 120 140" className="s-gg s-y7 s-mo" style={{ overflow: "visible", transform: celebrating ? "scale(1.05)" : `scale(${0.95 + mood * 0.05})`, transition }} aria-hidden="true">
      {/* Ground shadow */}
      <ellipse cx="60" cy="136" rx={30 + mood * 4} ry="4" fill={OUTLINE} opacity="0.12" />

      {kind === "fox" && <path d="M86 118 Q114 116 110 88 Q106 76 96 84 Q102 100 84 106 Z" fill={palette.body} {...o} />}
      {kind === "fox" && <path d="M104 82 Q110 84 110 92 Q104 90 100 84 Z" fill={palette.belly} />}
      {kind === "cat" && <path d="M88 118 Q112 116 104 90" fill="none" stroke={OUTLINE} strokeWidth={SW + 8} strokeLinecap="round" />}
      {kind === "cat" && <path d="M88 118 Q112 116 104 90" fill="none" stroke={palette.body} strokeWidth="8" strokeLinecap="round" />}
      {kind === "bunny" && <circle cx="92" cy="120" r="8" fill={palette.belly} {...o} />}

      <Ears kind={kind} palette={palette} mood={mood} />

      {/* One soft silhouette: head + body */}
      <path d="M60 22 C92 22 100 46 98 70 C97 88 92 100 90 112 C88 128 76 134 60 134 C44 134 32 128 30 112 C28 100 23 88 22 70 C20 46 28 22 60 22 Z" fill={palette.body} {...o} />
      <ellipse cx="60" cy="114" rx="19" ry="15" fill={palette.belly} />
      {kind === "owl" && <path d="M52 108 l4 4 4 -4 4 4 4 -4" fill="none" stroke={palette.accent} strokeWidth="2" strokeLinecap="round" />}

      {/* Arms */}
      <g className={celebrating ? "animal-arm animal-arm--left" : undefined} style={{ transformOrigin: "32px 100px", transform: `rotate(${-armAngle}deg)`, transition }}>
        <ellipse cx="28" cy="108" rx="7" ry="10" fill={palette.body} {...o} />
      </g>
      <g className={celebrating ? "animal-arm animal-arm--right" : undefined} style={{ transformOrigin: "88px 100px", transform: `rotate(${armAngle}deg)`, transition }}>
        <ellipse cx="92" cy="108" rx="7" ry="10" fill={palette.body} {...o} />
      </g>

      {/* Face patches */}
      {(kind === "fox" || kind === "bear") && <ellipse cx="60" cy="74" rx="17" ry="12" fill={palette.belly} />}
      {kind === "owl" && <><circle cx="45" cy="58" r="15" fill={palette.belly} /><circle cx="75" cy="58" r="15" fill={palette.belly} /></>}

      {/* Brows */}
      {kind !== "frog" && <>
      <path d={`M${eyeLX - 7} ${eyeY - brow + browTilt} Q${eyeLX} ${eyeY - brow - 3} ${eyeLX + 7} ${eyeY - brow}`} fill="none" stroke={OUTLINE} strokeWidth="2.5" strokeLinecap="round" style={{ transition }} />
      <path d={`M${eyeRX - 7} ${eyeY - brow} Q${eyeRX} ${eyeY - brow - 3} ${eyeRX + 7} ${eyeY - brow + browTilt}`} fill="none" stroke={OUTLINE} strokeWidth="2.5" strokeLinecap="round" style={{ transition }} />

      </>}

      {/* Eyes */}
      <g className="animal-eyes" style={{ transformOrigin: `60px ${eyeY}px` }}>
        {celebrating ? <>
          <path d={`M${eyeLX - 7} ${eyeY + 2} Q${eyeLX} ${eyeY - 8} ${eyeLX + 7} ${eyeY + 2}`} fill="none" stroke={OUTLINE} strokeWidth="3.5" strokeLinecap="round" />
          <path d={`M${eyeRX - 7} ${eyeY + 2} Q${eyeRX} ${eyeY - 8} ${eyeRX + 7} ${eyeY + 2}`} fill="none" stroke={OUTLINE} strokeWidth="3.5" strokeLinecap="round" />
        </> : <>
          {kind === "frog" && <><circle cx={eyeLX} cy={eyeY} r={eyeR + 3} fill={glint} /><circle cx={eyeRX} cy={eyeY} r={eyeR + 3} fill={glint} /></>}
          <circle cx={eyeLX} cy={eyeY} r={eyeR} fill={OUTLINE} style={{ transition }} />
          <circle cx={eyeRX} cy={eyeY} r={eyeR} fill={OUTLINE} style={{ transition }} />
          <circle cx={eyeLX + 2.5} cy={eyeY - 2.5} r="2.6" fill={glint} />
          <circle cx={eyeRX + 2.5} cy={eyeY - 2.5} r="2.6" fill={glint} />
          <circle cx={eyeLX - 2} cy={eyeY + 2.5} r="1.2" fill={glint} />
          <circle cx={eyeRX - 2} cy={eyeY + 2.5} r="1.2" fill={glint} />
          {lid > 0.5 && <>
            <rect x={eyeLX - 10} y={eyeY - 11} width="20" height={lid + 2} fill={kind === "owl" ? palette.belly : palette.body} style={{ transition }} />
            <rect x={eyeRX - 10} y={eyeY - 11} width="20" height={lid + 2} fill={kind === "owl" ? palette.belly : palette.body} style={{ transition }} />
          </>}
        </>}
      </g>

      {/* Cheeks */}
      <ellipse cx="33" cy="72" rx="6" ry="3.6" fill={blush} style={{ opacity: 0.3 + mood * 0.7, transition }} />
      <ellipse cx="87" cy="72" rx="6" ry="3.6" fill={blush} style={{ opacity: 0.3 + mood * 0.7, transition }} />

      {/* Nose / beak */}
      {kind === "owl"
        ? <path d="M55 68 L65 68 L60 76 Z" fill="hsl(var(--animal-beak))" {...o} strokeWidth="2" />
        : kind !== "frog" && <path d="M56 67 Q60 65 64 67 Q62 71 60 71 Q58 71 56 67 Z" fill={OUTLINE} />}

      {kind === "cat" && <g stroke={OUTLINE} strokeWidth="1.8" strokeLinecap="round" opacity="0.6">
        <line x1="14" y1="70" x2="30" y2="72" /><line x1="16" y1="78" x2="30" y2="76" />
        <line x1="90" y1="72" x2="106" y2="70" /><line x1="90" y1="76" x2="104" y2="78" />
      </g>}

      {/* Mouth */}
      {celebrating || mood > 0.75
        ? <g>
            <path d={`M50 ${mouthY} Q60 ${mouthY + 2} 70 ${mouthY} Q68 ${mouthY + 14} 60 ${mouthY + 14} Q52 ${mouthY + 14} 50 ${mouthY} Z`} fill={OUTLINE} {...o} strokeWidth="2" />
            <ellipse cx="60" cy={mouthY + 10} rx="5" ry="3" fill={blush} />
          </g>
        : <path d={`M52 ${mouthY} Q60 ${mouthY + smile} 68 ${mouthY}`} fill="none" stroke={OUTLINE} strokeWidth="3" strokeLinecap="round" style={{ transition }} />}
      {kind === "bunny" && !celebrating && mood <= 0.75 && <rect x="57" y={mouthY + 1} width="6" height="6" rx="2" fill={glint} stroke={OUTLINE} strokeWidth="1.5" />}
    </svg>
  );
};

const AnimalAudience = ({ progress, celebrating = false, variant = 0, promptLabel, doneLabel, onExit }: AnimalAudienceProps) => {
  const trio = useMemo(() => {
    const base = ((Math.trunc(variant) % ANIMALS.length) + ANIMALS.length) % ANIMALS.length;
    return [0, 1, 2].map(o => ANIMALS[(base + o * 2) % ANIMALS.length]);
  }, [variant]);
  const mood = clamp01(progress);
  const done = celebrating || mood >= 1;

  return (
    <div
      role="status"
      style={{
        position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 32,
        background: "hsl(var(--background))",
        padding: "max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))",
      }}
    >
      {onExit && (
        <button
          type="button"
          onClick={() => onExit()}
          aria-label="Exit"
          style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", right: 16, padding: 10, borderRadius: 999, background: "hsl(var(--muted))", color: "hsl(var(--foreground))", border: 0 }}
        >
          <X size={20} />
        </button>
      )}
      <p style={{ fontSize: 20, fontWeight: 600, color: "hsl(var(--foreground))", textAlign: "center", maxWidth: 420 }}>
        {done && doneLabel ? doneLabel : promptLabel}
      </p>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12, width: "100%", maxWidth: 560 }}>
        {trio.map((a, i) => (
          <div
            key={a.kind}
            className={`animal-audience__character ${done ? "is-celebrating" : "is-idle"}`}
            style={{
              flex: i === 1 ? 1.3 : 1,
              aspectRatio: "120 / 140",
              animationDelay: `${i * (done ? 120 : 420)}ms`,
              // Bob faster and higher the closer the speaker gets to finishing.
              animationDuration: done ? undefined : `${Math.round(3200 - mood * 2000)}ms`,
              ["--bob-height" as string]: `${-1.5 - mood * 5}%`,
            }}
          >
            <Animal kind={a.kind} palette={a.palette} mood={mood} celebrating={done} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "hsl(var(--muted-foreground))" }}>
        <Mic size={18} />
        <div style={{ width: 160, height: 6, borderRadius: 999, background: "hsl(var(--muted))", overflow: "hidden" }}>
          <div style={{ width: `${mood * 100}%`, height: "100%", background: "hsl(var(--primary))", transition: "width 250ms ease" }} />
        </div>
      </div>
    </div>
  );
};

export default AnimalAudience;
