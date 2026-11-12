import type { SpeechAnalysis } from '@/lib/feedbackContract';
import { timeLabel } from '@/lib/feedbackContract';
export default function RecordedFeedback({ analysis }: { analysis: SpeechAnalysis }) {
  const { metrics, feedback } = analysis;
  return <section className="recorded-feedback" lang="sv">
    <h1>Analys av ditt tal</h1><p>{feedback.summary}</p>
    <dl className="recorded-feedback__metrics">
      <div><dt>Ord per minut</dt><dd>{metrics.wordsPerMinute}</dd></div>
      <div><dt>Talets längd</dt><dd>{timeLabel(metrics.durationSeconds)}</dd></div>
      <div><dt>Utfyllnadsord</dt><dd>{metrics.fillers.length}</dd></div>
    </dl>
    {feedback.tips.length > 0 && <><h2>Att prova nästa gång</h2><ol>{feedback.tips.map((tip, i) => <li key={i}>{tip.atSeconds !== null && <strong>Vid {timeLabel(tip.atSeconds)}: </strong>}{tip.text}</li>)}</ol></>}
    <h2>Det som fungerade</h2><p>{feedback.positive}</p>
    <details><summary>Transkribering och mätvärden</summary><p>{analysis.transcript}</p>
      <h3>Utfyllnadsord</h3><ul>{metrics.fillers.map((f, i) => <li key={i}>{f.word} — {f.atSeconds === null ? 'Tidpunkt saknas i transkriberingen' : timeLabel(f.atSeconds)}</li>)}</ul>
      <h3>Uppmätta tysta pauser</h3><ul>{metrics.pauses.map((pause, i) => <li key={i}>{timeLabel(pause.start)} — {pause.duration.toFixed(1)} sekunder</li>)}</ul>
    </details>
  </section>;
}