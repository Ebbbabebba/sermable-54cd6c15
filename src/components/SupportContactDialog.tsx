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
      <DialogContent className="s-i7 s-w4 s-8g s-9 s-y6 s-jm s-s1 s-qa s-my s-og s-u0">
        <div className="s-m9 s-c5 s-fq s-xi s-ib s-ig s-qe s-5e">
          <Mail className="s-g2 s-xw s-uw" />
        </div>

        <DialogHeader className="s-sx s-o9">
          <DialogTitle className="s-u0">{t('settings.support.title', 'Support')}</DialogTitle>
          <DialogDescription className="s-u0">
            {t('settings.support.dialogDesc', 'Mejla oss så svarar vi vanligtvis inom 24–48 timmar.')}
          </DialogDescription>
        </DialogHeader>

        <div className="s-t0 s-o7">
          <Button asChild className="s-y7 s-q9 s-fp">
            <a href={buildMailtoUrl(email)} target="_blank" rel="external noopener">
              <Mail className="s-fz s-xt s-lp" />
              {t('settings.support.openMail', 'Öppna e-postappen')}
            </a>
          </Button>

          <button
            type="button"
            onClick={handleCopy}
            className="s-m9 s-c5 s-ib s-dn s-qe s-5w s-os s-p3 s-v9 s-ul s-ws s-h9"
          >
            <span className="truncate">{email}</span>
            {copied ? (
              <Check className="s-fx s-xq s-uw s-r5" />
            ) : (
              <Copy className="s-fx s-xq s-r5" />
            )}
          </button>

          <p className={`s-vj s-uw s-wt ${copied ? "s-me" : "s-md"}`}>
            {t('settings.support.copied', 'Adressen är kopierad')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupportContactDialog;
