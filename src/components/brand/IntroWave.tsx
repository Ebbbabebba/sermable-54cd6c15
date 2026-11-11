const HEIGHTS = [30, 55, 80, 45, 95, 70, 40, 85, 60, 100, 50, 75, 35, 90, 65, 45, 80, 55, 30, 70, 50, 40];

/** Startskärmens ljudvåg: staplar växer upp och lägger sig till en prickad linje. */
export const IntroWave = () => (
  <div className="intro-wave" aria-hidden="true">
    {HEIGHTS.map((h, i) => (
      <i key={i} style={{ "--h": `${h}%`, "--i": i, "--n": HEIGHTS.length } as React.CSSProperties} />
    ))}
  </div>
);
