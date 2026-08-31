import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Sparkle, Hand } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  tokenizeWords,
  extractPropCues,
  buildPropCueIndex,
  applyPropCueToIndices,
  removePropCueAt,
} from "@/utils/propCues";

interface PropCueWordPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (next: string) => void;
}

/**
 * Tap-to-tag editor for prop cues — rendered INLINE (no dialog/popup).
 *
 * Expands directly under the textarea as a smooth panel: every word is a
 * tappable chip. Tap words, type the cue, save. Words that already carry a
 * cue show their badge and can be tapped to remove it.
 */
const PropCueWordPicker = ({
  open,
  onOpenChange,
  value,
  onChange,
}: PropCueWordPickerProps) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cue, setCue] = useState("");

  const tokens = useMemo(() => tokenizeWords(value), [value]);
  const cueIndex = useMemo(
    () => buildPropCueIndex(extractPropCues(value).cues),
    [value],
  );

  const toggle = (idx: number) => {
    if (cueIndex.has(idx)) {
      onChange(removePropCueAt(value, idx));
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const save = () => {
    if (!cue.trim() || selected.size === 0) return;
    onChange(applyPropCueToIndices(value, [...selected], cue));
    setSelected(new Set());
    setCue("");
  };

  const close = () => {
    setSelected(new Set());
    setCue("");
    onOpenChange(false);
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="prop-cue-picker"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div
            className="rounded-2xl border p-4 space-y-3"
            style={{
              backgroundColor: "hsl(var(--prop-cue-bg) / 0.35)",
              borderColor: "hsl(var(--prop-cue-fg) / 0.25)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Hand className="h-4 w-4" style={{ color: "hsl(var(--prop-cue-fg))" }} />
                  {t("upload.propCue.pickerTitle", "Tap words to add stage directions")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t(
                    "upload.propCue.pickerDesc",
                    "Tap the words you want, name the cue and save. Tap a highlighted word to remove its cue.",
                  )}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={close}
                aria-label={t("common.done", "Done")}
                className="shrink-0 -mt-1 -mr-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-card/40 p-3 leading-loose">
              {tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("upload.propCue.pickerEmpty", "Add some text first.")}
                </p>
              ) : (
                tokens.map((tk) => {
                  const existing = cueIndex.get(tk.index);
                  const isSelected = selected.has(tk.index);
                  return (
                    <button
                      key={tk.index}
                      type="button"
                      onClick={() => toggle(tk.index)}
                      className={cn(
                        "relative inline-block mr-1 mb-2 px-1.5 py-0.5 rounded-md text-sm transition-colors",
                        !existing && !isSelected && "hover:bg-muted",
                        isSelected && "bg-primary text-primary-foreground",
                      )}
                      style={
                        existing && !isSelected
                          ? {
                              backgroundColor: "hsl(var(--prop-cue-bg-strong))",
                              color: "hsl(var(--prop-cue-fg))",
                            }
                          : undefined
                      }
                    >
                      {existing && existing.startWordIndex === tk.index && (
                        <span
                          className="absolute -top-3 left-0 px-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                          style={{
                            backgroundColor: "hsl(var(--prop-cue-fg))",
                            color: "hsl(var(--background))",
                          }}
                        >
                          {existing.cue}
                        </span>
                      )}
                      {tk.text}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={cue}
                onChange={(e) => setCue(e.target.value)}
                maxLength={32}
                placeholder={t(
                  "upload.propCue.placeholder",
                  "e.g. smile, laugh, raise hand…",
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    save();
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={save}
                disabled={!cue.trim() || selected.size === 0}
                className="gap-1.5"
              >
                <Sparkle className="h-4 w-4" />
                {t("upload.propCue.pickerSave", "Add cue")}
              </Button>
            </div>

            {selected.size > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground px-1">
                  {t("upload.propCue.pickerSelected", "{{count}} words selected", {
                    count: selected.size,
                  })}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  <X className="h-4 w-4 mr-1" />
                  {t("common.cancel")}
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PropCueWordPicker;
