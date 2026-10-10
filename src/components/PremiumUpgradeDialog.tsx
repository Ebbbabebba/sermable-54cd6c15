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
      <DialogContent className="s-s0">
        <DialogHeader className="s-u0">
          <div className="s-m9 s-xj s-fr s-q9 s-4s s-db s-vw s-c5 s-ib s-ig s-k0">
            {feature === 'audience_mode' ? (
              <Users className="s-y0 s-g6 s-tt" />
            ) : (
              <Crown className="s-y0 s-g6 s-tt" />
            )}
          </div>
          <DialogTitle className="s-t9 s-cx s-4t from-amber-500 to-orange-500 s-4g s-vd">
            {content.title}
          </DialogTitle>
          <DialogDescription className="s-tw">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="s-t0 s-p7">
          {content.benefits.map((benefit, index) => (
            <div key={index} className="s-c5 s-ib s-dp s-mv s-qo s-5v">
              <div className="s-xf s-fn s-qo s-5e s-c5 s-ib s-ig">
                <benefit.icon className="s-xv s-g1 s-uw" />
              </div>
              <span className="s-d0">{benefit.text}</span>
            </div>
          ))}
        </div>

        <div className="s-u0 s-v9 s-ul s-n4">
          {t('premiumDialog.startingAt')} <span className="s-d3 s-u9">€3.90</span>{t('premiumDialog.perMonthStudents')}
        </div>

        <div className="s-c5 s-c7 s-dn s-o9">
          <Button
            onClick={handleContinue}
            className="s-y7 s-4t from-amber-500 to-orange-500 s-hl s-hz s-vg"
          >
            {t('premiumDialog.upgradeNow')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="s-y7"
          >
            {t('premiumDialog.maybeLater')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
