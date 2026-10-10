import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar as CalendarIcon, Info, Loader2, Play, Presentation, Printer } from "lucide-react";
import SpeechCalendar from "@/components/SpeechCalendar";
import { BeatPrintDialog } from "@/components/BeatPrintDialog";
import { addDays, differenceInDays, format } from "date-fns";
import { stripPropCueMarkers } from "@/utils/propCues";

interface Speech {
  id: string;
  title: string;
  text_original: string;
  goal_date: string | null;
  speech_language: string | null;
  mastery_level: number | null;
  last_accuracy: number | null;
  practice_strictness: string | null;
  familiarity_level: string | null;
  knowledge_test_completed_at: string | null;
}


const SpeechDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [printOpen, setPrintOpen] = useState(false);


  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("speeches")
        .select("id, title, text_original, goal_date, speech_language, mastery_level, last_accuracy, practice_strictness, familiarity_level, knowledge_test_completed_at")
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
      <div className="s-l6 s-c5 s-ib s-ig s-3v">
        <Loader2 className="s-g2 s-xw s-32 s-ul" />
      </div>
    );
  }

  if (!speech) {
    return (
      <div className="s-l6 s-c5 s-c7 s-ib s-ig s-3v s-dp">
        <p className="s-ul">{t("speechDetail.notFound")}</p>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="s-fz s-xt s-lp" />
          {t("common.back")}
        </Button>
      </div>
    );
  }

  const daysLeft = speech.goal_date
    ? differenceInDays(new Date(speech.goal_date), new Date())
    : null;
  const cleanSpeechText = stripPropCueMarkers(speech.text_original);
  const wordCount = cleanSpeechText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="s-c5 s-c7 s-gi s-3v s-mn">
      <header
        className="s-ca s-t7 s-w1 s-ye s-6v s-4f s-3d"
        style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}
      >
        <div
          className="s-m9 s-y7 s-jd s-c5 s-ib s-if s-dn s-p6"
          style={{
            paddingLeft: "max(16px, env(safe-area-inset-left))",
            paddingRight: "max(16px, env(safe-area-inset-right))",
          }}
        >
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="s-r5">
            <ArrowLeft className="s-fz s-xt s-s3" />
            <span className="s-gm s-rp">{t("common.back")}</span>
          </Button>
          <div className="s-c5 s-dm s-l8">
            <Button size="sm" variant="ghost" onClick={() => setPrintOpen(true)} aria-label={t("beatPrint.title", "Skriv ut manus")}>
              <Printer className="s-fz s-xt s-s3" />
              <span className="s-gm s-rp">{t("speechDetail.print", "Skriv ut")}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(`/presentation/${speech.id}`)}>
              <Presentation className="s-fz s-xt s-s3" />
              <span className="s-gm s-rp">{t("speechDetail.present")}</span>
            </Button>
            <Button size="sm" onClick={() => navigate(`/practice/${speech.id}`)}>
              <Play className="s-fz s-xt s-s3" />
              <span className="s-gm s-rp">{t("speechDetail.practice")}</span>
            </Button>
          </div>
        </div>
      </header>

      <main
        className="s-c6 s-mq s-m9 s-y7 s-jd s-t3 s-p9"
        style={{
          paddingLeft: "max(16px, env(safe-area-inset-left))",
          paddingRight: "max(16px, env(safe-area-inset-right))",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        }}
      >
        <div>
          <h1 className="s-ta s-cx s-jw">{speech.title}</h1>
          <div className="s-c5 s-cb s-dp s-v9 s-ul">
            <span>{t("speechDetail.wordCount", { count: wordCount })}</span>
            {daysLeft !== null && daysLeft >= 0 && (
              <span>· {t("speechDetail.daysLeft", { count: daysLeft })}</span>
            )}
            {typeof speech.last_accuracy === "number" && speech.last_accuracy > 0 && (
              <span>· {t("speechDetail.lastAccuracy", { value: Math.round(speech.last_accuracy * 100) })}</span>
            )}
          </div>
        </div>



        <Tabs value={tab} onValueChange={setTab} className="s-y7">
          <TabsList className="s-e0 s-e2 s-y7 s-js">
            <TabsTrigger value="overview">
              <Info className="s-fz s-xt s-lp" />
              {t("speechDetail.tabs.overview")}
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarIcon className="s-fz s-xt s-lp" />
              {t("speechDetail.tabs.calendar")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="s-m0">
            <div className="s-t1">
              {daysLeft !== null && daysLeft >= 1 && (
                <div className="s-qo s-6l s-4c s-mw">
                  <p className="s-vj s-x1 s-wi s-ul s-jz">
                    {t("speechDetail.plan.title")}
                  </p>
                  <ol className="s-sz">
                    {[
                      {
                        key: "learning",
                        label: t("speechDetail.plan.learning"),
                        when: t("speechDetail.plan.until", {
                          date: format(addDays(new Date(), Math.max(1, Math.floor(daysLeft * 0.6))), "d MMM"),
                        }),
                        dot: "s-5c",
                      },
                      {
                        key: "review",
                        label: t("speechDetail.plan.review"),
                        when: t("speechDetail.plan.from", {
                          date: format(addDays(new Date(), Math.max(1, Math.floor(daysLeft * 0.6)) + 1), "d MMM"),
                        }),
                        dot: "s-3r",
                      },
                      {
                        key: "runthrough",
                        label: t("speechDetail.plan.runthrough"),
                        when: t("speechDetail.plan.on", {
                          date: format(addDays(new Date(), Math.max(1, daysLeft - 1)), "d MMM"),
                        }),
                        dot: "s-5r",
                      },
                      {
                        key: "performance",
                        label: t("speechDetail.plan.performance"),
                        when: t("speechDetail.plan.on", {
                          date: format(new Date(speech.goal_date as string), "d MMM"),
                        }),
                        dot: "s-5c",
                      },
                    ].map((row) => (
                      <li key={row.key} className="s-c5 s-ib s-dp">
                        <span className={`s-fs s-xk s-qe s-r5 ${row.dot}`} />
                        <span className="s-v9 s-c6 s-l8 truncate">{row.label}</span>
                        <span className="s-vj s-ul s-r5">{row.when}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="s-qo s-6l s-4c s-mw">
                <p className="s-vj s-x1 s-wi s-ul s-jw">
                  {t("speechDetail.scriptPreview")}
                </p>
                <p className="s-v9 s-ip s-j0 s-yd">
                  {cleanSpeechText}
                </p>
              </div>

              <div className="s-qo s-6l s-4c s-mw">
                <p className="s-vj s-x1 s-wi s-ul s-jw">
                  {t("speechDetail.strictness.title")}
                </p>
                <p className="s-vj s-ul s-jz">
                  {t("speechDetail.strictness.description")}
                </p>
                <div className="s-e0 s-e2 s-dn">
                  {(["strict", "flow"] as const).map((mode) => {
                    const active = (speech.practice_strictness ?? "strict") === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={async () => {
                          if (active) return;
                          const prev = speech.practice_strictness;
                          setSpeech({ ...speech, practice_strictness: mode });
                          const { error } = await supabase
                            .from("speeches")
                            .update({ practice_strictness: mode })
                            .eq("id", speech.id);
                          if (error) {
                            console.error("Failed to update strictness:", error);
                            setSpeech({ ...speech, practice_strictness: prev });
                          }
                        }}
                        className={`s-uj s-qh s-6l s-mv s-ws ${
                          active
                            ? "s-7n s-5e"
                            : "s-6x s-h1"
                        }`}
                      >
                        <div className="s-v9 s-d0">
                          {t(`speechDetail.strictness.${mode}`)}
                        </div>
                        <div className="s-vj s-ul s-lt">
                          {t(`speechDetail.strictness.${mode}Desc`)}
                        </div>
                        <div className="s-tm s-uq s-lv s-ip">
                          {t(`speechDetail.strictness.${mode}Help`)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="s-m0">
            <SpeechCalendar
              speechId={speech.id}
              goalDate={speech.goal_date}
              speechTitle={speech.title}
            />
          </TabsContent>
        </Tabs>
      </main>

      <BeatPrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        speechId={speech.id}
        speechTitle={speech.title}
        fallbackText={speech.text_original}
      />

    </div>

  );
};

export default SpeechDetail;
