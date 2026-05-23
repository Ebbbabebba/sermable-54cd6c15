// Unified scheduling endpoint — Fas 1 + Fas 2 of the memorization rebuild.
//
// Replaces SM-2 with FSRS-4.5 and writes a single source of truth:
//   - practice_beats.next_scheduled_recall_at  (when to practice next)
//   - practice_beats.fsrs_*                    (algorithm state)
//   - mastery_events                           (append-only log)
//
// Input:
//   {
//     beatId: string,
//     eventType: 'practice' | 'recall' | 'test' | 'presentation' | 'blank_run',
//     rawAccuracy: number,        // 0..100
//     visibilityPercent: number,  // 0..100 (how much script was visible)
//     hesitations?: number,
//     lapses?: number,
//     missedWordCount?: number,
//     durationSeconds?: number
//   }
//
// Output: { nextDueAt, intervalMinutes, stability, difficulty, rating }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------- FSRS-4.5 (simplified, single-user weights) ----------
// Default weights from FSRS-4.5 reference implementation.
const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234,
  1.616, 0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466,
  0.5034, 0.6567,
];
const REQUEST_RETENTION = 0.9;
const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;

type Rating = 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy

function ratingFromAccuracy(rawAcc: number, hesitations: number): Rating {
  if (rawAcc < 50) return 1;            // Again
  if (rawAcc < 70 || hesitations > 4) return 2; // Hard
  if (rawAcc < 90) return 3;            // Good
  return 4;                              // Easy
}

function initialStability(rating: Rating): number {
  return Math.max(W[rating - 1], 0.1);
}

function initialDifficulty(rating: Rating): number {
  const d = W[4] - Math.exp(W[5] * (rating - 1)) + 1;
  return Math.min(Math.max(d, 1), 10);
}

function nextDifficulty(d: number, rating: Rating): number {
  const next = d - W[6] * (rating - 3);
  const mean = W[4] - Math.exp(W[5] * 2) + 1;
  const out = W[7] * mean + (1 - W[7]) * next;
  return Math.min(Math.max(out, 1), 10);
}

function nextStability(
  d: number,
  s: number,
  retrievability: number,
  rating: Rating,
): number {
  if (rating === 1) {
    // Lapse
    return Math.max(
      W[11] *
        Math.pow(d, -W[12]) *
        (Math.pow(s + 1, W[13]) - 1) *
        Math.exp(W[14] * (1 - retrievability)),
      0.1,
    );
  }
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;
  return (
    s *
    (1 +
      Math.exp(W[8]) *
        (11 - d) *
        Math.pow(s, -W[9]) *
        (Math.exp(W[10] * (1 - retrievability)) - 1) *
        hardPenalty *
        easyBonus)
  );
}

function intervalDays(stability: number): number {
  return Math.max(1, Math.round((stability / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1)));
}

function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

