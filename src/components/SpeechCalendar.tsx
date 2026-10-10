import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Mic, RotateCcw, Target, Trophy, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, isAfter, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

type EventType = "practice" | "recall" | "test" | "presentation" | "full_runthrough";

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
  full_runthrough: Flag,
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
    const runthrough: Date[] = [];
    const completed: Date[] = [];

    for (const e of events) {
      const d = new Date(`${e.event_date}T00:00:00`);
      if (e.event_type === "presentation") presentation.push(d);
      else if (e.event_type === "full_runthrough") runthrough.push(d);
      else if (e.event_type === "test") test.push(d);
      else if (e.event_type === "recall") recall.push(d);
      else practice.push(d);
      if (e.completed) completed.push(d);
    }

    return { practice, recall, test, presentation, runthrough, completed };
  }, [events]);

  const modifiersClassNames = {
    practice:
      "s-pd after:content-[''] s-2h s-2m s-2r s-2g s-2o s-2u s-2t s-2k",
    recall:
      "s-pd after:content-[''] s-2h s-2m s-2r s-2g s-2o s-2u s-2t s-2i",
    test:
      "s-pd after:content-[''] s-2h s-2m s-2r s-2g s-2o s-2u s-2t s-2j",
    runthrough:
      "s-pd s-d3 after:content-[''] s-2h s-2m s-2r s-2g s-2p s-2v s-2t s-2l",
    presentation:
      "s-4s from-rose-500 to-orange-500 s-3 s-qe s-d3 s-qy",
    completed:
      "s-pm s-pq s-ps s-pu",
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
    if (type === "full_runthrough") return t("calendar.fullRunthrough");
    return t("calendar.presentationDay");
  };

  return (
    <div className="s-t1">
      {/* Legend */}
      <div className="s-c5 s-cb s-dp s-vj s-ul">
        <span className="s-c5 s-ib s-dm">
          <span className="s-fs s-xk s-qe s-5c" />
          {t("calendar.practice")}
        </span>
        <span className="s-c5 s-ib s-dm">
          <span className="s-fs s-xk s-qe s-3r" />
          {t("calendar.recall")}
        </span>
        <span className="s-c5 s-ib s-dm">
          <span className="s-fs s-xk s-qe s-58" />
          {t("calendar.test")}
        </span>
        <span className="s-c5 s-ib s-dm">
          <span className="s-fs s-xk s-qe s-5r" />
          {t("calendar.fullRunthrough")}
        </span>
        <span className="s-c5 s-ib s-dm">
          <span className="s-fs s-xk s-qe s-4s from-rose-500 to-orange-500" />
          {t("calendar.presentationDay")}
        </span>
        <span className="s-c5 s-ib s-dm">
          <span className="s-fs s-xk s-qe s-pm s-pr s-ps" />
          {t("calendar.completed")}
        </span>
      </div>

      <Card className="s-6m s-4c">
        <CardContent className="s-mu s-s6">
          {loading || generating ? (
            <div className="s-c5 s-c7 s-ib s-ig s-dp s-p1">
              <Loader2 className="s-g2 s-xw s-32 s-ul" />
              {generating && (
                <p className="s-v9 s-ul">
                  {t("calendar.generating")}
                </p>
              )}
            </div>
          ) : events.length === 0 ? (
            <div className="s-c5 s-c7 s-ib s-ig s-dp s-p0 s-u0">
              <p className="s-v9 s-ul s-ju">
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
              className={cn("s-mv s-nw s-m9")}
            />
          )}
        </CardContent>
      </Card>

      {/* Day detail */}
      {selectedDate && events.length > 0 && (
        <Card className="s-6m s-4c">
          <CardContent className="s-mw s-t0">
            <div className="s-c5 s-ib s-if">
              <div>
                <p className="s-v9 s-ul">
                  {format(selectedDate, "EEEE, d MMM yyyy")}
                </p>
                <p className="s-tw s-d3">
                  {isSelectedToday
                    ? t("calendar.today")
                    : selectedEvents.length > 0
                    ? t("calendar.plannedSessions", { count: selectedEvents.length })
                    : t("calendar.noSessions")}
                </p>
              </div>
            </div>

            {selectedEvents.length > 0 ? (
              <div className="s-sy">
                {selectedEvents.map((e) => {
                  const Icon = EVENT_ICONS[e.event_type];
                  const isPresentation = e.event_type === "presentation";
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        "s-c5 s-ib s-dp s-mv s-qo s-6l s-3w",
                        e.completed && "s-mh",
                        isPresentation &&
                          "s-4t s-dj s-vv s-7y",
                      )}
                    >
                      <div
                        className={cn(
                          "s-mu s-qh",
                          e.event_type === "practice" && "s-5e s-uw",
                          e.event_type === "recall" && "s-3t s-tu s-8p",
                          e.event_type === "test" && "s-59 s-ut s-8t",
                          e.event_type === "full_runthrough" && "s-5s s-v5 s-8w",
                          isPresentation && "s-4s from-rose-500 to-orange-500 s-vg",
                        )}
                      >
                        <Icon className="s-fz s-xt" />
                      </div>
                      <div className="s-c6 s-l8">
                        <p className="s-v9 s-d0">{renderEventLabel(e.event_type)}</p>
                        {isPresentation && (
                          <p className="s-vj s-ul truncate">{speechTitle}</p>
                        )}
                      </div>
                      {e.completed ? (
                        <Badge variant="outline" className="s-u8 s-7b">
                          {t("calendar.done")}
                        </Badge>
                      ) : isSelectedToday && !isPresentation ? (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/practice/${speechId}`)}
                        >
                          <Play className="s-fx s-xq s-ln" />
                          {t("calendar.start")}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="s-v9 s-ul">{t("calendar.restDay")}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SpeechCalendar;
