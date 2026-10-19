import { CalendarDays, Check, Flame, Mic, Target, Trophy, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { MasteryRing } from './MasteryRing';
import type { OverviewBeat } from '@/hooks/useSpeechOverview';
import { buildSchedule } from '@/lib/reviewSchedule';
import { dateFormatter } from '@/lib/dateFormat';

export function CountdownCard({ title, date }: { title: string; date: string }) {
  const { t } = useTranslation();
  const days = differenceInCalendarDays(parseISO(date), new Date());
  if (!Number.isFinite(days)) return null;
  return <div className="countdown-card">
    <div className="countdown-card__badge"><strong>{Math.abs(days)}</strong><span>{t('playful.daysUnit')}</span></div>
    <div className="countdown-card__text"><p><CalendarDays />{days === 0 ? t('dashboard.presentationDay') : days < 0 ? t('dashboard.daysOverduePlural', { count: Math.abs(days) }) : t('playful.nextSpeech')}</p><h2>{title}</h2></div>
  </div>;
}

export function BeatChips({ beats, onSelect }: { beats: OverviewBeat[]; onSelect: () => void }) {
  const { t } = useTranslation();
  const statusOf = (beat: OverviewBeat) => beat.is_mastered ? 'complete' : beat.practice_stage && beat.practice_stage !== 'new' ? 'learning' : 'new';
  return <div className="beat-chips-card">
    <div className="beat-chips-card__head"><p>{t('playful.beats')}</p><div className="beat-chips-card__legend">{(['new', 'learning', 'complete'] as const).map(status => <span key={status} className="beat-chips-card__legend-item"><span className={`beat-chips-card__legend-dot beat-chips-card__legend-dot--${status}`} />{t(status === 'complete' ? 'playful.completed' : `playful.${status}`)}</span>)}</div></div>
    <div className="beat-chips">{beats.map((beat, index) => <Button key={beat.id} variant="ghost" className={`beat-chip beat-chip--${statusOf(beat)}`} onClick={onSelect} aria-label={`${t('playful.beat')} ${index + 1}`} title={t(statusOf(beat) === 'complete' ? 'playful.completed' : `playful.${statusOf(beat)}`)}>
      {beat.is_mastered ? <Check /> : index + 1}
    </Button>)}</div>
  </div>;
}

export function ReviewTimeline({ beats, goalDate }: { beats: OverviewBeat[]; goalDate?: string }) {
  const { t, i18n } = useTranslation();
  // Checkpoint completion is read from real records, not inferred from elapsed time.
  const stages = ['tenMinutes', 'tonight', 'tomorrow', 'twoDays', 'threeDays', 'fiveDays', 'sevenDays'];
  const complete = [beats.length > 0 && beats.every(b => !!b.recall_10min_at), beats.length > 0 && beats.every(b => !!b.recall_evening_at), beats.length > 0 && beats.every(b => !!b.recall_morning_at), ...[4, 5, 6, 7].map(rung => beats.length > 0 && beats.every(b => b.ladder_rung >= rung))];
  const dates = beats.map(b => b.next_scheduled_recall_at).filter((date): date is string => !!date).sort();
  const next = complete.findIndex(done => !done);
  // Planned (visual) dates, anchored on the first 10-minute recall and compressed toward the presentation date.
  const firstRecall = beats.map(b => b.recall_10min_at).filter((d): d is string => !!d).sort()[0];
  const planned = firstRecall ? buildSchedule(new Date(new Date(firstRecall).getTime() - 10 * 60 * 1000), goalDate ? new Date(`${goalDate}T09:00:00`) : undefined) : null;
  const fmt = dateFormatter(i18n.language, { day: 'numeric', month: 'short' });
  return <section className="review-section"><h2>{t('playful.reviews')}</h2><ol className="review-timeline">{stages.map((stage, i) => <li key={stage} className={complete[i] ? 'is-complete' : i === next && dates.length ? 'is-next' : ''}><span className="review-timeline__dot">{complete[i] ? <Check /> : i + 1}</span><span>{t(`playful.${stage}`)}</span>{planned && <small className="review-timeline__date">{fmt.format(planned[i])}</small>}</li>)}</ol>{dates[0] && <p className="review-section__due"><Clock3 />{t('dashboard.nextPractice')} · {dateFormatter(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dates[0]))}</p>}</section>;
}

export function StatsCards({ streak, accuracy, mastered, total }: { streak: number; accuracy: number | null; mastered: number; total: number }) {
  const { t } = useTranslation();
  return <div className="stats-cards">{[
    { icon: Flame, value: streak || '—', label: t('playful.streak'), tone: 'sun' },
    { icon: Target, value: accuracy === null ? '—' : `${Math.round(accuracy)}%`, label: t('practice.results.accuracy'), tone: 'bubblegum' },
    { icon: Trophy, value: `${mastered}/${total}`, label: t('playful.completed'), tone: 'mint' },
  ].map(item => <div className={`stat-card stat-card--${item.tone}`} key={item.label}><item.icon /><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>;
}

export function HomeOverview({ speech, beats, streak, accuracy, ready, onPractice }: { speech: { title: string; goal_date: string }; beats: OverviewBeat[]; streak: number; accuracy: number | null; ready: boolean; onPractice: () => void }) {
  const { t } = useTranslation();
  const mastered = beats.filter(b => b.is_mastered).length;
  const percent = beats.length ? Math.round(mastered / beats.length * 100) : 0;
  return <div className="home-overview"><div className="home-overview__title"><span>{t('playful.nextSpeech')}</span><h1>{speech.title}</h1></div>
    {speech.goal_date && <CountdownCard title={speech.title} date={speech.goal_date} />}
    <div className="home-overview__mastery"><MasteryRing value={percent} label={t('playful.completed')} /><h2>{t('playful.completed')}</h2><p>{ready ? t('playful.beatCount', { count: mastered, total: beats.length }) : t('common.loading')}</p></div>
    <ReviewTimeline beats={beats} goalDate={speech.goal_date} />
    <section className="home-beats"><BeatChips beats={beats} onSelect={onPractice} />{!beats.length && <p>{t('playful.noBeats')}</p>}</section>
    <StatsCards streak={streak} accuracy={accuracy} mastered={mastered} total={beats.length} />
    <div className="home-practice"><Button className="home-practice__mic" size="icon" onClick={onPractice} aria-label={t('playful.practice')}><Mic /></Button><strong>{t('playful.practice')}</strong></div>
  </div>;
}