import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { startOfDay, subDays, format, eachDayOfInterval, startOfWeek } from "date-fns";

interface DayData {
  date: Date;
  count: number;
}

const PracticeHeatmap = () => {
  const [heatmapData, setHeatmapData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHeatmapData();
  }, []);

  const loadHeatmapData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = startOfDay(new Date());
      const startDate = subDays(today, 364); // Last 365 days

      // Get all practice sessions
      const { data: practiceSessions } = await supabase
        .from("practice_sessions")
        .select("session_date")
        .gte("session_date", startDate.toISOString());

      const { data: presentationSessions } = await supabase
        .from("presentation_sessions")
        .select("created_at")
        .gte("created_at", startDate.toISOString());

      // Count practices per day
      const practiceCountMap = new Map<string, number>();
      
      practiceSessions?.forEach(session => {
        const dateKey = startOfDay(new Date(session.session_date)).toISOString();
        practiceCountMap.set(dateKey, (practiceCountMap.get(dateKey) || 0) + 1);
      });

      presentationSessions?.forEach(session => {
        const dateKey = startOfDay(new Date(session.created_at)).toISOString();
        practiceCountMap.set(dateKey, (practiceCountMap.get(dateKey) || 0) + 1);
      });

      // Create array of all days
      const allDays = eachDayOfInterval({ start: startDate, end: today });
      const heatmapData = allDays.map(date => ({
        date,
        count: practiceCountMap.get(date.toISOString()) || 0,
      }));

      setHeatmapData(heatmapData);
    } catch (error) {
      console.error("Error loading heatmap data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIntensityClass = (count: number) => {
    if (count === 0) return "bg-muted";
    if (count === 1) return "bg-primary/20";
    if (count === 2) return "bg-primary/40";
    if (count === 3) return "bg-primary/60";
    return "bg-primary";
  };

  // Group days by weeks (7 days each)
  const weeks: DayData[][] = [];
  for (let i = 0; i < heatmapData.length; i += 7) {
    weeks.push(heatmapData.slice(i, i + 7));
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Practice Activity</CardTitle>
          <CardDescription>Your practice consistency over the last year</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-32 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice Activity</CardTitle>
        <CardDescription>Your practice consistency over the last year</CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto">
            <div className="inline-flex flex-col gap-1">
              <div className="flex gap-1">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((day, dayIndex) => (
                      <Tooltip key={dayIndex}>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-3 h-3 rounded-sm transition-colors ${getIntensityClass(day.count)}`}
                            style={{ minWidth: '12px', minHeight: '12px' }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{format(day.date, "MMM d, yyyy")}</p>
                          <p className="text-sm">
                            {day.count === 0 ? "No practice" : `${day.count} session${day.count > 1 ? "s" : ""}`}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-muted"></div>
              <div className="w-3 h-3 rounded-sm bg-primary/20"></div>
              <div className="w-3 h-3 rounded-sm bg-primary/40"></div>
              <div className="w-3 h-3 rounded-sm bg-primary/60"></div>
              <div className="w-3 h-3 rounded-sm bg-primary"></div>
            </div>
            <span>More</span>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};

export default PracticeHeatmap;
