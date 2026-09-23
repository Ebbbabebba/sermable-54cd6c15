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

/**
 * Cute critter design: oversized head, tiny round body, big glossy eyes,
 * blush cheeks and a smile that grows with `mood` (0 = sleepy, 1 = thrilled).
 * Canvas: 120 x 140. Head center ~(60, 56), body below.
 */
const Ears = ({ kind, palette, mood }: { kind: AnimalKind; palette: Palette; mood: number }) => {
  if (kind === "fox") {
    return <>
      <polygon points="26,34 34,4 50,30" fill={palette.body} />
      <polygon points="70,30 86,4 94,34" fill={palette.body} />
      <polygon points="33,28 36,13 45,28" fill={palette.belly} />
      <polygon points="75,28 84,13 87,28" fill={palette.belly} />
    </>;
  }
  if (kind === "bunny") {
    const droop = (1 - mood) * 14;
    return <>
      <ellipse cx="42" cy="14" rx="9" ry="26" fill={palette.body} transform={`rotate(${-8 - droop} 42 38)`} />
      <ellipse cx="78" cy="14" rx="9" ry="26" fill={palette.body} transform={`rotate(${8 + droop} 78 38)`} />
      <ellipse cx="42" cy="15" rx="4" ry="17" fill={palette.belly} transform={`rotate(${-8 - droop} 42 38)`} />
      <ellipse cx="78" cy="15" rx="4" ry="17" fill={palette.belly} transform={`rotate(${8 + droop} 78 38)`} />
    </>;
  }
  if (kind === "cat") {
    return <>
      <polygon points="25,33 30,6 49,27" fill={palette.body} />
      <polygon points="71,27 90,6 95,33" fill={palette.body} />
      <polygon points="31,27 33,14 43,26" fill={palette.belly} />
      <polygon points="77,26 87,14 89,27" fill={palette.belly} />
    </>;
  }
  if (kind === "bear") {
    return <>
      <circle cx="30" cy="26" r="13" fill={palette.body} />
      <circle cx="90" cy="26" r="13" fill={palette.body} />
      <circle cx="30" cy="26" r="6" fill={palette.belly} />
      <circle cx="90" cy="26" r="6" fill={palette.belly} />
    </>;
  }
  if (kind === "owl") {
    return <>
      <polygon points="27,32 35,8 49,28" fill={palette.accent} />
      <polygon points="71,28 85,8 93,32" fill={palette.accent} />
    </>;
  }
  // frog: eye bumps
  return <>
    <circle cx="38" cy="26" r="14" fill={palette.body} />
    <circle cx="82" cy="26" r="14" fill={palette.body} />
  </>;
};

