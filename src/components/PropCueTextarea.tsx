import { useRef, useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkle, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import PropCueWordPicker from "@/components/PropCueWordPicker";
import { Hand } from "lucide-react";
import {
  stripPropCueMarkers,
  extractPropCues,
  applyPropCueToIndices,
} from "@/utils/propCues";

interface PropCueTextareaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Textarea with selection-driven prop-cue editor.
 *
 * Select any text in the textarea → a floating "Add prop" button appears.
 * Click it to type a cue (e.g. "smile") → the selection gets wrapped in
 * `{{cue}}…{{/}}`. A live preview below shows the highlighted ranges with
 * the cue label so the user can see exactly where each cue is active.
 */
const PropCueTextarea = ({
  value,
  onChange,
  placeholder,
  rows = 8,
  className,
  disabled,
}: PropCueTextareaProps) => {
  const { t } = useTranslation();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [cueDraft, setCueDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  /** What the user sees: markers are hidden, only real words are shown. */
  const displayValue = stripPropCueMarkers(value);

  /** Word indices covered by a character range in the *clean* text. */
  const wordIndicesInRange = (clean: string, start: number, end: number) => {
    const out: number[] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = re.exec(clean)) !== null) {
      const s = m.index;
      const e = s + m[0].length;
      if (e > start && s < end) out.push(idx);
      idx += 1;
    }
    return out;
  };

  /**
   * The user edits plain text — re-attach existing cues afterwards by word
   * index so the markers never leak into the visible field.
   */
  const handlePlainChange = (nextClean: string) => {
    const { cues } = extractPropCues(value);
    if (cues.length === 0) {
      onChange(nextClean);
      return;
    }
    const wordCount = nextClean.split(/\s+/).filter(Boolean).length;
    let raw = nextClean;
    for (const c of cues) {
      if (c.endWordIndex >= wordCount) continue;
      const indices: number[] = [];
      for (let i = c.startWordIndex; i <= c.endWordIndex; i++) indices.push(i);
      raw = applyPropCueToIndices(raw, indices, c.cue);
    }
    onChange(raw);
  };

  const updateSelection = () => {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end - start <= 0) {
      setSel(null);
      setPos(null);
      setEditing(false);
      return;
    }
    setSel({ start, end });
    // Position the floating button just above the textarea, aligned roughly
    // with the selection's vertical position — clamped to viewport so it
    // never sticks out on narrow (mobile / iPhone) screens.
    const rect = el.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight || "20");
    const before = displayValue.slice(0, start);
    const lineIdx = (before.match(/\n/g) || []).length;
    const scrollTop = el.scrollTop;
    const top = rect.top + lineIdx * lineHeight - scrollTop - 40;
    const approxButtonHalfWidth = 90; // button + padding
    const viewportPadding = 12;
    const minLeft = approxButtonHalfWidth + viewportPadding;
    const maxLeft = window.innerWidth - approxButtonHalfWidth - viewportPadding;
    const rawLeft = rect.left + rect.width / 2;
    const left = Math.max(minLeft, Math.min(maxLeft, rawLeft));
    setPos({ top, left });
  };

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    const handler = () => updateSelection();
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const wrapSelection = () => {
    if (!sel) return;
    const cue = cueDraft.trim();
    if (!cue) return;
    // Selection offsets refer to the clean (displayed) text — translate to
    // word indices and wrap in the raw text instead.
    const indices = wordIndicesInRange(displayValue, sel.start, sel.end);
    if (indices.length === 0) return;
    onChange(applyPropCueToIndices(value, indices, cue));
    setEditing(false);
    setCueDraft("");
    setSel(null);
    setPos(null);
    // Restore focus
    requestAnimationFrame(() => {
      taRef.current?.focus();
    });
  };

  return (
    <div className="s-t0">
      <div className="s-pd">
        <Textarea
          ref={taRef}
          value={displayValue}
          onChange={(e) => handlePlainChange(e.target.value)}
          onSelect={updateSelection}
          onMouseUp={updateSelection}
          onKeyUp={updateSelection}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={cn("resize-none s-tw", className)}
        />

        {/* Floating action when there's a selection */}
        <AnimatePresence>
          {sel && pos && !editing && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="s-c4 s-yh s-is s-pe s-c5 s-ig s-nx s-or"
              style={{ top: Math.max(8, pos.top) }}
            >
              <Button
                type="button"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEditing(true)}
                className="s-dm s-qx s-jn s-nw s-yb"
                style={{
                  backgroundColor: "hsl(var(--prop-cue-fg))",
                  color: "hsl(var(--background))",
                }}
              >
                <Sparkle className="s-fx s-xq s-r5" />
                <span className="truncate">
                  {t("upload.propCue.addButton", "Add prop cue")}
                </span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tap-to-tag picker (touch friendly alternative to text selection) — inline toggle, no popup */}
      <Button
        type="button"
        variant={pickerOpen ? "secondary" : "outline"}
        size="sm"
        disabled={disabled || !value.trim()}
        onClick={() => setPickerOpen((v) => !v)}
        className="s-dm s-qe"
        aria-expanded={pickerOpen}
      >
        <Hand className="s-fz s-xt" />
        {t("upload.propCue.pickerButton", "Mark words by tapping")}
      </Button>
      <PropCueWordPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={value}
        onChange={onChange}
      />


      {/* Inline form */}
      <AnimatePresence>
        {editing && sel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="s-mn"
          >
            <div
              className="s-c5 s-ib s-dn s-mv s-qo s-6l"
              style={{
                backgroundColor: "hsl(var(--prop-cue-bg))",
                borderColor: "hsl(var(--prop-cue-fg) / 0.4)",
              }}
            >
              <Input
                autoFocus
                value={cueDraft}
                onChange={(e) => setCueDraft(e.target.value)}
                placeholder={t(
                  "upload.propCue.placeholder",
                  "e.g. smile, laugh, raise hand…",
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    wrapSelection();
                  }
                  if (e.key === "Escape") {
                    setEditing(false);
                    setCueDraft("");
                  }
                }}
                className="s-c6"
                maxLength={32}
              />
              <Button
                type="button"
                size="sm"
                onClick={wrapSelection}
                disabled={!cueDraft.trim()}
              >
                <Check className="s-fz s-xt" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setCueDraft("");
                }}
              >
                <X className="s-fz s-xt" />
              </Button>
            </div>
            <p className="s-vj s-ul s-lu s-ol">
              "{displayValue.slice(sel.start, sel.end)}"
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PropCueTextarea;
