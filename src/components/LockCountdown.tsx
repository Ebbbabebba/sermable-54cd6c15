import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";

interface LockCountdownProps {
  nextReviewDate: Date;
  className?: string;
}

const LockCountdown = ({ nextReviewDate, className = "" }: LockCountdownProps) => {
  const { t } = useTranslation();
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const totalMinutes = differenceInMinutes(nextReviewDate, now);
      const totalSeconds = differenceInSeconds(nextReviewDate, now);

      if (totalSeconds <= 0) {
        setTimeRemaining(t('practice.countdown.readyNow'));
        return;
      }

      const days = differenceInDays(nextReviewDate, now);
      const hours = differenceInHours(nextReviewDate, now) % 24;
      const minutes = totalMinutes % 60;

      if (days > 0) {
        if (hours > 0) {
          setTimeRemaining(t('practice.countdown.inDaysHours', { days, hours }));
        } else {
          setTimeRemaining(days === 1 
            ? t('practice.countdown.inDays', { days }) 
            : t('practice.countdown.inDaysPlural', { days }));
        }
      } else if (hours > 0) {
        if (minutes > 0) {
          setTimeRemaining(t('practice.countdown.inHoursMinutes', { hours, minutes }));
        } else {
          setTimeRemaining(hours === 1 
            ? t('practice.countdown.inHours', { hours }) 
            : t('practice.countdown.inHoursPlural', { hours }));
        }
      } else if (minutes > 0) {
        setTimeRemaining(minutes === 1 
          ? t('practice.countdown.inMinutes', { minutes }) 
          : t('practice.countdown.inMinutesPlural', { minutes }));
      } else {
        setTimeRemaining(t('practice.countdown.inLessThanMinute'));
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 10000);

    return () => clearInterval(interval);
  }, [nextReviewDate, t]);

  return (
    <span className={className}>
      {timeRemaining}
    </span>
  );
};

export default LockCountdown;