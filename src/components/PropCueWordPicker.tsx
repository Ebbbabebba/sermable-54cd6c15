import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Sparkle, Hand, Check } from "lucide-react";
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
  const [savedInSession, setSavedInSession] = useState(false);

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
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const save = () => {
    if (!cue.trim() || selected.size === 0) return;
    onChange(applyPropCueToIndices(value, [...selected], cue));
    setSelected(new Set());
    setCue("");
    setSavedInSession(true);
  };

  const close = () => {
    setSelected(new Set());
    setCue("");
    setSavedInSession(false);
    onOpenChange(false);
  };

  // The Done step appears once words have been marked — either in this
  // session or from cues already saved on the text.
  const showDone = savedInSession || cueIndex.size > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="s-jr s-ya s-g9 s-sq s-rn s-ry s-sd s-qj s-mr s-dk s-c5 s-c7 s-mn">
        <div className="s-ot s-oe s-n6 s-nz s-6v s-71">
          <h2 className="s-tw s-d3 s-c5 s-ib s-dm">
            <Hand className="s-fz s-xt" style={{ color: "hsl(var(--prop-cue-fg))" }} />
            {t("upload.propCue.pickerTitle", "Tap words to add stage directions")}
          </h2>
          <p className="s-vj s-ul s-lt">
            {t(
              "upload.propCue.pickerDesc",
              "Tap the words you want, name the cue and save. Tap a highlighted word to remove its cue.",
            )}
          </p>
        </div>

        <div className="s-c6 s-mq s-ot s-p9">
          {tokens.length === 0 ? (
            <p className="s-v9 s-ul">
              {t("upload.propCue.pickerEmpty", "Add some text first.")}
            </p>
          ) : (
            <div className="s-c5 s-cb s-ic s-du s-dy">
              {tokens.map((tk) => {
                const existing = cueIndex.get(tk.index);
                const isSelected = selected.has(tk.index);
                const isCueStart = !!existing && existing.startWordIndex === tk.index;
                return (
                  <button
                    key={tk.index}
                    type="button"
                    onClick={() => toggle(tk.index)}
                    className="s-c5 s-c7 s-id s-jn"
                  >
                    {isCueStart && (
                      <span
                        className="s-jv s-jl truncate s-om s-pc s-qe s-tl s-cx s-x1 s-wj"
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
                        "s-6i s-op s-oy s-qh s-tw s-ws s-jn s-8h s-uj",
                        !existing && !isSelected && "s-h0",
                        isSelected && "s-5c s-ux",
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


        <div className="s-82 s-71 s-ot s-p7 s-t0 s-4c s-nb">
          <div className="s-c5 s-ib s-dn">
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
              className="s-c6"
            />
            <Button
              type="button"
              onClick={save}
              disabled={!cue.trim() || selected.size === 0}
              className="s-dm"
            >
              <Sparkle className="s-fz s-xt" />
              {t("upload.propCue.pickerSave", "Add cue")}
            </Button>
          </div>

          {selected.size > 0 && (
            <div className="s-c5 s-ib s-if">
              <p className="s-vj s-ul s-ol">
                {t("upload.propCue.pickerSelected", "{{count}} words selected", {
                  count: selected.size,
                })}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                <X className="s-fz s-xt s-ln" />
                {t("common.cancel")}
              </Button>
            </div>
          )}

          {showDone && (
            <Button
              type="button"
              onClick={close}
              className="s-y7 s-dm s-fo s-tw s-d3"
            >
              <Check className="s-g1 s-xv" />
              {t("upload.propCue.pickerDone", "Done")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PropCueWordPicker;
