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

const CONTEXT_WORDS = 4;

/**
 * Inline pause editor. For every standalone `-` token in the script,
 * surfaces a 1–10s slider with surrounding word context so the writer
 * can tune the pause directly above where it sits in the text.
 */
export const PauseSlidersList = ({ text, onChange }: PauseSlidersListProps) => {
  const pauses = extractPauses(text);

  if (pauses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
        Tip: type a standalone <code className="px-1 rounded bg-muted">-</code>{" "}
        anywhere in the script to insert a pause. A 1–10s slider will appear
        here for each one.
      </div>
    );
  }

  // Build clean (pause-stripped) word list for showing context around each pause.
  const cleanWords = text
    .split(/\s+/)
    .filter((tok) => tok.length > 0 && !/^-(\d{1,2})?s?$/.test(tok));

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Pauses ({pauses.length})
      </div>
      <div className="space-y-2">
        {pauses.map((p) => {
          const seconds = Math.max(
            PAUSE_MIN_SECONDS,
            Math.min(PAUSE_MAX_SECONDS, Math.round(p.durationMs / 1000)),
          );
          const before = cleanWords
            .slice(Math.max(0, p.afterWordIndex - CONTEXT_WORDS + 1), p.afterWordIndex + 1)
            .join(" ");
          const after = cleanWords
            .slice(p.afterWordIndex + 1, p.afterWordIndex + 1 + CONTEXT_WORDS)
            .join(" ");

          return (
            <div
              key={p.pauseIndex}
              className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 leading-snug">
                {before && <span className="truncate max-w-[40%]">…{before}</span>}
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 font-semibold ring-1 ring-primary/40">
                  <Pause className="h-3 w-3" fill="currentColor" />
                  {seconds}s
                </span>
                {after && <span className="truncate max-w-[40%]">{after}…</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-3">0</span>
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
                <span className="text-[10px] text-muted-foreground w-4 text-right">10</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
