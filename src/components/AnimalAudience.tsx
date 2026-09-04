import { useEffect, useMemo, useState } from "react";

/**
 * A full-screen audience of six distinct animals that appears during the
 * final, script-free stage of a repetition. They start out gloomy and
 * sleepy, and for every word said correctly they wake up a little more —
 * arms rising, eyes opening, frowns turning into smiles — until the whole
 * row erupts in cheers when the line lands perfectly.
 */

interface AnimalAudienceProps {
  /** 0..1 — how much of the line has been said correctly so far this rep. */
  progress: number;
  /** True when the whole line just landed — full cheer, then onDone fires. */
  celebrating?: boolean;
  /** Called after the celebration has played out. */
  onDone?: () => void;
  /** How long the final cheer lasts before fading out (ms). */
  cheerDurationMs?: number;
}

type AnimalKind = "fox" | "bunny" | "frog" | "cat" | "bear" | "owl";

type Palette = {
  body: string;
  belly: string;
  accent: string;
  detail: string;
};

const ANIMALS: { kind: AnimalKind; palette: Palette }[] = [
  { kind: "fox",   palette: { body: "#F59E0B", belly: "#FDE9C8", accent: "#D97706", detail: "#7C2D12" } },
  { kind: "bunny", palette: { body: "#C084FC", belly: "#F3E8FF", accent: "#A855F7", detail: "#4C1D95" } },
  { kind: "frog",  palette: { body: "#34D399", belly: "#D1FAE5", accent: "#10B981", detail: "#065F46" } },
  { kind: "cat",   palette: { body: "#60A5FA", belly: "#DBEAFE", accent: "#3B82F6", detail: "#1E3A8A" } },
  { kind: "bear",  palette: { body: "#B45309", belly: "#FDE68A", accent: "#92400E", detail: "#451A03" } },
  { kind: "owl",   palette: { body: "#94A3B8", belly: "#E2E8F0", accent: "#64748B", detail: "#1E293B" } },
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const Ears = ({ kind, p, mood }: { kind: AnimalKind; p: Palette; mood: number }) => {
  switch (kind) {
    case "fox":
      return (
        <>
          <polygon points="24,30 34,4 44,28" fill={p.accent} />
          <polygon points="56,28 66,4 76,30" fill={p.accent} />
          <polygon points="28,26 34,12 40,26" fill={p.belly} />
          <polygon points="60,26 66,12 72,26" fill={p.belly} />
        </>
      );
    case "bunny":
      return (
        <>
          <ellipse cx="33" cy={12 + (1 - mood) * 4} rx="7" ry="20" fill={p.body}
            transform={`rotate(${-10 - (1 - mood) * 18} 33 30)`} />
          <ellipse cx="67" cy={12 + (1 - mood) * 4} rx="7" ry="20" fill={p.body}
            transform={`rotate(${10 + (1 - mood) * 18} 67 30)`} />
          <ellipse cx="33" cy={14 + (1 - mood) * 4} rx="3.4" ry="12" fill={p.belly}
            transform={`rotate(${-10 - (1 - mood) * 18} 33 30)`} />
          <ellipse cx="67" cy={14 + (1 - mood) * 4} rx="3.4" ry="12" fill={p.belly}
            transform={`rotate(${10 + (1 - mood) * 18} 67 30)`} />
        </>
      );
    case "frog":
      // no ears — eye bumps drawn with the head
      return null;
    case "cat":
      return (
        <>
          <polygon points="26,28 28,8 44,22" fill={p.accent} />
          <polygon points="56,22 72,8 74,28" fill={p.accent} />
          <polygon points="29,24 30,14 38,21" fill={p.belly} />
          <polygon points="62,21 70,14 71,24" fill={p.belly} />
        </>
      );
    case "bear":
      return (
        <>
          <circle cx="27" cy="24" r="11" fill={p.accent} />
          <circle cx="73" cy="24" r="11" fill={p.accent} />
          <circle cx="27" cy="24" r="5" fill={p.belly} />
          <circle cx="73" cy="24" r="5" fill={p.belly} />
        </>
      );
    case "owl":
      return (
        <>
          <polygon points="26,26 30,8 42,22" fill={p.body} />
          <polygon points="58,22 70,8 74,26" fill={p.body} />
        </>
      );
  }
};

const Animal = ({
  kind,
  palette: p,
  mood,
  celebrating,
  delay,
}: {
  kind: AnimalKind;
  palette: Palette;
  mood: number;
  celebrating: boolean;
  delay: number;
}) => {
  const transition = "all 320ms cubic-bezier(0.34,1.56,0.64,1)";
  const armAngle = 8 + mood * 54; // drooped → raised
  const pupilY = 42 - mood * 3.4;
  const browCtrlY = 34 - mood * 6.5;
  const mouthCtrlY = 54 + mood * 10;
  const lidHeight = (1 - mood) * 7; // sleepy eyelids shrinking as they wake

  return (
    <svg
      viewBox="0 0 100 116"
      className="w-20 h-[5.8rem] sm:w-28 sm:h-[8.1rem] drop-shadow-md"
      style={{
        transform: celebrating
          ? "translateY(-8px) scale(1.04)"
          : `translateY(${(1 - mood) * 3}px)`,
        transition,
        transitionDelay: `${delay}ms`,
      }}
      aria-hidden="true"
    >
      {/* arms */}
      <g
        style={{
          transformOrigin: "26px 74px",
          transform: `rotate(${-armAngle}deg)`,
          transition,
          transitionDelay: `${delay}ms`,
        }}
      >
        <rect x="18" y="66" width="12" height="28" rx="6" fill={p.accent} />
        <circle cx="24" cy="92" r="6" fill={p.accent} />
      </g>
      <g
        style={{
          transformOrigin: "74px 74px",
          transform: `rotate(${armAngle}deg)`,
          transition,
          transitionDelay: `${delay}ms`,
        }}
      >
        <rect x="70" y="66" width="12" height="28" rx="6" fill={p.accent} />
        <circle cx="76" cy="92" r="6" fill={p.accent} />
      </g>

      {/* body */}
      <ellipse cx="50" cy="88" rx="27" ry="24" fill={p.body} />
      <ellipse cx="50" cy="94" rx="15" ry="14" fill={p.belly} />

      {/* frog: eye bumps on top of the head */}
      {kind === "frog" && (
        <>
          <circle cx="32" cy="22" r="11" fill={p.body} />
          <circle cx="68" cy="22" r="11" fill={p.body} />
        </>
      )}

      <Ears kind={kind} p={p} mood={mood} />

      {/* head */}
      {kind === "frog" ? (
        <ellipse cx="50" cy="50" rx="32" ry="26" fill={p.body} />
      ) : (
        <circle cx="50" cy="46" r="28" fill={p.body} />
      )}
      <ellipse cx="50" cy={kind === "frog" ? 58 : 56} rx="15" ry="11" fill={p.belly} />

      {/* eyes */}
      {kind === "owl" ? (
        <>
          <circle cx="38" cy="42" r="9.5" fill="#FFFFFF" />
          <circle cx="62" cy="42" r="9.5" fill="#FFFFFF" />
          <circle cx="38" cy={pupilY + 1} r="4" fill={p.detail} />
          <circle cx="62" cy={pupilY + 1} r="4" fill={p.detail} />
          <circle cx="39.6" cy={pupilY - 0.6} r="1.3" fill="#FFFFFF" />
          <circle cx="63.6" cy={pupilY - 0.6} r="1.3" fill="#FFFFFF" />
        </>
      ) : (
        <>
          <circle cx="39" cy={kind === "frog" ? 24 : 41} r={kind === "frog" ? 7.5 : 5.5} fill="#FFFFFF" />
          <circle cx="61" cy={kind === "frog" ? 24 : 41} r={kind === "frog" ? 7.5 : 5.5} fill="#FFFFFF" />
          <circle
            cx="39"
            cy={kind === "frog" ? 24 + (42 - pupilY) * -0 : pupilY}
            r="2.8"
            fill={p.detail}
            style={{ transition: "cy 240ms ease-out", transitionDelay: `${delay}ms` }}
          />
          <circle
            cx="61"
            cy={kind === "frog" ? 24 : pupilY}
            r="2.8"
            fill={p.detail}
            style={{ transition: "cy 240ms ease-out", transitionDelay: `${delay}ms` }}
          />
          {/* sleepy eyelids */}
          <rect
            x={kind === "frog" ? 31.5 : 33.5}
            y={kind === "frog" ? 16.5 : 35.5}
            width="15"
            height={lidHeight}
            fill={p.body}
            style={{ transition: "height 240ms ease-out", transitionDelay: `${delay}ms` }}
          />
          <rect
            x={kind === "frog" ? 53.5 : 55.5}
            y={kind === "frog" ? 16.5 : 35.5}
            width="15"
            height={lidHeight}
            fill={p.body}
            style={{ transition: "height 240ms ease-out", transitionDelay: `${delay}ms` }}
          />
        </>
      )}

      {/* brows: sad slant → raised arcs */}
      {kind !== "frog" && kind !== "owl" && (
        <>
          <path
            d={`M33 ${31 - mood} Q39 ${browCtrlY} 45 31`}
            stroke={p.detail}
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M55 31 Q61 ${browCtrlY} 67 ${31 - mood}`}
            stroke={p.detail}
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}

      {/* nose / beak */}
      {kind === "owl" ? (
        <polygon points="50,48 45.5,54 54.5,54" fill="#F59E0B" />
      ) : kind === "frog" ? null : (
        <ellipse cx="50" cy={kind === "fox" ? 52 : 50} rx="3.4" ry="2.6" fill={p.detail} />
      )}

      {/* fox snout */}
      {kind === "fox" && (
        <ellipse cx="50" cy="55" rx="9" ry="6.5" fill={p.belly} />
      )}

      {/* whiskers for the cat */}
      {kind === "cat" && (
        <>
          <line x1="20" y1="50" x2="32" y2="52" stroke={p.detail} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="20" y1="56" x2="32" y2="55" stroke={p.detail} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="68" y1="52" x2="80" y2="50" stroke={p.detail} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="68" y1="55" x2="80" y2="56" stroke={p.detail} strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}

      {/* mouth: frown → smile → open cheer */}
      {celebrating ? (
        <path d="M42 58 Q50 68 58 58 Q50 62 42 58 Z" fill={p.detail} />
      ) : (
        <path
          d={kind === "frog"
            ? `M38 60 Q50 ${mouthCtrlY} 62 60`
            : `M43 ${kind === "fox" ? 62 : 59} Q50 ${mouthCtrlY} 57 ${kind === "fox" ? 62 : 59}`}
          stroke={p.detail}
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
};

const AnimalAudience = ({
  progress,
  celebrating = false,
  onDone,
  cheerDurationMs = 2200,
}: AnimalAudienceProps) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!celebrating) return;
    const leaveAt = setTimeout(() => setLeaving(true), cheerDurationMs);
    const doneAt = setTimeout(() => onDone?.(), cheerDurationMs + 450);
    return () => {
      clearTimeout(leaveAt);
      clearTimeout(doneAt);
    };
  }, [celebrating, cheerDurationMs, onDone]);

  // Each animal wakes up at a slightly different point, so the crowd comes
  // alive one by one as the words land.
  const moods = useMemo(
    () => ANIMALS.map((_, i) => clamp01(clamp01(progress) * 1.35 - i * 0.06)),
    [progress]
  );

  return (
    <div
      className="fixed inset-0 z-30 pointer-events-none flex items-end justify-center"
      style={{
        opacity: leaving ? 0 : 1,
        transition: "opacity 400ms ease-out",
      }}
    >
      {/* soft stage glow behind the crowd */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/5"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--background)) 12%, hsl(var(--background) / 0.75) 55%, transparent 100%)",
        }}
      />
      <div
        className="relative flex items-end justify-center gap-1 sm:gap-4 px-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        {ANIMALS.map(({ kind, palette }, i) => (
          <div
            key={kind}
            style={{
              animation: celebrating
                ? `pulse-bounce 520ms ease-in-out ${i * 80}ms 4`
                : undefined,
            }}
          >
            <Animal
              kind={kind}
              palette={palette}
              mood={celebrating ? 1 : moods[i]}
              celebrating={celebrating}
              delay={i * 80}
            />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
};

export default AnimalAudience;
