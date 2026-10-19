export type Mood = 'nervous' | 'learning' | 'confident' | 'ready';

export function mascotMood(value: number): Mood {
  if (value < 25) return 'nervous';
  if (value < 60) return 'learning';
  if (value < 90) return 'confident';
  return 'ready';
}

const mouths: Record<Mood, string> = {
  nervous: 'M38 58 Q50 50 62 58',
  learning: 'M40 56 H60',
  confident: 'M38 53 Q50 65 62 53',
  ready: 'M36 52 Q50 70 64 52 Z',
};

const fills: Record<Mood, string> = {
  nervous: 'hsl(var(--lavender))',
  learning: 'hsl(var(--sun))',
  confident: 'hsl(var(--bubblegum))',
  ready: 'hsl(var(--mint))',
};

export function SpeechMascot({ value = 0 }: { value?: number }) {
  const mood = mascotMood(value);
  const ink = 'hsl(var(--foreground))';
  return <svg className={`speech-mascot speech-mascot--${mood}`} viewBox="0 0 100 100" aria-hidden="true">
    <path d="M20 15 H80 Q92 15 92 27 V60 Q92 72 80 72 H56 L44 90 L42 72 H20 Q8 72 8 60 V27 Q8 15 20 15 Z" fill={fills[mood]} />
    <circle cx="27" cy="55" r="5" fill="hsl(var(--bubblegum))" opacity="0.6" />
    <circle cx="73" cy="55" r="5" fill="hsl(var(--bubblegum))" opacity="0.6" />
    {mood === 'ready' ? <>
      <path d="M31 42 Q36 35 41 42" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M59 42 Q64 35 69 42" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
    </> : <>
      <circle cx="36" cy="41" r="4" fill={ink} />
      <circle cx="64" cy="41" r="4" fill={ink} />
    </>}
    {mood === 'nervous' && <path d="M78 24 q4 6 0 9 q-4 -3 0 -9" fill="hsl(var(--primary))" />}
    <path d={mouths[mood]} stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill={mood === 'ready' ? 'hsl(var(--bubblegum))' : 'none'} />
  </svg>;
}
