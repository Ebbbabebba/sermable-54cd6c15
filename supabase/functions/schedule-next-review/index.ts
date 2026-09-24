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

function ratingFromAccuracy(
  rawAcc: number,
  _hesitations: number,
  visibilityPercent: number = 100,
): Rating {
  // rawAcc already reflects hesitations via the client's failRatio.
  // Easy is reserved for runs that were both highly accurate AND mostly
  // from memory (script <30% visible) — otherwise FSRS would expand intervals
  // for users still reading the script.
  if (rawAcc < 50) return 1;                            // Again
  if (rawAcc < 70) return 2;                            // Hard
  if (rawAcc < 95 || visibilityPercent > 30) return 3;  // Good
  return 4;                                              // Easy
}

// The user's own judgment-of-learning right after the attempt predicts
// forgetting better than word accuracy alone. 1 = struggled, 2 = ok, 3 = solid.
// It can pull the rating one notch in either direction but never overrides a
// genuine failure (Again stays Again).
function applySelfRating(rating: Rating, selfRating?: number): Rating {
  if (rating === 1) return 1;
  if (selfRating === 1) return Math.max(2, rating - 1) as Rating;
  if (selfRating === 3) return Math.min(4, rating + 1) as Rating;
  return rating;
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

// Hour-resolution interval. Rounding to whole days made the ladder jumpy
// (especially combined with the visibility shrink), so we keep fractional days
// and convert to minutes, rounded to the nearest hour.
function intervalMinutesFromStability(stability: number): number {
  const days = (stability / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1);
  const minutes = days * 24 * 60;
  // Never below 4h at this stage; the caller applies further modifiers.
  return Math.max(4 * 60, Math.round(minutes / 60) * 60);
}

function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

// ---------- Fixed expanding ladder ----------
// 10 min → 1 → 3 → 7 → 14 → 30 days. Each success climbs one step, a failure
// drops to the bottom. This keeps the schedule predictable and deadline-safe.
const LADDER_MINUTES = [
  10,
  1 * 24 * 60,
  3 * 24 * 60,
  7 * 24 * 60,
  14 * 24 * 60,
  30 * 24 * 60,
];

// Which rung the beat is currently standing on, inferred from the interval it
// was last given (tolerant: picks the closest rung at or below it).
function currentRung(prevIntervalMinutes: number): number {
  if (!prevIntervalMinutes || prevIntervalMinutes <= 0) return -1;
  let rung = 0;
  for (let i = 0; i < LADDER_MINUTES.length; i++) {
    if (prevIntervalMinutes >= LADDER_MINUTES[i] * 0.8) rung = i;
  }
  return rung;
}

// Compressed ladder for very short deadlines (≤2 days): 10 min → 1h → 3h → 8h.
const SHORT_LADDER_MINUTES = [10, 60, 180, 480];

// Calendar-day difference in the user's timezone (goal date is a local date).
function daysUntilGoal(goalDate: string | null, tz: string | null): number | null {
  if (!goalDate) return null;
  let todayStr: string;
  try {
    todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "Europe/Stockholm",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch {
    todayStr = new Date().toISOString().slice(0, 10);
  }
  const a = Date.UTC(+todayStr.slice(0, 4), +todayStr.slice(5, 7) - 1, +todayStr.slice(8, 10));
  const b = Date.UTC(+goalDate.slice(0, 4), +goalDate.slice(5, 7) - 1, +goalDate.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

// ---------- Deadline-aware interval capping ----------
function capIntervalByDeadline(intervalMinutes: number, daysUntil: number | null): number {
  if (daysUntil === null) return intervalMinutes;
  let maxMinutes: number;
  if (daysUntil <= 1) maxMinutes = 4 * 60;
  else if (daysUntil <= 3) maxMinutes = 12 * 60;
  else if (daysUntil <= 7) maxMinutes = 24 * 60;
  else if (daysUntil <= 14) maxMinutes = 3 * 24 * 60;
  else if (daysUntil <= 30) maxMinutes = 7 * 24 * 60;
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
      selfRating = null,
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
        "id, speech_id, ladder_rung, fsrs_stability, fsrs_difficulty, fsrs_reps, fsrs_lapses, fsrs_last_review, next_scheduled_recall_at, speeches!inner(goal_date, user_id)",
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

    const rating = applySelfRating(
      ratingFromAccuracy(rawAccuracy, hesitations, visibilityPercent),
      typeof selfRating === "number" ? selfRating : undefined,
    );
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

    // ---- Compute next interval (fixed ladder, FSRS decides direction) ----
    // The rung is stored explicitly so deadline-capped intervals don't reset
    // progress. Legacy beats fall back to inferring from the last interval.
    const { data: prof } = await supabase
      .from("profiles").select("timezone").eq("id", user.id).maybeSingle();
    const daysUntil = daysUntilGoal(speech.goal_date, (prof as any)?.timezone ?? null);

    let rung: number;
    const stored = (beat as any).ladder_rung;
    if (typeof stored === "number" && stored >= 0) {
      rung = stored;
    } else {
      const prevIntervalMin =
        beat.fsrs_last_review && beat.next_scheduled_recall_at
          ? (new Date(beat.next_scheduled_recall_at).getTime() -
              new Date(beat.fsrs_last_review).getTime()) / 60000
          : 0;
      rung = currentRung(prevIntervalMin);
    }

    if (rating === 1) rung = 0;
    else if (rating === 2) rung = Math.max(0, rung);
    else if (rating === 3) rung = rung + 1;
    else rung = rung + 2;

    if (visibilityPercent > 30) rung = Math.min(rung, 1);
    rung = Math.min(rung, LADDER_MINUTES.length - 1);

    let nextIntervalMin: number;
    const shortDeadline = daysUntil !== null && daysUntil >= 0 && daysUntil <= 2;
    if (shortDeadline) {
      nextIntervalMin = SHORT_LADDER_MINUTES[Math.min(rung, SHORT_LADDER_MINUTES.length - 1)];
    } else {
      nextIntervalMin = capIntervalByDeadline(LADDER_MINUTES[rung], daysUntil);
    }
    nextIntervalMin = Math.max(10, nextIntervalMin);

    // Deadline already passed: stop scheduling (user can still practice freely).
    const deadlinePassed = daysUntil !== null && daysUntil < 0;
    const nextDueAt = deadlinePassed
      ? null
      : new Date(Date.now() + nextIntervalMin * 60 * 1000);

    // ---- Write back to practice_beats (single source of truth) ----
    const { error: updErr } = await supabase
      .from("practice_beats")
      .update({
        fsrs_stability: s,
        fsrs_difficulty: d,
        fsrs_reps: reps,
        fsrs_lapses: newLapses,
        ladder_rung: rung,
        fsrs_last_review: new Date().toISOString(),
        next_scheduled_recall_at: nextDueAt ? nextDueAt.toISOString() : null,
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
        nextDueAt: nextDueAt ? nextDueAt.toISOString() : null,
        intervalMinutes: nextDueAt ? nextIntervalMin : 0,
        rung,
        deadlinePassed,
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
