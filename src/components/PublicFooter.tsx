import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const PublicFooter = () => {
  const { t } = useTranslation();
  return (
    <footer className="s-p7 s-ou s-u0 s-vj s-ul s-st">
      <Link to="/terms" className="s-i1">{t("footer.terms")}</Link>
      <Link to="/privacy" className="s-i1">{t("footer.privacy")}</Link>
      <Link to="/refund-policy" className="s-i1">{t("footer.refundPolicy")}</Link>
    </footer>
  );
};
