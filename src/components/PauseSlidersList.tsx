import { Slider } from "@/components/ui/slider";
import { Pause } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const pauses = extractPauses(text);

  if (pauses.length === 0) {
    return (
      <div className="s-qo s-6l s-74 s-71 s-53 s-or s-p3 s-vj s-ul s-ip">
        {t("pauses.tipPrefix", "Tip: type a standalone")}{" "}
        <code className="s-ol s-q8 s-50">-</code>{" "}
        {t(
          "pauses.tipSuffix",
          "anywhere in the script to insert a pause. A 1-10s slider appears here for each one.",
        )}
      </div>
    );
  }

  // Build clean (pause-stripped) word list for showing context around each pause.
  const cleanWords = text
    .split(/\s+/)
    .filter((tok) => tok.length > 0 && !/^-(\d{1,2})?s?$/.test(tok));

  return (
    <div className="s-sy">
      <div className="s-vj s-d0 s-ul s-x1 s-wi">
        {t("pauses.title", "Pauses")} ({pauses.length})
      </div>
      <div className="s-sy">
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
              className="s-qo s-6l s-70 s-54 s-or s-p3"
            >
              <div className="s-c5 s-ib s-dn s-vj s-ul s-jy s-iq">
                {before && <span className="truncate s-jj">…{before}</span>}
                <span className="s-i4 s-ib s-dl s-qe s-5f s-uw s-op s-ox s-d3 s-pl s-pz">
                  <Pause className="s-fw s-xp" fill="currentColor" />
                  {seconds}s
                </span>
                {after && <span className="truncate s-jj">{after}…</span>}
              </div>
              <div className="s-c5 s-ib s-dp">
                <span className="s-tl s-ul s-xp">0</span>
                <Slider
                  value={[seconds]}
                  min={PAUSE_MIN_SECONDS}
                  max={PAUSE_MAX_SECONDS}
                  step={1}
                  onValueChange={(v) =>
                    onChange(setPauseDurationInText(text, p.pauseIndex, v[0] ?? seconds))
                  }
                  className="s-c6"
                />
                <span className="s-tl s-ul s-xt s-v4">10</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
