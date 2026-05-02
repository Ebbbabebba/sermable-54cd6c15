import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar as CalendarIcon, Info, Loader2, Play, Presentation } from "lucide-react";
import SpeechCalendar from "@/components/SpeechCalendar";
import { differenceInDays } from "date-fns";

interface Speech {
  id: string;
  title: string;
  text_original: string;
  goal_date: string | null;
  speech_language: string | null;
  mastery_level: number | null;
  last_accuracy: number | null;
}

const SpeechDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("speeches")
        .select("id, title, text_original, goal_date, speech_language, mastery_level, last_accuracy")
        .eq("id", id)
        .single();
      if (error) {
        console.error("Failed to load speech:", error);
      } else {
        setSpeech(data as Speech);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!speech) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <p className="text-muted-foreground">{t("speechDetail.notFound")}</p>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.back")}
        </Button>
      </div>
    );
  }

  const daysLeft = speech.goal_date
    ? differenceInDays(new Date(speech.goal_date), new Date())
    : null;
  const wordCount = speech.text_original.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back")}
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate(`/presentation/${speech.id}`)}>
              <Presentation className="h-4 w-4 mr-2" />
              {t("speechDetail.present")}
            </Button>
            <Button size="sm" onClick={() => navigate(`/practice/${speech.id}`)}>
              <Play className="h-4 w-4 mr-2" />
              {t("speechDetail.practice")}
            </Button>
          </div>
        </div>
      </header>

      <main
        className="container mx-auto px-4 py-6 max-w-3xl space-y-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)" }}
      >
        <div>
          <h1 className="text-3xl font-bold mb-1">{speech.title}</h1>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>{t("speechDetail.wordCount", { count: wordCount })}</span>
            {daysLeft !== null && daysLeft >= 0 && (
              <span>· {t("speechDetail.daysLeft", { count: daysLeft })}</span>
            )}
            {typeof speech.last_accuracy === "number" && speech.last_accuracy > 0 && (
              <span>· {t("speechDetail.lastAccuracy", { value: Math.round(speech.last_accuracy * 100) })}</span>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full max-w-sm">
            <TabsTrigger value="overview">
              <Info className="h-4 w-4 mr-2" />
              {t("speechDetail.tabs.overview")}
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarIcon className="h-4 w-4 mr-2" />
              {t("speechDetail.tabs.calendar")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="space-y-4">
              <div className="rounded-xl border bg-card/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  {t("speechDetail.scriptPreview")}
                </p>
                <p className="text-sm leading-relaxed line-clamp-[12] whitespace-pre-wrap">
                  {speech.text_original}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <SpeechCalendar
              speechId={speech.id}
              goalDate={speech.goal_date}
              speechTitle={speech.title}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SpeechDetail;
