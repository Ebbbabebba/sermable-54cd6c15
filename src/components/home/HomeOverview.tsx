import { CalendarDays, Check, Flame, Mic, Target, Trophy, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { MasteryRing } from './MasteryRing';
import type { OverviewBeat } from '@/hooks/useSpeechOverview';

export function CountdownCard({ date }: { date: string }) {
  const { t, i18n } = useTranslation();
  const days = differenceInCalendarDays(parseISO(date), new Date());
  if (!Number.isFinite(days)) return null;
  return <div className="countdown-card"><CalendarDays /><div><strong>{days === 0 ? t('dashboard.presentationDay') : days < 0 ? t('dashboard.daysOverduePlural', { count: Math.abs(days) }) : t('playful.days', { count: days })}</strong><span>{new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(parseISO(date))}</span></div></div>;
}

export function BeatChips({ beats, onSelect }: { beats: OverviewBeat[]; onSelect: () => void }) {
  const { t } = useTranslation();
  return <div className="beat-chips">{beats.map((beat, index) => <Button key={beat.id} variant="ghost" className={`beat-chip beat-chip--${beat.is_mastered ? 'complete' : beat.practice_stage && beat.practice_stage !== 'new' ? 'learning' : 'new'}`} onClick={onSelect} aria-label={`${t('playful.beat')} ${index + 1}`} title={t(beat.is_mastered ? 'playful.completed' : beat.practice_stage && beat.practice_stage !== 'new' ? 'playful.learning' : 'playful.new')}>
    {beat.is_mastered ? <Check /> : index + 1}
  </Button>)}</div>;
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
  const fmt = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' });
  return <section className="review-section"><h2>{t('playful.reviews')}</h2><ol className="review-timeline">{stages.map((stage, i) => <li key={stage} className={complete[i] ? 'is-complete' : i === next && dates.length ? 'is-next' : ''}><span className="review-timeline__dot">{complete[i] ? <Check /> : i + 1}</span><span>{t(`playful.${stage}`)}</span>{planned && <small className="review-timeline__date">{fmt.format(planned[i])}</small>}</li>)}</ol>{dates[0] && <p className="review-section__due"><Clock3 />{t('dashboard.nextPractice')} · {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dates[0]))}</p>}</section>;
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
    {speech.goal_date && <CountdownCard date={speech.goal_date} />}
    <div className="home-overview__mastery"><MasteryRing value={percent} label={t('playful.completed')} /><h2>{t('playful.completed')}</h2><p>{ready ? t('playful.beatCount', { count: mastered, total: beats.length }) : t('common.loading')}</p></div>
    <ReviewTimeline beats={beats} />
    <section className="home-beats"><h2>{t('playful.beats')}</h2><BeatChips beats={beats} onSelect={onPractice} />{!beats.length && <p>{t('playful.noBeats')}</p>}</section>
    <StatsCards streak={streak} accuracy={accuracy} mastered={mastered} total={beats.length} />
    <div className="home-practice"><Button className="home-practice__mic" size="icon" onClick={onPractice} aria-label={t('playful.practice')}><Mic /></Button><strong>{t('playful.practice')}</strong></div>
  </div>;
}