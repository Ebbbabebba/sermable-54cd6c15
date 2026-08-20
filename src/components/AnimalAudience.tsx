import { useEffect, useState } from "react";

/**
 * A tiny Duolingo-style audience of animals that appears now and then after
 * a sentence is mastered without the script. They start out a bit glum and
 * then throw their arms up and cheer.
 */

interface AnimalAudienceProps {
  /** Called when the whole little show is over. */
  onDone?: () => void;
  /** How long the cheering lasts before fading out (ms). */
  cheerDurationMs?: number;
}

type Palette = {
  body: string;
  belly: string;
  ear: string;
  detail: string;
};

const ANIMALS: Palette[] = [
  { body: "#F59E0B", belly: "#FDE9C8", ear: "#D97706", detail: "#7C2D12" }, // fox
  { body: "#60A5FA", belly: "#DBEAFE", ear: "#3B82F6", detail: "#1E3A8A" }, // cat
  { body: "#34D399", belly: "#D1FAE5", ear: "#10B981", detail: "#065F46" }, // frog
  { body: "#C084FC", belly: "#F3E8FF", ear: "#A855F7", detail: "#4C1D95" }, // bunny
];

const Animal = ({
  palette,
  cheering,
  delay,
}: {
  palette: Palette;
  cheering: boolean;
  delay: number;
}) => {
  return (
    <svg
      viewBox="0 0 100 110"
      className="w-16 h-[4.4rem] sm:w-20 sm:h-[5.5rem]"
      style={{
        transform: cheering ? "translateY(-6px)" : "translateY(0)",
        transition: "transform 260ms cubic-bezier(0.34,1.56,0.64,1)",
        transitionDelay: `${delay}ms`,
      }}
      aria-hidden="true"
    >
      {/* arms */}
      <g
        style={{
          transformOrigin: "26px 74px",
          transform: cheering ? "rotate(-58deg)" : "rotate(6deg)",
          transition: "transform 300ms cubic-bezier(0.34,1.56,0.64,1)",
          transitionDelay: `${delay}ms`,
        }}
      >
        <rect x="18" y="66" width="12" height="26" rx="6" fill={palette.ear} />
      </g>
      <g
        style={{
          transformOrigin: "74px 74px",
          transform: cheering ? "rotate(58deg)" : "rotate(-6deg)",
          transition: "transform 300ms cubic-bezier(0.34,1.56,0.64,1)",
          transitionDelay: `${delay}ms`,
        }}
      >
        <rect x="70" y="66" width="12" height="26" rx="6" fill={palette.ear} />
      </g>

      {/* body */}
      <ellipse cx="50" cy="84" rx="26" ry="22" fill={palette.body} />
      <ellipse cx="50" cy="90" rx="15" ry="13" fill={palette.belly} />

      {/* ears */}
      <ellipse cx="26" cy="30" rx="10" ry="13" fill={palette.ear} />
      <ellipse cx="74" cy="30" rx="10" ry="13" fill={palette.ear} />

      {/* head */}
      <circle cx="50" cy="44" r="28" fill={palette.body} />
      <ellipse cx="50" cy="54" rx="15" ry="12" fill={palette.belly} />

      {/* eyes */}
      <circle cx="39" cy="40" r="5" fill="#FFFFFF" />
      <circle cx="61" cy="40" r="5" fill="#FFFFFF" />
      <circle
        cx="39"
        cy={cheering ? 39 : 42}
        r="2.8"
        fill={palette.detail}
        style={{ transition: "cy 200ms ease-out" }}
      />
      <circle
        cx="61"
        cy={cheering ? 39 : 42}
        r="2.8"
        fill={palette.detail}
        style={{ transition: "cy 200ms ease-out" }}
      />

      {/* brows: sad = slanted inward, happy = raised */}
      <path
        d={cheering ? "M33 31 Q39 28 45 31" : "M33 30 Q39 34 45 33"}
        stroke={palette.detail}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={cheering ? "M55 31 Q61 28 67 31" : "M55 33 Q61 34 67 30"}
        stroke={palette.detail}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* nose */}
      <ellipse cx="50" cy="49" rx="3.4" ry="2.6" fill={palette.detail} />

      {/* mouth: frown → open smile */}
      {cheering ? (
        <path
          d="M42 55 Q50 66 58 55 Q50 60 42 55 Z"
          fill={palette.detail}
        />
      ) : (
        <path
          d="M43 60 Q50 54 57 60"
          stroke={palette.detail}
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
};

const AnimalAudience = ({ onDone, cheerDurationMs = 2000 }: AnimalAudienceProps) => {
  const [cheering, setCheering] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const cheerAt = setTimeout(() => setCheering(true), 550);
    const leaveAt = setTimeout(() => setLeaving(true), 550 + cheerDurationMs);
    const doneAt = setTimeout(() => onDone?.(), 550 + cheerDurationMs + 400);
    return () => {
      clearTimeout(cheerAt);
      clearTimeout(leaveAt);
      clearTimeout(doneAt);
    };
  }, [cheerDurationMs, onDone]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
    >
      <div
        className="flex items-end gap-1 sm:gap-3 px-4 transition-all duration-400"
        style={{
          transform: leaving ? "translateY(120%)" : "translateY(0)",
          opacity: leaving ? 0 : 1,
          animation: leaving ? undefined : "fade-in 0.35s ease-out",
        }}
      >
        {ANIMALS.map((palette, i) => (
          <div
            key={i}
            style={{
              animation: cheering
                ? `pulse-bounce 520ms ease-in-out ${i * 90}ms 3`
                : undefined,
            }}
          >
            <Animal palette={palette} cheering={cheering} delay={i * 90} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default AnimalAudience;
