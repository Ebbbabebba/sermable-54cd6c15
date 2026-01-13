import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Target, Clock, Flame, AlertTriangle } from "lucide-react";
import { format, subDays, differenceInDays } from "date-fns";
import { useTranslation } from "react-i18next";

interface PresentationSession {
  id: string;
  speech_id: string;
  accuracy: number;
  duration_seconds: number;
  created_at: string;
  missed_words: string[];
  feedback_summary: string;
  speeches?: { title: string; goal_date: string };
}

interface WeeklyStats {
  totalSessions: number;
  avgAccuracy: number;
  totalPracticeTime: number;
  accuracyTrend: number;
  speechesWithDeadlines: { title: string; daysLeft: number; lastAccuracy: number }[];
  commonMissedWords: { word: string; count: number }[];
  dailyActivity: { date: string; sessions: number; avgAccuracy: number }[];
}

export const WeeklyAnalytics = () => {
  const { t } = useTranslation();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["weekly-analytics"],
    queryFn: async (): Promise<WeeklyStats> => {
      const weekAgo = subDays(new Date(), 7).toISOString();
      const twoWeeksAgo = subDays(new Date(), 14).toISOString();

      // Get this week's sessions
      const { data: thisWeek } = await supabase
        .from("presentation_sessions")
        .select("*, speeches(title, goal_date)")
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false });

      // Get last week's sessions for trend
      const { data: lastWeek } = await supabase
        .from("presentation_sessions")
        .select("accuracy")
        .gte("created_at", twoWeeksAgo)
        .lt("created_at", weekAgo);

      const sessions = (thisWeek || []) as PresentationSession[];
      const lastWeekSessions = lastWeek || [];

      // Calculate stats
      const totalSessions = sessions.length;
      const avgAccuracy = sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (s.accuracy || 0), 0) / sessions.length
        : 0;
      const totalPracticeTime = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

      const lastWeekAvg = lastWeekSessions.length > 0
        ? lastWeekSessions.reduce((sum, s) => sum + (s.accuracy || 0), 0) / lastWeekSessions.length
        : 0;
      const accuracyTrend = avgAccuracy - lastWeekAvg;

      // Speeches with upcoming deadlines
      const { data: speeches } = await supabase
        .from("speeches")
        .select("id, title, goal_date, last_accuracy")
        .not("goal_date", "is", null)
        .order("goal_date", { ascending: true });

      const speechesWithDeadlines = (speeches || [])
        .map(s => ({
          title: s.title,
          daysLeft: differenceInDays(new Date(s.goal_date), new Date()),
          lastAccuracy: s.last_accuracy || 0
        }))
        .filter(s => s.daysLeft >= 0 && s.daysLeft <= 30);

      // Common missed words
      const wordCounts: Record<string, number> = {};
      sessions.forEach(s => {
        (s.missed_words || []).forEach(word => {
          const cleanWord = word.toLowerCase().trim().split(' ')[0];
          if (cleanWord.length > 2) {
            wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
          }
        });
      });
      const commonMissedWords = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word, count]) => ({ word, count }));

      // Daily activity
      const dailyMap: Record<string, { sessions: number; totalAcc: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        dailyMap[date] = { sessions: 0, totalAcc: 0 };
      }
      sessions.forEach(s => {
        const date = format(new Date(s.created_at), "yyyy-MM-dd");
        if (dailyMap[date]) {
          dailyMap[date].sessions++;
          dailyMap[date].totalAcc += s.accuracy || 0;
        }
      });
      const dailyActivity = Object.entries(dailyMap).map(([date, data]) => ({
        date: format(new Date(date), "EEE"),
        sessions: data.sessions,
        avgAccuracy: data.sessions > 0 ? data.totalAcc / data.sessions : 0
      }));

      return {
        totalSessions,
        avgAccuracy,
        totalPracticeTime,
        accuracyTrend,
        speechesWithDeadlines,
        commonMissedWords,
        dailyActivity
      };
    }
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="h-48" />
      </Card>
    );
  }

  if (!stats || stats.totalSessions === 0) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No practice sessions this week</p>
          <p className="text-xs mt-1">Start practicing to see your analytics</p>
        </CardContent>
      </Card>
    );
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="py-3 px-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.totalSessions}</div>
            <div className="text-xs text-muted-foreground">Sessions</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-accent/10 to-accent/5">
          <CardContent className="py-3 px-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold">{stats.avgAccuracy.toFixed(0)}%</span>
              {stats.accuracyTrend !== 0 && (
                stats.accuracyTrend > 0 
                  ? <TrendingUp className="h-4 w-4 text-green-500" />
                  : <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">Avg Accuracy</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5">
          <CardContent className="py-3 px-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg font-bold">{formatTime(stats.totalPracticeTime)}</span>
            </div>
            <div className="text-xs text-muted-foreground">Practice Time</div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Activity */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            Daily Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex justify-between gap-1">
            {stats.dailyActivity.map((day, i) => (
              <div key={i} className="flex-1 text-center">
                <div 
                  className={`h-12 rounded-md flex items-end justify-center ${
                    day.sessions > 0 
                      ? 'bg-gradient-to-t from-primary to-primary/50' 
                      : 'bg-muted/30'
                  }`}
                  style={{ 
                    opacity: day.sessions > 0 ? 0.5 + (day.avgAccuracy / 200) : 0.3 
                  }}
                >
                  {day.sessions > 0 && (
                    <span className="text-xs font-medium text-primary-foreground pb-1">
                      {day.sessions}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{day.date}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Deadlines */}
      {stats.speechesWithDeadlines.length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {stats.speechesWithDeadlines.slice(0, 3).map((speech, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium truncate max-w-[60%]">{speech.title}</span>
                  <span className={`text-xs ${
                    speech.daysLeft <= 3 ? 'text-red-500 font-bold' : 'text-muted-foreground'
                  }`}>
                    {speech.daysLeft === 0 ? 'Today!' : `${speech.daysLeft}d left`}
                  </span>
                </div>
                <Progress 
                  value={speech.lastAccuracy} 
                  className="h-1.5"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Words to Focus On */}
      {stats.commonMissedWords.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Words to Focus On</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {stats.commonMissedWords.map((item, i) => (
                <span 
                  key={i}
                  className="px-2 py-1 bg-red-500/10 text-red-500 rounded-md text-xs font-medium"
                >
                  {item.word} ({item.count}x)
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
