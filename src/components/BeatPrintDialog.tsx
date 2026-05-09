import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tokenizeScript } from "@/utils/stageDirections";

interface BeatPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  speechId: string;
  speechTitle: string;
  fallbackText: string;
}

interface SegmentRow {
  segment_order: number;
  segment_text: string;
}

type Layout = "per-page" | "continuous";

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Render a segment of script text as printable HTML.
 *  - `[hidden]` bracket markers are removed (words kept, brackets dropped).
 *  - `(stage directions)` are rendered as italic cues so the speaker sees them.
 */
const renderSegmentHtml = (text: string): string => {
  const cleaned = text.replace(/\[|\]/g, "");
  const { tokens } = tokenizeScript(cleaned);
  return tokens
    .map((tok) => {
      if (tok.type === "direction") {
        return `<span class="direction">(${escapeHtml(tok.text)})</span>`;
      }
      return escapeHtml(tok.text);
    })
    .join(" ");
};

export const BeatPrintDialog = ({
  open,
  onOpenChange,
  speechId,
  speechTitle,
  fallbackText,
}: BeatPrintDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [layout, setLayout] = useState<Layout>("per-page");
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    try {
      const { data: segments, error } = await supabase
        .from("speech_segments")
        .select("segment_order, segment_text")
        .eq("speech_id", speechId)
        .order("segment_order", { ascending: true });

      if (error) throw error;

      const beats: SegmentRow[] =
        segments && segments.length > 0
          ? (segments as SegmentRow[])
          : [{ segment_order: 1, segment_text: fallbackText }];

      const beatLabel = t("beatPrint.beatLabel", "Beat");
      const titleHtml = escapeHtml(speechTitle);

      const beatsHtml = beats
        .map((b, idx) => {
          const breakClass =
            layout === "per-page" && idx < beats.length - 1
              ? "beat page-break"
              : "beat";
          return `
            <section class="${breakClass}">
              <header class="beat-header">
                <span class="beat-number">${beatLabel} ${b.segment_order}</span>
                <span class="beat-of">${idx + 1} / ${beats.length}</span>
              </header>
              <p class="beat-body">${renderSegmentHtml(b.segment_text || "")}</p>
            </section>
          `;
        })
        .join("\n");

      const pageBreakCss =
        layout === "per-page"
          ? `.page-break { page-break-after: always; break-after: page; }`
          : `.beat + .beat { margin-top: 2.5rem; }`;

      const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${titleHtml}</title>
<style>
  @page { margin: 2cm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #111;
    line-height: 1.6;
    margin: 0;
    padding: 0;
  }
  h1.title {
    font-size: 1.6rem;
    margin: 0 0 1.5rem 0;
    font-weight: 600;
  }
  .beat-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid #ddd;
    padding-bottom: 0.4rem;
    margin-bottom: 1rem;
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
  }
  .beat-number { font-weight: 600; color: #111; }
  .beat-body {
    font-size: ${layout === "per-page" ? "1.4rem" : "1.1rem"};
    line-height: 1.7;
    margin: 0;
  }
  .direction {
    font-style: italic;
    color: #c2410c; /* warm orange — distinctive on paper */
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    font-size: 0.9em;
  }
  ${pageBreakCss}
  @media print {
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <h1 class="title">${titleHtml}</h1>
  ${beatsHtml}
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 150);
    });
  </script>
</body>
</html>`;

      const w = window.open("", "_blank");
      if (!w) {
        toast({
          title: t("beatPrint.popupBlockedTitle", "Popup blockerad"),
          description: t(
            "beatPrint.popupBlockedDesc",
            "Tillåt popup-fönster för att skriva ut manuset.",
          ),
          variant: "destructive",
        });
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      onOpenChange(false);
    } catch (err) {
      console.error("Beat print failed:", err);
      toast({
        title: t("beatPrint.errorTitle", "Kunde inte skapa utskrift"),
        description: String((err as Error)?.message ?? err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("beatPrint.title", "Skriv ut manus")}</DialogTitle>
          <DialogDescription>
            {t(
              "beatPrint.description",
              "Välj layout. Regiinstruktioner i (parenteser) skrivs ut i kursiv.",
            )}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={layout}
          onValueChange={(v) => setLayout(v as Layout)}
          className="space-y-3 py-2"
        >
          <label
            htmlFor="layout-per-page"
            className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/40"
          >
            <RadioGroupItem id="layout-per-page" value="per-page" className="mt-1" />
            <div className="space-y-0.5">
              <Label
                htmlFor="layout-per-page"
                className="font-medium cursor-pointer"
              >
                {t("beatPrint.optionPerPage", "En beat per sida")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  "beatPrint.optionPerPageDesc",
                  "Stort typsnitt, luftig layout. Bra för podium/scen.",
                )}
              </p>
            </div>
          </label>

          <label
            htmlFor="layout-continuous"
            className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/40"
          >
            <RadioGroupItem id="layout-continuous" value="continuous" className="mt-1" />
            <div className="space-y-0.5">
              <Label
                htmlFor="layout-continuous"
                className="font-medium cursor-pointer"
              >
                {t("beatPrint.optionContinuous", "Löpande sidor")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  "beatPrint.optionContinuousDesc",
                  "Kompakt utskrift, beats efter varandra. Sparar papper.",
                )}
              </p>
            </div>
          </label>
        </RadioGroup>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("common.cancel", "Avbryt")}
          </Button>
          <Button onClick={handlePrint} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            {t("beatPrint.printButton", "Skriv ut")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BeatPrintDialog;
