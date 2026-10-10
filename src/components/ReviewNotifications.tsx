import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";

interface DueBeat {
  speech_id: string;
  speech_title: string;
  beat_id: string;
  beat_order: number;
  due_at: string;
  priority_score: number;
  goal_date: string | null;
  speech_created_at?: string;
}

const ReviewNotifications = () => {
  const { t } = useTranslation();
  const [dueBeats, setDueBeats] = useState<DueBeat[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDueBeats();
    const interval = setInterval(loadDueBeats, 5 * 60 * 1000);
    // Re-run once the auth session is established (iOS/Safari restores it
    // asynchronously, so the first call right after login often hits no-user).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        loadDueBeats();
      }
    });
    return () => {
      clearInterval(interval);
      sub.subscription.unsubscribe();
    };
  }, []);

  const loadDueBeats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase.rpc('get_top_due_beats', {
        p_user_id: user.id,
        p_limit: 5,
      });

      if (error) throw error;

      const speechIds = Array.from(
        new Set((data ?? []).map((beat: DueBeat) => beat.speech_id)),
      );
      const createdAtBySpeech = new Map<string, string>();
      if (speechIds.length > 0) {
        const { data: speeches, error: speechesError } = await supabase
          .from("speeches")
          .select("id, created_at")
          .in("id", speechIds);
        if (speechesError) throw speechesError;
        for (const speech of speeches ?? []) {
          if (speech.created_at) createdAtBySpeech.set(speech.id, speech.created_at);
        }
      }

      // Only show items that are actually due (priority high or overdue)
      const now = Date.now();
      const filtered = (data ?? []).filter((b: DueBeat) => {
        const dueMs = new Date(b.due_at).getTime();
        return dueMs <= now || b.priority_score >= 0.5;
      }).map((beat: DueBeat) => ({
        ...beat,
        speech_created_at: createdAtBySpeech.get(beat.speech_id),
      }));

      setDueBeats(filtered);
    } catch (error) {
      console.error('Error loading due beats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="s-c5 s-ib s-ig s-p9">
          <Loader2 className="s-g2 s-xw s-32 s-ul" />
        </CardContent>
      </Card>
    );
  }

  if (dueBeats.length === 0) return null;

  // Group by speech so we show one entry per speech (with top beat first)
  const bySpeech = new Map<string, DueBeat>();
  for (const b of dueBeats) {
    if (!bySpeech.has(b.speech_id)) bySpeech.set(b.speech_id, b);
  }
  const grouped = Array.from(bySpeech.values());

  return (
    <Card className="s-6l s-71 s-qa s-4b s-r3">
      <CardHeader>
        <div className="s-c5 s-ib s-if">
          <div className="s-c5 s-ib s-dn">
            <div className="s-i4 s-ib s-ig s-g6 s-y0 s-qe s-5e s-uw">
              <Bell className="s-fz s-xt" />
            </div>
            <CardTitle>{t('dashboard.dueForPractice', 'Redo att öva')}</CardTitle>
          </div>
          <Badge variant="secondary" className="s-lk s-qe">
            {grouped.length}
          </Badge>
        </div>
        <CardDescription>
          {t('dashboard.dueForPracticeDescription', 'Dessa moment är optimala att öva på just nu')}
        </CardDescription>
      </CardHeader>
      <CardContent className="s-t0">
        {grouped.map((b) => {
          const dueMs = new Date(b.due_at).getTime();
          const createdMs = b.speech_created_at
            ? new Date(b.speech_created_at).getTime()
            : Number.NaN;
          const isNewSpeech = Number.isFinite(createdMs)
            && createdMs > Date.now() - 24 * 60 * 60 * 1000;
          // Give a full day of grace before calling something "overdue" —
          // a freshly created speech is due immediately and should read as
          // "ready now", not as if the user already missed it.
          const isOverdue = !isNewSpeech && dueMs <= Date.now() - 24 * 60 * 60 * 1000;
          const isDueNow = !isOverdue && dueMs <= Date.now();
          return (
            <button
              key={b.beat_id}
              onClick={() => navigate(`/practice/${b.speech_id}`)}
              className="s-y7 s-c5 s-ib s-if s-mw s-q9 s-5w s-h9 s-ws s-uj"
            >
              <div className="s-c6 s-l8 s-lr">
                <h4 className="s-d3 truncate">{b.speech_title}</h4>
                <div className="s-c5 s-ib s-dp s-lt s-v9 s-ul">
                  <span>
                    {t('dashboard.beat', 'Moment')} {b.beat_order + 1}
                  </span>
                  {isOverdue ? (
                    <Badge variant="destructive" className="s-vj s-qe">
                      {t('dashboard.overdue', 'Försenad')}
                    </Badge>
                  ) : isDueNow ? (
                    <Badge variant="secondary" className="s-vj s-qe">
                      {t('dashboard.readyNow', 'Redo nu')}
                    </Badge>
                  ) : (
                    <span>
                      {t('dashboard.inTime', 'om')} {formatDistanceToNow(new Date(b.due_at))}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="s-g1 s-xv s-ul" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ReviewNotifications;
