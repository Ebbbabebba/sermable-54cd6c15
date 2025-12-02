import { useEffect, useState } from "react";

interface FloatingAstronaut2DProps {
  triggerFlyAway?: boolean;
  triggerWave?: boolean;
}

const FloatingAstronaut2D = ({ triggerFlyAway = false, triggerWave = false }: FloatingAstronaut2DProps) => {
  const [isWaving, setIsWaving] = useState(false);

  useEffect(() => {
    if (triggerWave) {
      setIsWaving(true);
      const timer = setTimeout(() => setIsWaving(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [triggerWave]);

  return (
    <div className={`mx-auto mb-4 ${triggerFlyAway ? 'animate-fly-away' : 'animate-float'}`}>
      <svg
        width="200"
        height="280"
        viewBox="0 0 200 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-2xl"
      >
        {/* Glow effect behind astronaut */}
        <defs>
          <radialGradient id="astronautGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(270, 100%, 70%)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(270, 100%, 70%)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="visorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a1a2e" />
            <stop offset="30%" stopColor="#16213e" />
            <stop offset="60%" stopColor="#0f3460" />
            <stop offset="100%" stopColor="#1a1a2e" />
          </linearGradient>
          <linearGradient id="visorShine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="hsl(270, 100%, 70%)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(330, 100%, 70%)" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="suitGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5f0e6" />
            <stop offset="50%" stopColor="#e8dcc8" />
            <stop offset="100%" stopColor="#d9cbb5" />
          </linearGradient>
          <linearGradient id="suitShadow" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c9b89a" />
            <stop offset="100%" stopColor="#b5a68a" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background glow */}
        <ellipse cx="100" cy="140" rx="90" ry="120" fill="url(#astronautGlow)" />

        {/* Backpack */}
        <rect x="70" y="100" width="60" height="80" rx="8" fill="url(#suitShadow)" />
        <rect x="75" y="105" width="50" height="70" rx="6" fill="#a89880" />
        {/* Backpack details */}
        <rect x="80" y="115" width="15" height="20" rx="2" fill="#8a7a6a" />
        <rect x="105" y="115" width="15" height="20" rx="2" fill="#8a7a6a" />
        <circle cx="87" cy="150" r="4" fill="#6a5a4a" />
        <circle cx="113" cy="150" r="4" fill="#6a5a4a" />

        {/* Body */}
        <ellipse cx="100" cy="145" rx="48" ry="60" fill="url(#suitGradient)" />
        
        {/* Body highlights */}
        <ellipse cx="85" cy="130" rx="15" ry="25" fill="white" opacity="0.15" />

        {/* Helmet base */}
        <circle cx="100" cy="70" r="44" fill="url(#suitGradient)" />
        
        {/* Helmet ring */}
        <ellipse cx="100" cy="102" rx="42" ry="12" fill="url(#suitShadow)" />
        <ellipse cx="100" cy="100" rx="40" ry="10" fill="#d9cbb5" />

        {/* Visor outer ring */}
        <ellipse cx="100" cy="68" rx="36" ry="30" fill="#3a3a4a" />
        
        {/* Visor */}
        <ellipse cx="100" cy="68" rx="33" ry="27" fill="url(#visorGradient)" />
        
        {/* Visor reflection/shine */}
        <ellipse cx="100" cy="68" rx="33" ry="27" fill="url(#visorShine)" />
        
        {/* Visor highlight */}
        <ellipse cx="88" cy="58" rx="12" ry="8" fill="white" opacity="0.25" />
        <ellipse cx="115" cy="75" rx="6" ry="4" fill="white" opacity="0.15" />
        
        {/* Stars reflection in visor */}
        <circle cx="82" cy="62" r="1.5" fill="white" opacity="0.6" />
        <circle cx="118" cy="70" r="1" fill="white" opacity="0.4" />
        <circle cx="95" cy="80" r="0.8" fill="white" opacity="0.3" />

        {/* Left arm - waving when triggered */}
        <g 
          style={{ 
            transformOrigin: '60px 120px',
            transform: isWaving ? 'rotate(-45deg)' : 'rotate(-15deg)',
            transition: 'transform 0.3s ease-in-out',
            animation: isWaving ? 'wave 0.4s ease-in-out 3' : 'none'
          }}
        >
          <ellipse cx="55" cy="135" rx="14" ry="35" fill="url(#suitGradient)" />
          {/* Arm shadow */}
          <ellipse cx="50" cy="138" rx="8" ry="20" fill="url(#suitShadow)" opacity="0.3" />
          {/* Glove */}
          <ellipse cx="48" cy="168" rx="12" ry="18" fill="url(#suitShadow)" />
          <ellipse cx="48" cy="168" rx="10" ry="15" fill="#c9b89a" />
          {/* Glove details */}
          <ellipse cx="45" cy="180" rx="4" ry="6" fill="#b5a68a" />
          <ellipse cx="52" cy="181" rx="3" ry="5" fill="#b5a68a" />
        </g>
        
        {/* Right arm */}
        <g style={{ transform: 'rotate(15deg)', transformOrigin: '140px 120px' }}>
          <ellipse cx="145" cy="135" rx="14" ry="35" fill="url(#suitGradient)" />
          {/* Arm shadow */}
          <ellipse cx="150" cy="138" rx="8" ry="20" fill="url(#suitShadow)" opacity="0.3" />
          {/* Glove */}
          <ellipse cx="152" cy="168" rx="12" ry="18" fill="url(#suitShadow)" />
          <ellipse cx="152" cy="168" rx="10" ry="15" fill="#c9b89a" />
          {/* Glove details */}
          <ellipse cx="148" cy="181" rx="3" ry="5" fill="#b5a68a" />
          <ellipse cx="155" cy="180" rx="4" ry="6" fill="#b5a68a" />
        </g>

        {/* Chest panel */}
        <rect x="78" y="125" width="44" height="35" rx="6" fill="url(#suitShadow)" />
        <rect x="80" y="127" width="40" height="31" rx="5" fill="#b5a68a" />
        
        {/* Control panel screen */}
        <rect x="85" y="132" width="30" height="12" rx="2" fill="#1a1a2e" />
        <rect x="87" y="134" width="26" height="8" rx="1" fill="#0f3460" opacity="0.8" />
        {/* Screen glow lines */}
        <line x1="89" y1="136" x2="111" y2="136" stroke="hsl(180, 100%, 60%)" strokeWidth="1" opacity="0.6" />
        <line x1="89" y1="139" x2="105" y2="139" stroke="hsl(217, 91%, 60%)" strokeWidth="1" opacity="0.4" />
        
        {/* Control buttons */}
        <circle cx="90" cy="152" r="4" fill="#e8dcc8" />
        <circle cx="90" cy="152" r="3" fill="hsl(120, 60%, 50%)" filter="url(#glow)" />
        <circle cx="100" cy="152" r="4" fill="#e8dcc8" />
        <circle cx="100" cy="152" r="3" fill="hsl(45, 100%, 50%)" filter="url(#glow)" />
        <circle cx="110" cy="152" r="4" fill="#e8dcc8" />
        <circle cx="110" cy="152" r="3" fill="hsl(0, 80%, 55%)" filter="url(#glow)" />

        {/* Waist belt */}
        <ellipse cx="100" cy="185" rx="48" ry="10" fill="url(#suitShadow)" />
        <ellipse cx="100" cy="183" rx="46" ry="8" fill="#c9b89a" />
        {/* Belt buckle */}
        <rect x="92" y="178" width="16" height="10" rx="2" fill="#8a7a6a" />
        <rect x="95" y="180" width="10" height="6" rx="1" fill="#6a5a4a" />

        {/* Left leg */}
        <ellipse cx="78" cy="218" rx="16" ry="38" fill="url(#suitGradient)" />
        {/* Leg shadow */}
        <ellipse cx="72" cy="220" rx="8" ry="25" fill="url(#suitShadow)" opacity="0.3" />
        {/* Boot */}
        <ellipse cx="78" cy="255" rx="18" ry="18" fill="url(#suitShadow)" />
        <ellipse cx="78" cy="253" rx="16" ry="15" fill="#b5a68a" />
        {/* Boot sole */}
        <ellipse cx="78" cy="268" rx="14" ry="6" fill="#6a5a4a" />
        
        {/* Right leg */}
        <ellipse cx="122" cy="218" rx="16" ry="38" fill="url(#suitGradient)" />
        {/* Leg shadow */}
        <ellipse cx="128" cy="220" rx="8" ry="25" fill="url(#suitShadow)" opacity="0.3" />
        {/* Boot */}
        <ellipse cx="122" cy="255" rx="18" ry="18" fill="url(#suitShadow)" />
        <ellipse cx="122" cy="253" rx="16" ry="15" fill="#b5a68a" />
        {/* Boot sole */}
        <ellipse cx="122" cy="268" rx="14" ry="6" fill="#6a5a4a" />

        {/* Antenna */}
        <line x1="100" y1="26" x2="100" y2="10" stroke="#8a7a6a" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="8" r="5" fill="hsl(0, 80%, 55%)" filter="url(#glow)">
          <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>

      <style>{`
        @keyframes wave {
          0%, 100% { transform: rotate(-45deg); }
          50% { transform: rotate(-60deg); }
        }
      `}</style>
    </div>
  );
};

export default FloatingAstronaut2D;
