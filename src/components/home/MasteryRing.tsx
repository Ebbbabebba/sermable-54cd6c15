import { SpeechMascot } from './SpeechMascot';

export function MasteryRing({ value, label, size = 230 }: { value: number; label: string; size?: number }) {
  const percent = Math.round(Math.max(0, Math.min(100, value)));
  const stroke = 18;
  const r = (size - stroke) / 2;
  return <div className="mastery-ring" style={{ width: size, height: size }} role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
    <svg className="mastery-ring__svg" width={size} height={size} aria-hidden="true">
      <circle className="mastery-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <circle className="mastery-ring__fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} pathLength="100" strokeDasharray={`${percent} 100`} />
    </svg>
    <div className="mastery-ring__center">
      <SpeechMascot value={percent} />
      <strong className="mastery-ring__value">{percent}<small>%</small></strong>
      <span className="mastery-ring__label">{label}</span>
    </div>
  </div>;
}
