// Fas 3: Smart notifications — interleaving, deadline priority, sleep-aware windows.
//
// One iteration per scheduled run (typically every 30 min via pg_cron):
//   - For each user with notifications enabled:
//     * Determine current local hour.
//     * Pick window: morning (within 60 min after practice_start_hour),
//       evening (within 60 min before practice_end_hour),
//       or off-window (skip).
//     * Pull top-3 overdue beats from v_next_due (INTERLEAVED across speeches).
//     * Build one notification summarising the 5-min mix or evening recall.
//
// Idempotency: writes a row to mastery_events with event_type='practice' is NOT
// done here — this only sends a push. Actual events come from the app.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Window = "morning" | "evening" | null;

interface DueBeat {
  speech_id: string;
  speech_title: string;
  beat_id: string;
  beat_order: number;
  due_at: string;
  priority_score: number;
  goal_date: string | null;
}

// Localized notification strings
const STRINGS: Record<string, Record<string, Record<string, string>>> = {
  en: {
    morning_single: {
      title: "☀️ 5-min morning mix",
      body: '{count} beats are due across "{titles}". Quick warm-up now consolidates last night\'s sleep.',
    },
    morning_urgent: {
      title: "🔥 {days} days until presentation",
      body: '"{title}" needs a focused morning run. Tap to start.',
    },
    evening_recall: {
      title: "🌙 Evening recall (2 min)",
      body: 'Lock in "{title}" before sleep — your brain will consolidate it overnight.',
    },
  },
  sv: {
    morning_single: {
      title: "☀️ 5-min morgonmix",
      body: '{count} avsnitt är förfallna i "{titles}". En snabb uppvärmning nu låser fast nattens inlärning.',
    },
    morning_urgent: {
      title: "🔥 {days} dagar kvar till talet",
      body: '"{title}" behöver en fokuserad genomgång. Tryck för att börja.',
    },
    evening_recall: {
      title: "🌙 Kvällsrepetition (2 min)",
      body: 'Cementera "{title}" innan du sover — hjärnan konsoliderar under natten.',
    },
  },
  de: {
    morning_single: {
      title: "☀️ 5-Min-Morgenmix",
      body: '{count} Abschnitte aus "{titles}" sind fällig. Kurzes Aufwärmen festigt den Schlaf.',
    },
    morning_urgent: {
      title: "🔥 {days} Tage bis zur Präsentation",
      body: '"{title}" braucht jetzt einen fokussierten Durchlauf.',
    },
    evening_recall: {
      title: "🌙 Abendrepetition (2 Min)",
      body: '"{title}" vor dem Schlafen festigen — das Gehirn konsolidiert über Nacht.',
    },
  },
  fr: {
    morning_single: {
      title: "☀️ Mix matinal (5 min)",
      body: '{count} segments dus dans "{titles}". Un échauffement consolide la nuit.',
    },
    morning_urgent: {
      title: "🔥 J-{days} avant la présentation",
      body: '"{title}" requiert une session matinale concentrée.',
    },
    evening_recall: {
      title: "🌙 Rappel du soir (2 min)",
      body: 'Ancrez "{title}" avant le sommeil — votre cerveau consolide la nuit.',
    },
  },
  es: {
    morning_single: {
      title: "☀️ Mezcla matinal (5 min)",
      body: '{count} segmentos pendientes en "{titles}". El calentamiento consolida el sueño.',
    },
    morning_urgent: {
      title: "🔥 Faltan {days} días",
      body: '"{title}" necesita una práctica matinal enfocada.',
    },
    evening_recall: {
      title: "🌙 Repaso nocturno (2 min)",
      body: 'Fija "{title}" antes de dormir — el cerebro consolida durante la noche.',
    },
  },
  it: {
    morning_single: {
      title: "☀️ Mix mattutino (5 min)",
      body: '{count} segmenti scaduti in "{titles}". Il riscaldamento consolida il sonno.',
    },
    morning_urgent: {
      title: "🔥 {days} giorni alla presentazione",
      body: '"{title}" richiede una sessione mattutina concentrata.',
    },
    evening_recall: {
      title: "🌙 Ripasso serale (2 min)",
      body: 'Fissa "{title}" prima di dormire — il cervello consolida di notte.',
    },
  },
  pt: {
    morning_single: {
      title: "☀️ Mistura matinal (5 min)",
      body: '{count} trechos pendentes em "{titles}". Aquecimento consolida o sono.',
    },
    morning_urgent: {
      title: "🔥 Faltam {days} dias",
      body: '"{title}" precisa de uma prática matinal focada.',
    },
    evening_recall: {
      title: "🌙 Revisão noturna (2 min)",
      body: 'Fixe "{title}" antes de dormir — o cérebro consolida à noite.',
    },
  },
};

