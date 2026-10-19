import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type OverviewBeat = Pick<Tables<'practice_beats'>, 'id' | 'speech_id' | 'beat_order' | 'is_mastered' | 'practice_stage' | 'ladder_rung' | 'recall_10min_at' | 'recall_evening_at' | 'recall_morning_at' | 'next_scheduled_recall_at'>;
export function useSpeechOverview(ids: string[]) {
  const [data, setData] = useState<{ beats: OverviewBeat[]; sessions: Tables<'practice_sessions'>[]; ready: boolean }>({ beats: [], sessions: [], ready: false });
  const key = ids.join(',');
  useEffect(() => {
    let cancelled = false;
    const speechIds = key ? key.split(',') : [];
    if (!speechIds.length) { setData({ beats: [], sessions: [], ready: true }); return; }
    setData(previous => ({ ...previous, ready: false }));
    void Promise.all([
      supabase.from('practice_beats').select('id,speech_id,beat_order,is_mastered,practice_stage,ladder_rung,recall_10min_at,recall_evening_at,recall_morning_at,next_scheduled_recall_at').in('speech_id', speechIds).order('beat_order'),
      supabase.from('practice_sessions').select('*').in('speech_id', speechIds).order('session_date', { ascending: false }).limit(100),
    ]).then(([beats, sessions]) => {
      if (!cancelled) setData({ beats: beats.data ?? [], sessions: sessions.data ?? [], ready: !beats.error && !sessions.error });
    }).catch(() => { if (!cancelled) setData({ beats: [], sessions: [], ready: false }); });
    return () => { cancelled = true; };
  }, [key]);
  return data;
}