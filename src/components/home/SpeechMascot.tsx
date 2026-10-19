export function mascotMood(value: number) {
  if (value < 25) return 'nervous';
  if (value < 60) return 'learning';
  if (value < 90) return 'confident';
  return 'ready';
}

export function SpeechMascot({ value = 0 }: { value?: number }) {
  const mood = mascotMood(value);
  return <svg className={`speech-mascot speech-mascot--${mood}`} viewBox="0 0 140 140" aria-hidden="true">
    <path className="speech-mascot__shadow" d="M30 117 Q70 105 110 117 Q110 128 70 128 Q30 128 30 117" />
    <path className="speech-mascot__body" d="M27 31 Q70 12 112 34 Q128 50 117 86 Q108 107 79 105 L53 121 L54 102 Q20 99 20 64 Q20 43 27 31Z" />
    <path className="speech-mascot__shine" d="M33 46 Q36 35 48 34" />
    <ellipse className="speech-mascot__cheek" cx="43" cy="76" rx="9" ry="5" />
    <ellipse className="speech-mascot__cheek" cx="97" cy="76" rx="9" ry="5" />
    <path className="speech-mascot__face" d={mood === 'ready' ? 'M45 62 Q51 53 57 62 M83 62 Q89 53 95 62' : 'M51 58 L51 64 M89 58 L89 64'} />
    <path className="speech-mascot__face" d={mood === 'nervous' ? 'M62 83 Q70 75 78 83' : mood === 'learning' ? 'M62 78 Q70 84 78 78' : 'M57 77 Q70 95 83 77'} />
    {mood === 'ready' && <path className="speech-mascot__star" d="M114 14 L118 24 L129 27 L118 31 L114 41 L110 31 L100 27 L110 24Z" />}
  </svg>;
}