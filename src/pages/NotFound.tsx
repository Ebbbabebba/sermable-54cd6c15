import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="s-c5 s-l6 s-ib s-ig s-3v">
      <div className="s-u0">
        <h1 className="s-k0 s-tb s-cx">404</h1>
        <p className="s-k0 s-vi s-ul">{t("notFound.title")}</p>
        <a href="/" className="s-uw s-wy s-ho">
          {t("notFound.back")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
