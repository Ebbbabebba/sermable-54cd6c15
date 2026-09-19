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
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>{t('settings.support.title', 'Support')}</DialogTitle>
          <DialogDescription>
            {t('settings.support.dialogDesc', 'Mejla oss så svarar vi vanligtvis inom 24–48 timmar.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button asChild className="w-full rounded-2xl h-12">
            <a href={buildMailtoUrl(email)} target="_blank" rel="external noopener">
              <Mail className="h-4 w-4 mr-2" />
              {t('settings.support.openMail', 'Öppna e-postappen')}
            </a>
          </Button>

          <Button variant="outline" className="w-full rounded-2xl h-12 justify-between" onClick={handleCopy}>
            <span className="truncate">{email}</span>
            {copied ? <Check className="h-4 w-4 text-primary shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
          </Button>
          {copied && (
            <p className="text-xs text-primary text-center">
              {t('settings.support.copied', 'Adressen är kopierad')}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupportContactDialog;