export const Animal = ({
  kind,
  palette,
  mood,
  celebrating,
}: {
  kind: AnimalKind;
  palette: Palette;
  mood: number;
  celebrating: boolean;
}) => {
  const transition = "all 360ms cubic-bezier(0.34, 1.56, 0.64, 1)";
  const armAngle = 10 + mood * 75;
  const blush = "hsl(var(--animal-blush, 350 80% 75% / 0.55))";
  const eyeGlint = "hsl(var(--animal-eye-glint))";

  // Eyes: sleepy lids when mood is low, big sparkle when high
  const eyeR = 6.2 + mood * 1.2;
  const lidHeight = Math.max(0, (1 - mood) * 9);
  const frogEyeY = 24;
  const eyeY = kind === "frog" ? frogEyeY : 52;
  const eyeLX = kind === "frog" ? 38 : 44;
  const eyeRX = kind === "frog" ? 82 : 76;

  const mouthY = kind === "frog" ? 74 : kind === "owl" ? 78 : 72;
  const smileDepth = 3 + mood * 10;

  return (
    <svg
      viewBox="0 0 120 140"
      className="h-full w-full overflow-visible drop-shadow-xl"
      style={{
        transform: celebrating ? "scale(1.05)" : `translateY(${(1 - mood) * 2.5}%) scale(${0.96 + mood * 0.04})`,
        transition,
      }}
      aria-hidden="true"
    >
      {/* Tail / back details behind the body */}
      {kind === "fox" && <path d="M30 112 Q4 108 6 82 Q10 66 22 70 Q14 88 34 94 Z" fill={palette.body} />}
      {kind === "fox" && <circle cx="10" cy="74" r="7" fill={palette.belly} />}
      {kind === "cat" && <path d="M92 104 Q114 104 105 82" fill="none" stroke={palette.body} strokeWidth="9" strokeLinecap="round" />}
      {kind === "bunny" && <circle cx="92" cy="112" r="9" fill={palette.belly} />}

      {/* Tiny round body */}
      <ellipse cx="60" cy="112" rx="30" ry="24" fill={palette.body} />
      {kind !== "owl" && <ellipse cx="60" cy="118" rx="17" ry="14" fill={palette.belly} />}

      {/* Little feet */}
      <ellipse cx="46" cy="134" rx="10" ry="5" fill={palette.accent} />
      <ellipse cx="74" cy="134" rx="10" ry="5" fill={palette.accent} />

      {/* Stubby arms that rise with mood */}
      <g style={{ transformOrigin: "38px 106px", transform: `rotate(${-armAngle}deg)`, transition }}>
        <circle cx="34" cy="106" r="8.5" fill={palette.body} />
      </g>
      <g style={{ transformOrigin: "82px 106px", transform: `rotate(${armAngle}deg)`, transition }}>
        <circle cx="86" cy="106" r="8.5" fill={palette.body} />
      </g>

      {/* Ears / eye bumps */}
      <Ears kind={kind} palette={palette} mood={mood} />

      {/* Big head */}
      {kind === "owl"
        ? <circle cx="60" cy="56" r="34" fill={palette.body} />
        : <circle cx="60" cy={kind === "frog" ? 62 : 56} r={kind === "bear" ? 36 : kind === "frog" ? 34 : 35} fill={palette.body} />}

      {/* Muzzle / face patches */}
      {kind === "fox" && <ellipse cx="60" cy="66" rx="16" ry="12" fill={palette.belly} />}
      {kind === "bear" && <ellipse cx="60" cy="66" rx="15" ry="11" fill={palette.belly} />}
      {kind === "owl" && <>
        <circle cx="45" cy="54" r="14" fill={palette.belly} />
        <circle cx="75" cy="54" r="14" fill={palette.belly} />
      </>}

      {/* Eyes */}
      {kind === "owl" ? <>
        <circle cx="45" cy={54 - mood * 1.5} r={eyeR - 1} fill={palette.detail} />
        <circle cx="75" cy={54 - mood * 1.5} r={eyeR - 1} fill={palette.detail} />
        <circle cx="47" cy={51 - mood * 1.5} r="2.2" fill={eyeGlint} />
        <circle cx="77" cy={51 - mood * 1.5} r="2.2" fill={eyeGlint} />
      </> : <>
        <circle cx={eyeLX} cy={eyeY - mood * 1.5} r={eyeR} fill={palette.detail} />
        <circle cx={eyeRX} cy={eyeY - mood * 1.5} r={eyeR} fill={palette.detail} />
        <circle cx={eyeLX + 2} cy={eyeY - 2.5 - mood * 1.5} r="2.2" fill={eyeGlint} />
        <circle cx={eyeRX + 2} cy={eyeY - 2.5 - mood * 1.5} r="2.2" fill={eyeGlint} />
        {lidHeight > 0.5 && <>
          <rect x={eyeLX - 9} y={eyeY - 10} width="18" height={lidHeight} rx="4" fill={palette.body} style={{ transition }} />
          <rect x={eyeRX - 9} y={eyeY - 10} width="18" height={lidHeight} rx="4" fill={palette.body} style={{ transition }} />
        </>}
      </>}

      {/* Blush cheeks */}
      {kind !== "owl" && <>
        <ellipse cx="32" cy={kind === "frog" ? 62 : 66} rx="6.5" ry="4" fill={blush} style={{ opacity: 0.35 + mood * 0.65, transition }} />
        <ellipse cx="88" cy={kind === "frog" ? 62 : 66} rx="6.5" ry="4" fill={blush} style={{ opacity: 0.35 + mood * 0.65, transition }} />
      </>}

      {/* Nose / beak */}
      {kind !== "frog" && kind !== "owl" && <>
        <ellipse cx="60" cy={kind === "fox" || kind === "bear" ? 62 : 62} rx="4.2" ry="3.2" fill={palette.detail} />
      </>}
      {kind === "owl" && <polygon points="60,66 53,74 67,74" fill="hsl(var(--animal-beak))" />}

      {/* Whiskers for the cat */}
      {kind === "cat" && <>
        <line x1="18" y1="62" x2="36" y2="65" stroke={palette.detail} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        <line x1="18" y1="70" x2="36" y2="69" stroke={palette.detail} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        <line x1="84" y1="65" x2="102" y2="62" stroke={palette.detail} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        <line x1="84" y1="69" x2="102" y2="70" stroke={palette.detail} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      </>}

      {/* Mouth: soft smile that opens wide when celebrating */}
      {celebrating
        ? <path d={`M48 ${mouthY} Q60 ${mouthY + 16} 72 ${mouthY} Q60 ${mouthY + 7} 48 ${mouthY} Z`} fill={palette.detail} />
        : <path d={`M50 ${mouthY} Q60 ${mouthY + smileDepth} 70 ${mouthY}`} fill="none" stroke={palette.detail} strokeWidth="3" strokeLinecap="round" />}

      {/* Bunny buck tooth */}
      {kind === "bunny" && !celebrating && <rect x="57" y={mouthY + 2} width="6" height="6" rx="2" fill={eyeGlint} />}
    </svg>
  );
};

