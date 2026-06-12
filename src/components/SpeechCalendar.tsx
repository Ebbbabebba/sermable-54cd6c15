import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Mic, RotateCcw, Target, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, isAfter, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

type EventType = "practice" | "recall" | "test" | "presentation";

interface CalendarEvent {
  id: string;
  event_date: string; // YYYY-MM-DD
  event_type: EventType;
  completed: boolean;
  completed_at: string | null;
}

interface SpeechCalendarProps {
  speechId: string;
  goalDate: string | null;
  speechTitle: string;
}

const EVENT_ICONS: Record<EventType, typeof Mic> = {
  practice: Mic,
  recall: RotateCcw,
  test: Target,
  presentation: Trophy,
};

const SpeechCalendar = ({ speechId, goalDate, speechTitle }: SpeechCalendarProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());

  const loadEvents = async (): Promise<CalendarEvent[]> => {
    const { data, error } = await supabase
      .from("speech_calendar_events")
      .select("id, event_date, event_type, completed, completed_at")
      .eq("speech_id", speechId)
      .order("event_date", { ascending: true });

    if (error) {
      console.error("Failed to load calendar events:", error);
      return [];
    }
    const list = (data ?? []) as CalendarEvent[];
    setEvents(list);
    return list;
  };

  const autoGenerate = async () => {
    if (!goalDate) return;
    setGenerating(true);
    const { error } = await supabase.functions.invoke(
      "generate-speech-schedule",
      { body: { speechId } },
    );
    if (error) {
      console.error("Auto-generate schedule failed:", error);
    } else {
      await loadEvents();
    }
    setGenerating(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await loadEvents();
      if (cancelled) return;
      // Auto-generate if missing and we have a deadline
      if (list.length === 0 && goalDate) {
        await autoGenerate();
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechId, goalDate]);

  // Group events by date for the day picker modifiers
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const arr = map.get(e.event_date) ?? [];
      arr.push(e);
      map.set(e.event_date, arr);
    }
    return map;
  }, [events]);

  const modifiers = useMemo(() => {
    const practice: Date[] = [];
    const recall: Date[] = [];
    const test: Date[] = [];
    const presentation: Date[] = [];
    const completed: Date[] = [];

    for (const e of events) {
      const d = new Date(`${e.event_date}T00:00:00`);
      if (e.event_type === "presentation") presentation.push(d);
      else if (e.event_type === "test") test.push(d);
      else if (e.event_type === "recall") recall.push(d);
      else practice.push(d);
      if (e.completed) completed.push(d);
    }

    return { practice, recall, test, presentation, completed };
  }, [events]);

  const modifiersClassNames = {
    practice:
      "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
    recall:
      "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-amber-500",
    test:
      "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-orange-500",
    presentation:
      "bg-gradient-to-br from-rose-500 to-orange-500 !text-white rounded-full font-semibold shadow-md",
    completed:
      "ring-2 ring-emerald-500/50 ring-offset-1 ring-offset-background",
  } as const;

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedEvents = selectedKey ? eventsByDate.get(selectedKey) ?? [] : [];
  const isSelectedToday = selectedKey === todayKey;
  const isSelectedFuture = selectedDate
    ? isAfter(startOfDay(selectedDate), startOfDay(new Date()))
    : false;

  const renderEventLabel = (type: EventType) => {
    if (type === "practice") return t("calendar.practice");
    if (type === "recall") return t("calendar.recall");
    if (type === "test") return t("calendar.test");
    return t("calendar.presentationDay");
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {t("calendar.practice")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {t("calendar.recall")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          {t("calendar.test")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gradient-to-br from-rose-500 to-orange-500" />
          {t("calendar.presentationDay")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full ring-2 ring-emerald-500/60 ring-offset-1" />
          {t("calendar.completed")}
        </span>
      </div>

      <Card className="border-0 bg-card/60">
        <CardContent className="p-2 sm:p-4">
          {loading || generating ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              {generating && (
                <p className="text-sm text-muted-foreground">
                  {t("calendar.generating")}
                </p>
              )}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground max-w-xs">
                {goalDate ? t("calendar.empty") : t("calendar.noDeadlineDescription")}
              </p>
            </div>
          ) : (
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={month}
              onMonthChange={setMonth}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              className={cn("p-3 pointer-events-auto mx-auto")}
            />
          )}
        </CardContent>
      </Card>

      {/* Day detail */}
      {selectedDate && events.length > 0 && (
        <Card className="border-0 bg-card/60">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {format(selectedDate, "EEEE, d MMM yyyy")}
                </p>
                <p className="text-base font-semibold">
                  {isSelectedToday
                    ? t("calendar.today")
                    : selectedEvents.length > 0
                    ? t("calendar.plannedSessions", { count: selectedEvents.length })
                    : t("calendar.noSessions")}
                </p>
              </div>
            </div>

            {selectedEvents.length > 0 ? (
              <div className="space-y-2">
                {selectedEvents.map((e) => {
                  const Icon = EVENT_ICONS[e.event_type];
                  const isPresentation = e.event_type === "presentation";
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border bg-background/40",
                        e.completed && "opacity-60",
                        isPresentation &&
                          "bg-gradient-to-r from-rose-500/10 to-orange-500/10 border-rose-500/30",
                      )}
                    >
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          e.event_type === "practice" && "bg-primary/10 text-primary",
                          e.event_type === "recall" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                          e.event_type === "test" && "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                          isPresentation && "bg-gradient-to-br from-rose-500 to-orange-500 text-white",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{renderEventLabel(e.event_type)}</p>
                        {isPresentation && (
                          <p className="text-xs text-muted-foreground truncate">{speechTitle}</p>
                        )}
                      </div>
                      {e.completed ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-500/40">
                          {t("calendar.done")}
                        </Badge>
                      ) : isSelectedToday && !isPresentation ? (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/practice/${speechId}`)}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" />
                          {t("calendar.start")}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("calendar.restDay")}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SpeechCalendar;
