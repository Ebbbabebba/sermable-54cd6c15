import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, ScrollText, Users, Lock, Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { PremiumUpgradeDialog } from "./PremiumUpgradeDialog";

interface PresentationModeSelectorProps {
  onSelectMode: (mode: 'strict' | 'fullscript') => void;
  onSelectAudienceMode?: () => void;
}

export const PresentationModeSelector = ({ 
  onSelectMode,
  onSelectAudienceMode 
}: PresentationModeSelectorProps) => {
  const { t } = useTranslation();
  const { isPremium, loading } = useSubscription();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const handleAudienceModeClick = () => {
    if (isPremium) {
      onSelectAudienceMode?.();
    } else {
      setShowUpgradeDialog(true);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="w-full max-w-5xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {t('presentationMode.chooseMode')}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t('presentationMode.selectHow')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Strict Mode */}
            <Card className="p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 cursor-pointer group"
                  onClick={() => onSelectMode('strict')}>
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Brain className="w-7 h-7 text-primary" />
                </div>
                
                <div>
                  <h3 className="text-xl font-bold mb-2">{t('presentationMode.strictMode')}</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {t('presentationMode.strictModeDesc')}
                  </p>
                </div>

                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.progressiveHints')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.wordByWord')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.detailedAnalysis')}</span>
                  </li>
                </ul>

                <Button className="w-full mt-4" size="sm">
                  {t('presentationMode.selectStrict')}
                </Button>
              </div>
            </Card>

            {/* Full Script Mode */}
            <Card className="p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 cursor-pointer group relative overflow-hidden"
                  onClick={() => onSelectMode('fullscript')}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="space-y-4 relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ScrollText className="w-7 h-7 text-primary" />
                </div>
                
                <div>
                  <h3 className="text-xl font-bold mb-2">{t('presentationMode.fullScript')}</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {t('presentationMode.fullScriptDesc')}
                  </p>
                </div>

                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.fullTextVisible')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.wordsFade')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.buildConfidence')}</span>
                  </li>
                </ul>

                <Button className="w-full mt-4" size="sm" variant="secondary">
                  {t('presentationMode.selectFullScript')}
                </Button>
              </div>
            </Card>

            {/* Audience Mode - Premium */}
            <Card 
              className={`p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 cursor-pointer group relative overflow-hidden ${
                isPremium 
                  ? 'hover:border-amber-500/50 border-amber-500/20' 
                  : 'hover:border-muted-foreground/30'
              }`}
              onClick={handleAudienceModeClick}
            >
              {/* Premium glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
              
              <div className="space-y-4 relative">
                <div className="flex items-start justify-between">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-7 h-7 text-amber-500" />
                  </div>
                  <Badge 
                    variant="secondary" 
                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 gap-1"
                  >
                    {isPremium ? (
                      <>
                        <Sparkles className="w-3 h-3" />
                        {t('subscription.premium')}
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        {t('subscription.premium')}
                      </>
                    )}
                  </Badge>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold mb-2">{t('presentationMode.audienceMode')}</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {t('presentationMode.audienceModeDesc')}
                  </p>
                </div>

                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    <span>{t('presentationMode.animatedAudience')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    <span>{t('presentationMode.realTimeReactions')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">✓</span>
                    <span>{t('presentationMode.multipleEnvironments')}</span>
                  </li>
                </ul>

                <Button 
                  className={`w-full mt-4 ${
                    isPremium 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white' 
                      : ''
                  }`}
                  size="sm"
                  variant={isPremium ? 'default' : 'outline'}
                  disabled={loading}
                >
                  {isPremium ? t('presentationMode.startWithAudience') : t('presentationMode.unlockPremium')}
                </Button>
              </div>
            </Card>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {t('presentationMode.switchModes')}
          </p>
        </div>
      </div>

      <PremiumUpgradeDialog 
        open={showUpgradeDialog} 
        onOpenChange={setShowUpgradeDialog}
        feature="audience_mode"
      />
    </>
  );
};