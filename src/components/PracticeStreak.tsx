import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, TrendingUp } from "lucide-react";
import { startOfDay, differenceInDays, subDays } from "date-fns";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalPracticeDays: number;
}

const PracticeStreak = () => {
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    totalPracticeDays: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStreakData();
  }, []);

  const loadStreakData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all practice sessions
      const { data: practiceSessions } = await supabase
        .from("practice_sessions")
        .select("session_date, speech_id")
        .order("session_date", { ascending: false });

      const { data: presentationSessions } = await supabase
        .from("presentation_sessions")
        .select("created_at, speech_id")
        .order("created_at", { ascending: false });

      // Combine and get unique practice days
      const allDates = new Set<string>();
      
      practiceSessions?.forEach(session => {
        const date = startOfDay(new Date(session.session_date)).toISOString();
        allDates.add(date);
      });

      presentationSessions?.forEach(session => {
        const date = startOfDay(new Date(session.created_at)).toISOString();
        allDates.add(date);
      });

      const uniqueDates = Array.from(allDates)
        .map(d => new Date(d))
        .sort((a, b) => b.getTime() - a.getTime());

      if (uniqueDates.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate current streak
      let currentStreak = 0;
      const today = startOfDay(new Date());
      
      // Check if practiced today or yesterday (to allow for grace period)
      const mostRecentPractice = uniqueDates[0];
      const daysSinceLastPractice = differenceInDays(today, mostRecentPractice);
      
      if (daysSinceLastPractice <= 1) {
        currentStreak = 1;
        
        // Count consecutive days backwards
        for (let i = 1; i < uniqueDates.length; i++) {
          const currentDate = uniqueDates[i];
          const previousDate = uniqueDates[i - 1];
          const daysDiff = differenceInDays(previousDate, currentDate);
          
          if (daysDiff === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      // Calculate longest streak
      let longestStreak = 0;
      let tempStreak = 1;
      
      for (let i = 1; i < uniqueDates.length; i++) {
        const daysDiff = differenceInDays(uniqueDates[i - 1], uniqueDates[i]);
        
        if (daysDiff === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);

      setStreakData({
        currentStreak,
        longestStreak,
        totalPracticeDays: uniqueDates.length,
      });
    } catch (error) {
      console.error("Error loading streak data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-warning" />
            Practice Streak
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-20 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-warning" />
          Practice Streak
        </CardTitle>
        <CardDescription>Keep up your daily practice momentum</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-warning">{streakData.currentStreak}</div>
            <div className="text-sm text-muted-foreground mt-1">Day Streak</div>
          </div>
          <div className="text-center border-x border-border">
            <div className="text-3xl font-bold text-primary flex items-center justify-center gap-1">
              <TrendingUp className="h-6 w-6" />
              {streakData.longestStreak}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Best Streak</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{streakData.totalPracticeDays}</div>
            <div className="text-sm text-muted-foreground mt-1">Total Days</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PracticeStreak;
