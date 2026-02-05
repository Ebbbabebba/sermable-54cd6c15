import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, ScrollText, Users, BookOpen } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { PremiumUpgradeDialog } from "./PremiumUpgradeDialog";

interface PresentationModeSelectorProps {
  onSelectMode: (mode: 'strict' | 'fullscript') => void;
  onSelectAudienceMode?: () => void;
  onSelectOverviewMode?: () => void;
}

export const PresentationModeSelector = ({ 
  onSelectMode,
  onSelectAudienceMode,
  onSelectOverviewMode
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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Strict Mode */}
            <Card className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 cursor-pointer group"
                  onClick={() => onSelectMode('strict')}>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                
                <div>
                  <h3 className="text-lg font-bold mb-1">{t('presentationMode.strictMode')}</h3>
                  <p className="text-muted-foreground text-xs mb-3">
                    {t('presentationMode.strictModeDesc')}
                  </p>
                </div>

                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.progressiveHints')}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.wordByWord')}</span>
                  </li>
                </ul>

                <Button className="w-full mt-3" size="sm">
                  {t('presentationMode.selectStrict')}
                </Button>
              </div>
            </Card>

            {/* Full Script Mode */}
            <Card className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 cursor-pointer group relative overflow-hidden"
                  onClick={() => onSelectMode('fullscript')}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ScrollText className="w-6 h-6 text-primary" />
                </div>
                
                <div>
                  <h3 className="text-lg font-bold mb-1">{t('presentationMode.fullScript')}</h3>
                  <p className="text-muted-foreground text-xs mb-3">
                    {t('presentationMode.fullScriptDesc')}
                  </p>
                </div>

                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.fullTextVisible')}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.wordsFade')}</span>
                  </li>
                </ul>

                <Button className="w-full mt-3" size="sm" variant="secondary">
                  {t('presentationMode.selectFullScript')}
                </Button>
              </div>
            </Card>

            {/* General Overview Mode */}
            <Card 
              className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 cursor-pointer group relative overflow-hidden"
              onClick={onSelectOverviewMode}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                
                <div>
                  <h3 className="text-lg font-bold mb-1">{t('presentationMode.overviewMode')}</h3>
                  <p className="text-muted-foreground text-xs mb-3">
                    {t('presentationMode.overviewModeDesc')}
                  </p>
                </div>

                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.topicBased')}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.speakNaturally')}</span>
                  </li>
                </ul>

                <Button className="w-full mt-3" size="sm" variant="secondary">
                  {t('presentationMode.selectOverview')}
                </Button>
              </div>
            </Card>

            {/* Audience Mode */}
            <Card 
              className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 cursor-pointer group relative overflow-hidden"
              onClick={handleAudienceModeClick}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                
                <div>
                  <h3 className="text-lg font-bold mb-1">{t('presentationMode.audienceMode')}</h3>
                  <p className="text-muted-foreground text-xs mb-3">
                    {t('presentationMode.audienceModeDesc')}
                  </p>
                </div>

                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.animatedAudience')}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{t('presentationMode.realTimeReactions')}</span>
                  </li>
                </ul>

                <Button 
                  className="w-full mt-3"
                  size="sm"
                  disabled={loading}
                >
                  {t('presentationMode.startWithAudience')}
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