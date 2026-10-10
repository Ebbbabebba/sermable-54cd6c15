import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { PublicFooter } from "@/components/PublicFooter";
const Index = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();
  useEffect(() => {
    const check = async () => {
      if (!localStorage.getItem("onboarding_complete")) { navigate("/onboarding", { replace: true }); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { navigate("/dashboard", { replace: true }); return; }
      setIsLoading(false);
    };
    check();
  }, [navigate]);
  return <div className="welcome">
    <main className="welcome__main">
      <h1 className="welcome__brand">SERM<br />ABLE</h1>
      {isLoading ? <Loader2 className="welcome__loader" aria-label={t("common.loading")} /> : <>
        <p className="welcome__tagline">{t("app.tagline")}</p>
        <div className="welcome__actions">
          <Button size="lg" onClick={() => navigate("/auth?mode=signup")}>{t("home.getStarted")}</Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>{t("home.haveAccount")}</Button>
        </div>
      </>}
    </main>
    {!isLoading && <PublicFooter />}
  </div>;
};
export default Index;