const AnimalAudience = ({ celebrating = true, variant = 0, doneLabel, onExit }: AnimalAudienceProps) => {
  const trio = useMemo(() => {
    const base = ((Math.trunc(variant) % ANIMALS.length) + ANIMALS.length) % ANIMALS.length;
    return [0, 1, 2].map(o => ANIMALS[(base + o * 2) % ANIMALS.length]);
  }, [variant]);

  return (
    <div
      className="animal-audience fixed inset-0 z-30 flex items-end justify-center overflow-hidden bg-foreground/20 backdrop-blur-[2px] animate-fade-in"
      role="status"
    >
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 22 }, (_, index) => (
          <span
            key={index}
            className={`animal-confetti animal-confetti--${index % 3}`}
            style={{ left: `${4 + ((index * 29) % 92)}%`, animationDelay: `${(index % 7) * 60}ms`, transform: `rotate(${index * 31}deg)` }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-3 mb-[calc(env(safe-area-inset-bottom,0px)+1rem)] w-full max-w-md animate-scale-in rounded-[2rem] bg-card px-6 pb-7 pt-5 text-center shadow-2xl ring-1 ring-border/50">
        <div className="-mt-20 mb-2 flex items-end justify-center gap-1">
          {trio.map((a, i) => (
            <div
              key={a.kind}
              className="animal-audience__character is-celebrating"
              style={{ width: i === 1 ? 128 : 96, height: i === 1 ? 150 : 112, animationDelay: `${i * 120}ms` }}
            >
              <Animal kind={a.kind} palette={a.palette} mood={1} celebrating={celebrating} />
            </div>
          ))}
        </div>
        <p className="text-3xl font-extrabold tracking-tight text-success">{doneLabel}</p>
        <div className="mx-auto mt-4 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-full origin-left rounded-full bg-success animate-[animal-timer_2.4s_linear_forwards]" />
        </div>
      </div>
    </div>
  );
};

export default AnimalAudience;
