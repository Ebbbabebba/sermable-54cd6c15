import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Copy, Check } from "lucide-react";
import { buildMailtoUrl, copyToClipboard } from "@/lib/openMailto";

const SUPPORT_EMAIL = "support@sermable.com";

interface SupportContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email?: string;
}

/**
 * Support contact sheet. Uses a real user-activated anchor for the mailto link,
 * which is the only variant that reliably opens Mail inside the iOS/Android
 * app shell. Copying the address is always offered as a fallback.
 */
export const SupportContactDialog = ({ open, onOpenChange, email = SUPPORT_EMAIL }: SupportContactDialogProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(email);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inset-x-4 top-1/2 bottom-auto -translate-y-1/2 w-auto max-w-[calc(100vw-2rem)] sm:max-w-sm rounded-3xl p-6 pt-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>

        <DialogHeader className="space-y-1.5 pt-2">
          <DialogTitle className="text-center">{t('settings.support.title', 'Support')}</DialogTitle>
          <DialogDescription className="text-center">
            {t('settings.support.dialogDesc', 'Mejla oss så svarar vi vanligtvis inom 24–48 timmar.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <Button asChild className="w-full rounded-2xl h-12">
            <a href={buildMailtoUrl(email)} target="_blank" rel="external noopener">
              <Mail className="h-4 w-4 mr-2" />
              {t('settings.support.openMail', 'Öppna e-postappen')}
            </a>
          </Button>

          <button
            type="button"
            onClick={handleCopy}
            className="mx-auto flex items-center gap-2 rounded-full bg-secondary/60 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
          >
            <span className="truncate">{email}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0" />
            )}
          </button>

          <p className={`text-xs text-primary transition-opacity ${copied ? "opacity-100" : "opacity-0"}`}>
            {t('settings.support.copied', 'Adressen är kopierad')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupportContactDialog;