// ---------- Deadline-aware interval capping ----------
function capIntervalByDeadline(intervalMinutes: number, goalDate: string | null): number {
  if (!goalDate) return intervalMinutes;
  const daysUntil = Math.max(
    0,
    Math.round(
      (new Date(`${goalDate}T00:00:00Z`).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  let maxMinutes: number;
  if (daysUntil <= 2) maxMinutes = 4 * 60;
  else if (daysUntil <= 7) maxMinutes = 12 * 60;
  else if (daysUntil <= 14) maxMinutes = 2 * 24 * 60;
  else if (daysUntil <= 30) maxMinutes = 4 * 24 * 60;
  else maxMinutes = 14 * 24 * 60;
  return Math.min(intervalMinutes, maxMinutes);
}

// ---------- Visibility modifier: high visibility → shorter interval ----------
// Forces user to come back sooner if they still relied heavily on script.
function visibilityFactor(visibilityPercent: number): number {
  // 0% visible → 1.0 (full interval), 100% visible → 0.4 (much shorter)
  return 1 - (visibilityPercent / 100) * 0.6;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      },
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      beatId,
      eventType = "practice",
      rawAccuracy = 0,
      visibilityPercent = 100,
      hesitations = 0,
      lapses = 0,
      missedWordCount = 0,
      durationSeconds = null,
    } = body ?? {};

    if (!beatId || typeof beatId !== "string") {
      return new Response(JSON.stringify({ error: "beatId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load beat + speech (RLS enforces ownership)
    const { data: beat, error: beatErr } = await supabase
      .from("practice_beats")
      .select(
        "id, speech_id, fsrs_stability, fsrs_difficulty, fsrs_reps, fsrs_lapses, fsrs_last_review, next_scheduled_recall_at, speeches!inner(goal_date, user_id)",
      )
      .eq("id", beatId)
      .single();

    if (beatErr || !beat) {
      return new Response(JSON.stringify({ error: "Beat not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const speech = (beat as any).speeches;
    if (speech.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rating = ratingFromAccuracy(rawAccuracy, hesitations);
    const reps = (beat.fsrs_reps ?? 0) + 1;
    const wasOverdue = beat.next_scheduled_recall_at
      ? new Date(beat.next_scheduled_recall_at).getTime() < Date.now()
      : false;

    // ---- Compute FSRS state ----
    let s: number;
    let d: number;
    let newLapses = beat.fsrs_lapses ?? 0;

    if (reps === 1 || !beat.fsrs_last_review) {
      s = initialStability(rating);
      d = initialDifficulty(rating);
    } else {
      const elapsedDays = Math.max(
        0,
        (Date.now() - new Date(beat.fsrs_last_review).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const r = retrievability(elapsedDays, beat.fsrs_stability ?? 1);
      d = nextDifficulty(beat.fsrs_difficulty ?? 5, rating);
      s = nextStability(d, beat.fsrs_stability ?? 1, r, rating);
      if (rating === 1) newLapses += 1;
    }

    // ---- Compute next interval ----
    const baseDays = intervalDays(s);
    let nextIntervalMin = baseDays * 24 * 60;

    // Apply visibility modifier (more reliance on script → shorter interval)
    nextIntervalMin = Math.round(
      nextIntervalMin * visibilityFactor(visibilityPercent),
    );

    // Apply deadline cap
    nextIntervalMin = capIntervalByDeadline(nextIntervalMin, speech.goal_date);

    // Floor: never less than 10 min, even for catastrophic fails
    nextIntervalMin = Math.max(10, nextIntervalMin);

    const nextDueAt = new Date(Date.now() + nextIntervalMin * 60 * 1000);

    // ---- Write back to practice_beats (single source of truth) ----
    const { error: updErr } = await supabase
      .from("practice_beats")
      .update({
        fsrs_stability: s,
        fsrs_difficulty: d,
        fsrs_reps: reps,
        fsrs_lapses: newLapses,
        fsrs_last_review: new Date().toISOString(),
        next_scheduled_recall_at: nextDueAt.toISOString(),
        last_recall_at: new Date().toISOString(),
      })
      .eq("id", beatId);

    if (updErr) {
      console.error("Update beat failed:", updErr);
      throw updErr;
    }

    // ---- Append to mastery_events log ----
    const { error: evErr } = await supabase.from("mastery_events").insert({
      user_id: user.id,
      speech_id: beat.speech_id,
      beat_id: beatId,
      event_type: eventType,
      raw_accuracy: rawAccuracy,
      visibility_percent: visibilityPercent,
      hesitations,
      lapses: rating === 1 ? 1 : 0,
      missed_word_count: missedWordCount,
      duration_seconds: durationSeconds,
      was_overdue: wasOverdue,
    });

    if (evErr) console.error("Event insert failed:", evErr);

    return new Response(
      JSON.stringify({
        success: true,
        nextDueAt: nextDueAt.toISOString(),
        intervalMinutes: nextIntervalMin,
        stability: s,
        difficulty: d,
        reps,
        lapses: newLapses,
        rating,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("schedule-next-review error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
