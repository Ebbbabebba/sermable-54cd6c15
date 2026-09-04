import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Sparkle, Hand } from "lucide-react";
import { cn } from "@/lib/utils";
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
 * Tap-to-tag editor for prop cues — full-screen dialog.
 *
 * Every word is a tappable chip. Tap words, type the cue, save. Words that
 * already carry a cue show their badge and can be tapped to remove it.
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
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-none w-screen h-[100dvh] sm:w-[92vw] sm:h-[92vh] sm:max-w-3xl sm:rounded-3xl rounded-none p-0 gap-0 flex flex-col overflow-hidden">
        <div className="px-5 pt-5 pb-3 pr-14 border-b border-border/60">
          <h2 className="text-base font-semibold flex items-center gap-1.5">
            <Hand className="h-4 w-4" style={{ color: "hsl(var(--prop-cue-fg))" }} />
            {t("upload.propCue.pickerTitle", "Tap words to add stage directions")}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              "upload.propCue.pickerDesc",
              "Tap the words you want, name the cue and save. Tap a highlighted word to remove its cue.",
            )}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("upload.propCue.pickerEmpty", "Add some text first.")}
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-x-1.5 gap-y-2">
              {tokens.map((tk) => {
                const existing = cueIndex.get(tk.index);
                const isSelected = selected.has(tk.index);
                const isCueStart = !!existing && existing.startWordIndex === tk.index;
                return (
                  <button
                    key={tk.index}
                    type="button"
                    onClick={() => toggle(tk.index)}
                    className="flex flex-col items-start max-w-full"
                  >
                    {isCueStart && (
                      <span
                        className="mb-0.5 max-w-[9rem] truncate px-1.5 py-[1px] rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: "hsl(var(--prop-cue-fg))",
                          color: "hsl(var(--background))",
                        }}
                      >
                        {existing.cue}
                      </span>
                    )}
                    <span
                      className={cn(
                        "block px-2 py-1 rounded-lg text-base transition-colors max-w-full break-words text-left",
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
                      {tk.text}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>


        <div className="border-t border-border/60 px-5 py-4 space-y-3 bg-card/60 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
      </DialogContent>
    </Dialog>
  );
};

export default PropCueWordPicker;
