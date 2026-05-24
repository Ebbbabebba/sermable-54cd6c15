// Sends an instant push the moment a beat's FSRS rest interval expires.
// Runs every minute via pg_cron. Idempotent: each beat is pinged at most once
// per `next_scheduled_recall_at` cycle via `last_due_notification_at`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-scheduler-secret",
};

const STRINGS: Record<string, { title: string; body: string }> = {
  en: { title: "⏰ Time to rehearse", body: 'Rest interval is over for "{title}". Tap to practice now.' },
  sv: { title: "⏰ Dags att repetera", body: 'Vilointervallet är slut för "{title}". Tryck för att öva nu.' },
  de: { title: "⏰ Zeit zu üben", body: 'Die Pause ist vorbei für "{title}". Jetzt antippen.' },
  fr: { title: "⏰ À répéter", body: 'L\'intervalle de repos est terminé pour "{title}". Appuyez pour pratiquer.' },
  es: { title: "⏰ Hora de practicar", body: 'El intervalo de descanso terminó para "{title}". Toca para practicar.' },
  it: { title: "⏰ È ora di esercitarsi", body: 'L\'intervallo di riposo è finito per "{title}". Tocca per esercitarti.' },
  pt: { title: "⏰ Hora de praticar", body: 'O intervalo de descanso acabou para "{title}". Toque para praticar.' },
};

function tr(lang: string, title: string) {
  const k = (lang || "en").split("-")[0];
  const s = STRINGS[k] ?? STRINGS.en;
  return { title: s.title, body: s.body.replace("{title}", title) };
}

function getLocalHour(tz: string) {
  try {
    return parseInt(
      new Date().toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }),
      10,
    );
  } catch {
    return new Date().getUTCHours();
  }
}

async function sendFCM(token: string, title: string, body: string, data: Record<string, string>) {
  const key = Deno.env.get("FCM_SERVER_KEY");
  if (!key) return { ok: false, error: "FCM not configured" };
  try {
    const r = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `key=${key}` },
      body: JSON.stringify({
        to: token,
        notification: { title, body, sound: "default", badge: 1 },
        data,
        priority: "high",
      }),
    });
    return { ok: r.ok };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "err" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // No external secret needed: function is fully idempotent. Each beat is
    // notified at most once per `next_scheduled_recall_at` cycle via
    // `last_due_notification_at`, and only beats whose due time fell within
    // the last 20 minutes are considered. Repeated calls are safe no-ops.

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull beats that JUST became due (within last 20 min) and haven't been
    // notified yet for this cycle.
    const nowIso = new Date().toISOString();
    const windowStart = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    const { data: beats, error } = await supabase
      .from("practice_beats")
      .select(
        "id, speech_id, beat_order, next_scheduled_recall_at, last_due_notification_at, speeches!inner(id, title, user_id, profiles:user_id(id, push_token, notifications_enabled, instant_due_notifications, practice_start_hour, practice_end_hour, timezone, feedback_language))",
      )
      .lte("next_scheduled_recall_at", nowIso)
      .gte("next_scheduled_recall_at", windowStart)
      .not("next_scheduled_recall_at", "is", null);

    if (error) throw error;
    if (!beats?.length) {
      return new Response(JSON.stringify({ sent: 0, candidates: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let skipped = 0;

    for (const b of beats as any[]) {
      const speech = b.speeches;
      const profile = speech?.profiles;
      if (!profile?.push_token) { skipped++; continue; }
      if (profile.notifications_enabled === false) { skipped++; continue; }
      if (profile.instant_due_notifications === false) { skipped++; continue; }

      // Idempotency: skip if already notified for this due cycle
      if (
        b.last_due_notification_at &&
        new Date(b.last_due_notification_at) >= new Date(b.next_scheduled_recall_at)
      ) {
        skipped++; continue;
      }

      // Respect awake window
      const tz = profile.timezone || "UTC";
      const h = getLocalHour(tz);
      const startH = profile.practice_start_hour ?? 8;
      const endH = profile.practice_end_hour ?? 22;
      if (h < startH || h >= endH) { skipped++; continue; }

      const { title, body } = tr(profile.feedback_language || "en", speech.title);
      const r = await sendFCM(profile.push_token, title, body, {
        type: "due_now",
        speech_id: speech.id,
        beat_id: b.id,
      });

      if (r.ok) {
        sent++;
        await supabase
          .from("practice_beats")
          .update({ last_due_notification_at: nowIso })
          .eq("id", b.id);
      } else {
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({ sent, skipped, candidates: beats.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-due-now-notifications error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "err" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
