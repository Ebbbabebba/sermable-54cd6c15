import { SpeechMascot } from './SpeechMascot';

export function MasteryRing({ value, label }: { value: number; label: string }) {
  const percent = Math.max(0, Math.min(100, value));
  return <div className="mastery-ring" role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
    <svg className="mastery-ring__svg" viewBox="0 0 200 200" aria-hidden="true">
      <circle className="mastery-ring__track" cx="100" cy="100" r="88" />
      <circle className="mastery-ring__fill" cx="100" cy="100" r="88" pathLength="100" strokeDasharray={`${percent} 100`} />
    </svg>
    <SpeechMascot value={percent} />
    <strong className="mastery-ring__value">{percent}%</strong>
  </div>;
}