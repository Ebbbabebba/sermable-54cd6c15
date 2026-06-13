import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const PublicFooter = () => {
  const { t } = useTranslation();
  return (
    <footer className="py-4 px-6 text-center text-xs text-muted-foreground space-x-3">
      <Link to="/terms" className="hover:underline">{t("footer.terms")}</Link>
      <Link to="/privacy" className="hover:underline">{t("footer.privacy")}</Link>
      <Link to="/refund-policy" className="hover:underline">{t("footer.refundPolicy")}</Link>
    </footer>
  );
};
