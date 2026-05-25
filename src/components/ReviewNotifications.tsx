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
}

const ReviewNotifications = () => {
  const { t } = useTranslation();
  const [dueBeats, setDueBeats] = useState<DueBeat[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDueBeats();
    const interval = setInterval(loadDueBeats, 5 * 60 * 1000);
    return () => clearInterval(interval);
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

      // Only show items that are actually due (priority high or overdue)
      const now = Date.now();
      const filtered = (data ?? []).filter((b: DueBeat) => {
        const dueMs = new Date(b.due_at).getTime();
        return dueMs <= now || b.priority_score >= 0.5;
      });

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
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle>{t('dashboard.dueForPractice', 'Redo att öva')}</CardTitle>
          </div>
          <Badge variant="secondary" className="ml-2">
            {grouped.length}
          </Badge>
        </div>
        <CardDescription>
          {t('dashboard.dueForPracticeDescription', 'Dessa moment är optimala att öva på just nu')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {grouped.map((b) => {
          const dueMs = new Date(b.due_at).getTime();
          const isOverdue = dueMs <= Date.now();
          return (
            <button
              key={b.beat_id}
              onClick={() => navigate(`/practice/${b.speech_id}`)}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-card border hover:border-primary/50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0 mr-4">
                <h4 className="font-semibold truncate">{b.speech_title}</h4>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span>
                    {t('dashboard.beat', 'Moment')} {b.beat_order + 1}
                  </span>
                  {isOverdue ? (
                    <Badge variant="destructive" className="text-xs">
                      {t('dashboard.overdue', 'Försenad')}
                    </Badge>
                  ) : (
                    <span>
                      {t('dashboard.inTime', 'om')} {formatDistanceToNow(new Date(b.due_at))}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ReviewNotifications;
