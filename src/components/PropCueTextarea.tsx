import { useRef, useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkle, X, Check, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import PropCueWordPicker from "@/components/PropCueWordPicker";
import { Hand } from "lucide-react";

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
    // Don't allow selection that crosses an existing cue marker
    const selectedText = value.slice(start, end);
    if (/\{\{|\}\}/.test(selectedText)) {
      setSel(null);
      setPos(null);
      return;
    }
    setSel({ start, end });
    // Position the floating button just above the textarea, aligned roughly
    // with the selection's vertical position — clamped to viewport so it
    // never sticks out on narrow (mobile / iPhone) screens.
    const rect = el.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight || "20");
    const before = value.slice(0, start);
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
    const before = value.slice(0, sel.start);
    const inside = value.slice(sel.start, sel.end);
    const after = value.slice(sel.end);
    const next = `${before}{{${cue}}}${inside}{{/}}${after}`;
    onChange(next);
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
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onSelect={updateSelection}
          onMouseUp={updateSelection}
          onKeyUp={updateSelection}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={cn("resize-none text-base", className)}
        />

        {/* Floating action when there's a selection */}
        <AnimatePresence>
          {sel && pos && !editing && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed z-50 left-0 right-0 flex justify-center pointer-events-none px-3"
              style={{ top: Math.max(8, pos.top) }}
            >
              <Button
                type="button"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEditing(true)}
                className="gap-1.5 shadow-lg max-w-full pointer-events-auto whitespace-nowrap"
                style={{
                  backgroundColor: "hsl(var(--prop-cue-fg))",
                  color: "hsl(var(--background))",
                }}
              >
                <Sparkle className="h-3.5 w-3.5 shrink-0" />
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
        className="gap-1.5 rounded-full"
        aria-expanded={pickerOpen}
      >
        <Hand className="h-4 w-4" />
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
            className="overflow-hidden"
          >
            <div
              className="flex items-center gap-2 p-3 rounded-xl border"
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
                className="flex-1"
                maxLength={32}
              />
              <Button
                type="button"
                size="sm"
                onClick={wrapSelection}
                disabled={!cueDraft.trim()}
              >
                <Check className="h-4 w-4" />
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
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 px-1">
              "{value.slice(sel.start, sel.end)}"
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pro-tip */}
      <div
        className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 border"
        style={{
          backgroundColor: "hsl(var(--prop-cue-bg))",
          borderColor: "hsl(var(--prop-cue-fg) / 0.3)",
          color: "hsl(var(--prop-cue-fg))",
        }}
      >
        <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>
          {t(
            "upload.propCue.tip",
            "Pro-tip: select any words to attach a prop cue (smile, laugh, raise hand). It floats above your script while you read it.",
          )}
        </p>
      </div>
    </div>
  );
};

export default PropCueTextarea;