function t(lang: string, key: string, vars: Record<string, string | number>): string {
  const localeKey = (lang || "en").split("-")[0];
  const dict = STRINGS[localeKey] ?? STRINGS.en;
  const [section, field] = key.split(".");
  let str = (dict[section]?.[field]) ?? STRINGS.en[section][field];
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return str;
}

async function sendFCM(token: string, title: string, body: string, data: any) {
  const key = Deno.env.get("FCM_SERVER_KEY");
  if (!key) return { success: false, error: "FCM not configured" };
  try {
    const r = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${key}`,
      },
      body: JSON.stringify({
        to: token,
        notification: { title, body, sound: "default", badge: 1 },
        data,
        priority: "high",
      }),
    });
    return { success: r.ok };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "err" };
  }
}

function getLocalHour(timezone: string): number {
  try {
    const h = new Date().toLocaleString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    return parseInt(h, 10);
  } catch {
    return new Date().getUTCHours();
  }
}

function determineWindow(localHour: number, startH: number, endH: number): Window {
  if (localHour >= startH && localHour < startH + 2) return "morning";
  if (localHour >= endH - 1 && localHour < endH) return "evening";
  return null;
}

function daysUntil(goalDate: string | null): number {
  if (!goalDate) return 999;
  return Math.max(
    0,
    Math.ceil(
      (new Date(`${goalDate}T00:00:00Z`).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    ),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const schedulerSecret = Deno.env.get("SCHEDULER_SECRET");
    if (!schedulerSecret) {
      return new Response(JSON.stringify({ error: "Server misconfig" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (req.headers.get("x-scheduler-secret") !== schedulerSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Get all eligible users
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select(
        "id, push_token, push_platform, practice_start_hour, practice_end_hour, timezone, feedback_language",
      )
      .eq("notifications_enabled", true)
      .not("push_token", "is", null);

    if (profErr) throw profErr;
    if (!profiles?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const p of profiles) {
      const startH = p.practice_start_hour ?? 8;
      const endH = p.practice_end_hour ?? 22;
      const tz = p.timezone || "UTC";
      const localHour = getLocalHour(tz);
      const win = determineWindow(localHour, startH, endH);

      if (!win) continue;

      // 2. Get top-3 due beats for this user (interleaved across speeches)
      const { data: due, error: dueErr } = await supabase.rpc(
        "get_top_due_beats",
        { p_user_id: p.id, p_limit: 3 },
      );

      if (dueErr || !due?.length) continue;

      const beats = due as DueBeat[];
      const lang = p.feedback_language || "en";

      // 3. Pick notification shape
      let title: string;
      let body: string;
      const top = beats[0];
      const dDays = daysUntil(top.goal_date);

      if (win === "morning" && dDays <= 3) {
        title = t(lang, "morning_urgent.title", { days: dDays });
        body = t(lang, "morning_urgent.body", { title: top.speech_title });
      } else if (win === "morning") {
        const uniqueTitles = [
          ...new Set(beats.map((b) => b.speech_title)),
        ].slice(0, 2).join(", ");
        title = t(lang, "morning_single.title", {});
        body = t(lang, "morning_single.body", {
          count: beats.length,
          titles: uniqueTitles,
        });
      } else {
        // evening
        title = t(lang, "evening_recall.title", {});
        body = t(lang, "evening_recall.body", { title: top.speech_title });
      }

      const result = await sendFCM(p.push_token!, title, body, {
        type: "adaptive_mix",
        window: win,
        beat_ids: beats.map((b) => b.beat_id).join(","),
        speech_id: top.speech_id,
      });

      results.push({ user_id: p.id, window: win, success: result.success });
    }

    return new Response(
      JSON.stringify({
        sent: results.filter((r) => r.success).length,
        skipped: profiles.length - results.length,
        total_eligible: profiles.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-adaptive-notifications error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "err" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
