import { Slider } from "@/components/ui/slider";
import { Pause } from "lucide-react";
import {
  extractPauses,
  setPauseDurationInText,
  PAUSE_MAX_SECONDS,
  PAUSE_MIN_SECONDS,
} from "@/utils/pauses";

interface PauseSlidersListProps {
  text: string;
  onChange: (next: string) => void;
}

/**
 * Compact list of pause-marker chips with sliders. Surfaces every `-`
 * (or `-3s`) token in the script so writers can tune how long each
 * planned pause should last. Editing a slider rewrites the corresponding
 * token in the source text.
 */
export const PauseSlidersList = ({ text, onChange }: PauseSlidersListProps) => {
  const pauses = extractPauses(text);
  if (pauses.length === 0) {
    return (
      <p className="text-xs text-muted-foreground leading-relaxed">
        Tip: write a standalone <code className="px-1 rounded bg-muted">-</code>{" "}
        anywhere in the script to insert a pause. A control will appear here
        to set its duration in seconds.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Pauses ({pauses.length})
      </div>
      <div className="space-y-2">
        {pauses.map((p) => {
          const seconds = Math.max(
            PAUSE_MIN_SECONDS,
            Math.min(PAUSE_MAX_SECONDS, Math.round(p.durationMs / 1000)),
          );
          return (
            <div
              key={p.pauseIndex}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-[110px]">
                <Pause
                  className="h-4 w-4 text-primary shrink-0"
                  fill="currentColor"
                />
                <span className="text-sm font-medium">
                  Pause {p.pauseIndex + 1}
                </span>
              </div>
              <Slider
                value={[seconds]}
                min={PAUSE_MIN_SECONDS}
                max={PAUSE_MAX_SECONDS}
                step={1}
                onValueChange={(v) =>
                  onChange(setPauseDurationInText(text, p.pauseIndex, v[0] ?? seconds))
                }
                className="flex-1"
              />
              <span className="text-sm font-semibold tabular-nums w-10 text-right">
                {seconds}s
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
