import { supabase } from "@/integrations/supabase/client";

export interface ScheduleNextReviewInput {
  beatId: string;
  eventType?: "practice" | "recall" | "test" | "presentation" | "blank_run";
  rawAccuracy: number; // 0..100
  visibilityPercent: number; // 0..100 — how much of script was visible
  hesitations?: number;
  lapses?: number;
  missedWordCount?: number;
  durationSeconds?: number;
}

/**
 * Fire-and-forget call to the FSRS scheduler edge function.
 * Updates practice_beats.fsrs_* + next_scheduled_recall_at and appends a mastery_events row.
 * Errors are logged but never thrown — practice flow must not break if scheduling fails.
 */
export function scheduleNextReview(input: ScheduleNextReviewInput): void {
  supabase.functions
    .invoke("schedule-next-review", { body: input })
    .then(({ data, error }) => {
      if (error) {
        console.warn("[FSRS] schedule-next-review failed:", error);
      } else if (data) {
        console.log(
          `[FSRS] beat ${input.beatId.slice(0, 8)} → next in ${
            Math.round((data.intervalMinutes ?? 0) / 60)
          }h (rating ${data.rating}, s=${data.stability?.toFixed?.(2)}, d=${data.difficulty?.toFixed?.(2)})`,
        );
      }
    })
    .catch((err) => {
      console.warn("[FSRS] schedule-next-review threw:", err);
    });
}
