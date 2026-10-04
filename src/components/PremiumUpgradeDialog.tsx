import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Crown, Infinity as InfinityIcon, Zap, Users, Brain } from "lucide-react";

interface PremiumUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: 'general' | 'audience_mode' | 'advanced_analytics';
}

export const PremiumUpgradeDialog = ({ 
  open, 
  onOpenChange,
  feature = 'general'
}: PremiumUpgradeDialogProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleContinue = () => {
    onOpenChange(false);
    navigate("/settings/payment");
  };

  // Feature-specific messaging
  const featureContent = {
    general: {
      title: t('premiumDialog.title'),
      description: t('premiumDialog.description'),
      benefits: [
        { icon: InfinityIcon, text: t('premiumDialog.unlimited') },
        { icon: Zap, text: t('premiumDialog.words') },
        { icon: Crown, text: t('premiumDialog.priority') },
      ],
    },
    audience_mode: {
      title: "Unlock Audience Mode",
      description: "Practice with animated virtual audience that reacts to your performance in real-time",
      benefits: [
        { icon: Users, text: "Animated audience with unique personalities" },
        { icon: Brain, text: "Real-time reactions to hesitations & energy" },
        { icon: Crown, text: "Multiple environments (office, classroom, conference)" },
      ],
    },
    advanced_analytics: {
      title: "Unlock Advanced Analytics",
      description: "Get deeper insights into your speaking patterns and progress",
      benefits: [
        { icon: Brain, text: "Word-level mastery tracking" },
        { icon: Zap, text: "Fluency timeline analysis" },
        { icon: Brain, text: "AI coaching recommendations" },
      ],
    },
  };

  const content = featureContent[feature];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-4">
            {feature === 'audience_mode' ? (
              <Users className="w-8 h-8 text-amber-500" />
            ) : (
              <Crown className="w-8 h-8 text-amber-500" />
            )}
          </div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-base">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {content.benefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <benefit.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="font-medium">{benefit.text}</span>
            </div>
          ))}
        </div>

        <div className="text-center text-sm text-muted-foreground pb-2">
          {t('premiumDialog.startingAt')} <span className="font-semibold text-foreground">€3.90</span>{t('premiumDialog.perMonthStudents')}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            {t('premiumDialog.upgradeNow')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            {t('premiumDialog.maybeLater')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
