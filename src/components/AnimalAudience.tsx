import { useMemo } from "react";
import { Mic } from "lucide-react";

interface AnimalAudienceProps {
  progress: number;
  celebrating?: boolean;
  /** Which animal to show — rotates between sentences/beats. */
  variant?: number;
  /** Text shown while the animal celebrates, e.g. "Sentence done!". */
  doneLabel?: string;
  /** Instruction shown above the animal, e.g. "Say the sentence out loud". */
  promptLabel?: string;
}

type AnimalKind = "fox" | "bunny" | "frog" | "cat" | "bear" | "owl";

type Palette = {
  body: string;
  belly: string;
  accent: string;
  detail: string;
};

const ANIMALS: { kind: AnimalKind; palette: Palette }[] = [
  { kind: "fox", palette: { body: "hsl(var(--animal-fox))", belly: "hsl(var(--animal-fox-light))", accent: "hsl(var(--animal-fox-dark))", detail: "hsl(var(--animal-fox-detail))" } },
  { kind: "bunny", palette: { body: "hsl(var(--animal-bunny))", belly: "hsl(var(--animal-bunny-light))", accent: "hsl(var(--animal-bunny-dark))", detail: "hsl(var(--animal-bunny-detail))" } },
  { kind: "frog", palette: { body: "hsl(var(--animal-frog))", belly: "hsl(var(--animal-frog-light))", accent: "hsl(var(--animal-frog-dark))", detail: "hsl(var(--animal-frog-detail))" } },
  { kind: "cat", palette: { body: "hsl(var(--animal-cat))", belly: "hsl(var(--animal-cat-light))", accent: "hsl(var(--animal-cat-dark))", detail: "hsl(var(--animal-cat-detail))" } },
  { kind: "bear", palette: { body: "hsl(var(--animal-bear))", belly: "hsl(var(--animal-bear-light))", accent: "hsl(var(--animal-bear-dark))", detail: "hsl(var(--animal-bear-detail))" } },
  { kind: "owl", palette: { body: "hsl(var(--animal-owl))", belly: "hsl(var(--animal-owl-light))", accent: "hsl(var(--animal-owl-dark))", detail: "hsl(var(--animal-owl-detail))" } },
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const AnimalEars = ({ kind, palette, mood }: { kind: AnimalKind; palette: Palette; mood: number }) => {
  if (kind === "fox") {
    return <>
      <polygon points="18,31 31,2 45,28" fill={palette.accent} />
      <polygon points="55,28 69,2 82,31" fill={palette.accent} />
      <polygon points="24,26 31,11 39,26" fill={palette.belly} />
      <polygon points="61,26 69,11 76,26" fill={palette.belly} />
    </>;
  }

  if (kind === "bunny") {
    const droop = (1 - mood) * 22;
    return <>
      <ellipse cx="32" cy="12" rx="8" ry="23" fill={palette.body} transform={`rotate(${-9 - droop} 32 31)`} />
      <ellipse cx="68" cy="12" rx="8" ry="23" fill={palette.body} transform={`rotate(${9 + droop} 68 31)`} />
      <ellipse cx="32" cy="12" rx="3.5" ry="15" fill={palette.belly} transform={`rotate(${-9 - droop} 32 31)`} />
      <ellipse cx="68" cy="12" rx="3.5" ry="15" fill={palette.belly} transform={`rotate(${9 + droop} 68 31)`} />
    </>;
  }

  if (kind === "cat") {
    return <>
      <polygon points="19,31 25,5 44,25" fill={palette.accent} />
      <polygon points="56,25 75,5 81,31" fill={palette.accent} />
      <polygon points="25,25 28,14 38,24" fill={palette.belly} />
      <polygon points="62,24 72,14 75,25" fill={palette.belly} />
    </>;
  }

  if (kind === "bear") {
    return <>
      <circle cx="25" cy="25" r="13" fill={palette.accent} />
      <circle cx="75" cy="25" r="13" fill={palette.accent} />
      <circle cx="25" cy="25" r="6" fill={palette.belly} />
      <circle cx="75" cy="25" r="6" fill={palette.belly} />
    </>;
  }

  if (kind === "owl") {
    return <>
      <polygon points="18,31 29,7 43,27" fill={palette.accent} />
      <polygon points="57,27 71,7 82,31" fill={palette.accent} />
    </>;
  }

  return null;
};

const Animal = ({
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
  const armAngle = 5 + mood * 68;
  const eyeY = kind === "frog" ? 26 : 43;
  const lidHeight = Math.max(0, (1 - mood) * 8);
  const mouthY = kind === "frog" ? 63 : 61;
  const mouthCurve = mouthY - 7 + mood * 17;

  return (
    <svg
      viewBox="0 0 100 122"
      className="h-full w-full overflow-visible drop-shadow-xl"
      style={{
        transform: celebrating ? "scale(1.04)" : `translateY(${(1 - mood) * 3}%) scale(${0.95 + mood * 0.05})`,
        transition,
      }}
      aria-hidden="true"
    >
      {kind === "fox" && <path d="M22 88 Q3 78 13 59 Q18 75 31 76" fill={palette.accent} />}
      {kind === "bunny" && <circle cx="77" cy="96" r="11" fill={palette.belly} />}
      {kind === "cat" && <path d="M76 91 Q97 91 87 70" fill="none" stroke={palette.accent} strokeWidth="8" strokeLinecap="round" />}

      <g style={{ transformOrigin: "27px 79px", transform: `rotate(${-armAngle}deg)`, transition }}>
        <rect x="20" y="69" width="14" height="31" rx="7" fill={palette.accent} />
        <circle cx="27" cy="98" r="7" fill={palette.accent} />
      </g>
      <g style={{ transformOrigin: "73px 79px", transform: `rotate(${armAngle}deg)`, transition }}>
        <rect x="66" y="69" width="14" height="31" rx="7" fill={palette.accent} />
        <circle cx="73" cy="98" r="7" fill={palette.accent} />
      </g>

      {kind === "owl" ? <ellipse cx="50" cy="89" rx="34" ry="30" fill={palette.body} /> : <ellipse cx="50" cy="91" rx="29" ry="27" fill={palette.body} />}
      <ellipse cx="50" cy="98" rx={kind === "owl" ? 22 : 17} ry="16" fill={palette.belly} />

      {kind === "frog" && <>
        <circle cx="31" cy="27" r="13" fill={palette.body} />
        <circle cx="69" cy="27" r="13" fill={palette.body} />
      </>}
      <AnimalEars kind={kind} palette={palette} mood={mood} />

      {kind === "frog"
        ? <ellipse cx="50" cy="54" rx="35" ry="29" fill={palette.body} />
        : kind === "owl"
          ? <path d="M14 45 Q18 19 50 24 Q82 19 86 45 L79 72 Q50 82 21 72 Z" fill={palette.body} />
          : <circle cx="50" cy="49" r={kind === "bear" ? 31 : 29} fill={palette.body} />}

      {kind === "owl" ? <>
        <circle cx="36" cy="46" r="13" fill={palette.belly} />
        <circle cx="64" cy="46" r="13" fill={palette.belly} />
        <circle cx="36" cy={45 - mood * 2} r="5" fill={palette.detail} />
        <circle cx="64" cy={45 - mood * 2} r="5" fill={palette.detail} />
        <circle cx="38" cy={43 - mood * 2} r="1.8" fill="hsl(var(--animal-eye-glint))" />
        <circle cx="66" cy={43 - mood * 2} r="1.8" fill="hsl(var(--animal-eye-glint))" />
        <polygon points="50,51 43,59 57,59" fill="hsl(var(--animal-beak))" />
      </> : <>
        <circle cx="38" cy={eyeY} r={kind === "frog" ? 8 : 6} fill="hsl(var(--animal-eye-glint))" />
        <circle cx="62" cy={eyeY} r={kind === "frog" ? 8 : 6} fill="hsl(var(--animal-eye-glint))" />
        <circle cx="38" cy={eyeY - mood * 2} r="3" fill={palette.detail} />
        <circle cx="62" cy={eyeY - mood * 2} r="3" fill={palette.detail} />
        <rect x={kind === "frog" ? 30 : 32} y={eyeY - 8} width="16" height={lidHeight} rx="2" fill={palette.body} style={{ transition }} />
        <rect x={kind === "frog" ? 54 : 54} y={eyeY - 8} width="16" height={lidHeight} rx="2" fill={palette.body} style={{ transition }} />
      </>}

      {kind !== "frog" && kind !== "owl" && <>
        <path d={`M31 ${34 - mood * 2} Q38 ${39 - mood * 9} 45 34`} fill="none" stroke={palette.detail} strokeWidth="2.8" strokeLinecap="round" />
        <path d={`M55 34 Q62 ${39 - mood * 9} 69 ${34 - mood * 2}`} fill="none" stroke={palette.detail} strokeWidth="2.8" strokeLinecap="round" />
      </>}

      {kind !== "frog" && kind !== "owl" && <ellipse cx="50" cy={kind === "fox" ? 56 : 54} rx="4" ry="3" fill={palette.detail} />}
      {kind === "fox" && <ellipse cx="50" cy="60" rx="11" ry="8" fill={palette.belly} />}
      {kind === "bear" && <ellipse cx="50" cy="61" rx="14" ry="11" fill={palette.belly} />}

      {kind === "cat" && <>
        <line x1="17" y1="54" x2="34" y2="57" stroke={palette.detail} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="17" y1="61" x2="34" y2="60" stroke={palette.detail} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="66" y1="57" x2="83" y2="54" stroke={palette.detail} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="66" y1="60" x2="83" y2="61" stroke={palette.detail} strokeWidth="1.8" strokeLinecap="round" />
      </>}

      {celebrating
        ? <path d={`M39 ${mouthY - 2} Q50 ${mouthY + 15} 61 ${mouthY - 2} Q50 ${mouthY + 5} 39 ${mouthY - 2} Z`} fill={palette.detail} />
        : <path d={`M39 ${mouthY} Q50 ${mouthCurve} 61 ${mouthY}`} fill="none" stroke={palette.detail} strokeWidth="3" strokeLinecap="round" />}
    </svg>
  );
};

const AnimalAudience = ({ progress, celebrating = false, variant = 0, doneLabel, promptLabel }: AnimalAudienceProps) => {
  const animal = useMemo(() => {
    const index = ((Math.trunc(variant) % ANIMALS.length) + ANIMALS.length) % ANIMALS.length;
    return ANIMALS[index];
  }, [variant]);

  const mood = celebrating ? 1 : clamp01(progress);

  return (
    <div className="animal-audience fixed inset-0 z-30 pointer-events-none overflow-hidden bg-background" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.14),transparent_68%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-muted via-muted/65 to-transparent" />

      <div className={`animal-audience__burst absolute inset-0 ${celebrating ? "opacity-100" : "opacity-0"}`}>
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={index}
            className={`animal-confetti animal-confetti--${index % 3}`}
            style={{
              left: `${6 + ((index * 29) % 88)}%`,
              animationDelay: `${(index % 6) * 70}ms`,
              transform: `rotate(${index * 31}deg)`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex h-full w-full flex-col items-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-[calc(env(safe-area-inset-top,0px)+4.5rem)]">
        {promptLabel && !celebrating && (
          <div className="animate-fade-in flex items-center gap-2.5 rounded-full bg-card/95 px-5 py-2.5 shadow-md backdrop-blur-sm ring-1 ring-border/60">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
              <Mic className="h-4 w-4 text-primary" />
            </span>
            <p className="text-sm font-semibold text-foreground sm:text-base">{promptLabel}</p>
          </div>
        )}

        <div
          className={`animal-audience__character flex w-full max-w-[30rem] flex-1 items-center justify-center ${celebrating ? "is-celebrating" : "is-idle"}`}
        >
          <Animal kind={animal.kind} palette={animal.palette} mood={mood} celebrating={celebrating} />
        </div>

        {celebrating && doneLabel ? (
          <div className="animate-scale-in rounded-3xl bg-card/95 px-7 py-4 text-center shadow-lg backdrop-blur-sm ring-1 ring-border/60">
            <p className="text-2xl font-extrabold text-success sm:text-3xl">{doneLabel}</p>
          </div>
        ) : (
          <div className="w-full max-w-xs">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted shadow-inner">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${Math.round(clamp01(progress) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimalAudience;
