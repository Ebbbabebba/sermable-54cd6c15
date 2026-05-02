// Generates the calendar of practice / recall / test / presentation events
// for a single speech, based on its goal_date and today's date.
//
// Idempotent: deletes future, not-yet-completed events for the speech and
// re-inserts a fresh schedule. Past + completed events are preserved.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type EventType = "practice" | "recall" | "test" | "presentation";

interface PlannedEvent {
  date: string; // YYYY-MM-DD
  type: EventType;
}

const toISODate = (d: Date): string => d.toISOString().split("T")[0];

const addDays = (d: Date, days: number): Date => {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

/**
 * Build the schedule from `today` (inclusive) up to and including `goalDate`.
 *
 * Rules:
 *   30+ days  → 1 practice every 2-3 days
 *   15-30     → practice every other day, recall mid-week
 *   8-14      → daily practice + 2 recalls per week
 *   4-7       → daily practice + daily recall
 *   1-3       → daily test (full run)
 *   0         → presentation
 */
function buildSchedule(today: Date, goalDate: Date): PlannedEvent[] {
  const events: PlannedEvent[] = [];

  const totalDays = Math.max(
    0,
    Math.round((goalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );

  for (let offset = 0; offset <= totalDays; offset++) {
    const date = addDays(today, offset);
    const daysUntilDeadline = totalDays - offset;
    const iso = toISODate(date);

    if (daysUntilDeadline === 0) {
      events.push({ date: iso, type: "presentation" });
      continue;
    }

    if (daysUntilDeadline <= 3) {
      // Final stretch: full run-through every day
      events.push({ date: iso, type: "test" });
      continue;
    }

    if (daysUntilDeadline <= 7) {
      // 4-7 days out: practice + recall daily
      events.push({ date: iso, type: "practice" });
      events.push({ date: iso, type: "recall" });
      continue;
    }

    if (daysUntilDeadline <= 14) {
      // 8-14 days out: daily practice, recall every 3rd day
      events.push({ date: iso, type: "practice" });
      if (offset % 3 === 0) {
        events.push({ date: iso, type: "recall" });
      }
      continue;
    }

    if (daysUntilDeadline <= 30) {
      // 15-30 days out: practice every other day, recall once a week
      if (offset % 2 === 0) events.push({ date: iso, type: "practice" });
      if (offset % 7 === 0 && offset !== 0) {
        events.push({ date: iso, type: "recall" });
      }
      continue;
    }

    // 30+ days out: practice every 3rd day to avoid burnout
    if (offset % 3 === 0) {
      events.push({ date: iso, type: "practice" });
    }
  }

  return events;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const speechId = typeof body?.speechId === "string" ? body.speechId : null;
    if (!speechId) {
      return new Response(
        JSON.stringify({ error: "speechId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify ownership + load goal_date
    const { data: speech, error: speechError } = await supabase
      .from("speeches")
      .select("id, user_id, goal_date, title")
      .eq("id", speechId)
      .single();

    if (speechError || !speech || speech.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized access to speech" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!speech.goal_date) {
      return new Response(
        JSON.stringify({
          error: "Speech has no goal_date — cannot generate schedule",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Today in UTC for date math (we only care about the calendar date)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const goalDate = new Date(`${speech.goal_date}T00:00:00Z`);

    // Don't bother generating events if goal is in the past
    if (goalDate.getTime() < today.getTime()) {
      return new Response(
        JSON.stringify({
          success: true,
          generated: 0,
          message: "Goal date is in the past, no events generated",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const planned = buildSchedule(today, goalDate);

    // Wipe future, not-completed events (keep history)
    const todayISO = toISODate(today);
    const { error: deleteError } = await supabase
      .from("speech_calendar_events")
      .delete()
      .eq("speech_id", speechId)
      .eq("user_id", user.id)
      .eq("completed", false)
      .gte("event_date", todayISO);

    if (deleteError) {
      console.error("Error clearing future events:", deleteError);
      throw deleteError;
    }

    // Insert the new schedule
    const rows = planned.map((p) => ({
      speech_id: speechId,
      user_id: user.id,
      event_date: p.date,
      event_type: p.type,
      completed: false,
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("speech_calendar_events")
        .insert(rows);

      if (insertError) {
        console.error("Error inserting events:", insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated: rows.length,
        speechId,
        title: speech.title,
        from: todayISO,
        to: speech.goal_date,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in generate-speech-schedule:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
