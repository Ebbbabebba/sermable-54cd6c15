interface FloatingAstronaut2DProps {
  triggerFlyAway?: boolean;
}

const FloatingAstronaut2D = ({ triggerFlyAway = false }: FloatingAstronaut2DProps) => {
  return (
    <div className={`absolute top-20 left-1/2 -translate-x-1/2 ${triggerFlyAway ? 'animate-fly-away' : 'animate-float'}`}>
      <svg
        width="200"
        height="280"
        viewBox="0 0 200 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-2xl"
      >
        {/* Body */}
        <ellipse cx="100" cy="140" rx="50" ry="65" fill="#e8dcc8" />
        
        {/* Helmet */}
        <circle cx="100" cy="70" r="42" fill="#e8dcc8" />
        
        {/* Visor */}
        <ellipse cx="100" cy="70" rx="38" ry="32" fill="#2a2a2a" />
        
        {/* Helmet collar */}
        <ellipse cx="100" cy="100" rx="45" ry="10" fill="#c9b89a" />
        
        {/* Left arm */}
        <ellipse cx="60" cy="135" rx="12" ry="38" fill="#e8dcc8" transform="rotate(-15 60 135)" />
        <ellipse cx="50" cy="165" rx="10" ry="22" fill="#c9b89a" transform="rotate(-20 50 165)" />
        
        {/* Right arm */}
        <ellipse cx="140" cy="135" rx="12" ry="38" fill="#e8dcc8" transform="rotate(15 140 135)" />
        <ellipse cx="150" cy="165" rx="10" ry="22" fill="#c9b89a" transform="rotate(20 150 165)" />
        
        {/* Chest panel */}
        <rect x="82" y="125" width="36" height="30" rx="4" fill="#c9b89a" />
        
        {/* Control buttons */}
        <circle cx="90" cy="140" r="4" fill="#e8dcc8" />
        <circle cx="100" cy="140" r="4" fill="#2a2a2a" />
        <circle cx="110" cy="140" r="4" fill="#e8dcc8" />
        
        {/* Waist belt */}
        <ellipse cx="100" cy="180" rx="50" ry="8" fill="#c9b89a" />
        
        {/* Left leg */}
        <ellipse cx="80" cy="215" rx="14" ry="35" fill="#e8dcc8" />
        <ellipse cx="80" cy="250" rx="16" ry="20" fill="#c9b89a" />
        
        {/* Right leg */}
        <ellipse cx="120" cy="215" rx="14" ry="35" fill="#e8dcc8" />
        <ellipse cx="120" cy="250" rx="16" ry="20" fill="#c9b89a" />
      </svg>
    </div>
  );
};

export default FloatingAstronaut2D;