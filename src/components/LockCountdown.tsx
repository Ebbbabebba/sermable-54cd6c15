import { useEffect, useState } from "react";
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";

interface LockCountdownProps {
  nextReviewDate: Date;
  className?: string;
}

const LockCountdown = ({ nextReviewDate, className = "" }: LockCountdownProps) => {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const totalMinutes = differenceInMinutes(nextReviewDate, now);
      const totalSeconds = differenceInSeconds(nextReviewDate, now);

      if (totalSeconds <= 0) {
        setTimeRemaining("Ready now!");
        return;
      }

      const days = differenceInDays(nextReviewDate, now);
      const hours = differenceInHours(nextReviewDate, now) % 24;
      const minutes = totalMinutes % 60;

      if (days > 0) {
        // More than 1 day: show days and hours
        if (hours > 0) {
          setTimeRemaining(`in ${days}d ${hours}h`);
        } else {
          setTimeRemaining(`in ${days} day${days !== 1 ? 's' : ''}`);
        }
      } else if (hours > 0) {
        // Less than 1 day: show hours and minutes
        if (minutes > 0) {
          setTimeRemaining(`in ${hours}h ${minutes}m`);
        } else {
          setTimeRemaining(`in ${hours} hour${hours !== 1 ? 's' : ''}`);
        }
      } else if (minutes > 0) {
        // Less than 1 hour: show minutes
        setTimeRemaining(`in ${minutes} minute${minutes !== 1 ? 's' : ''}`);
      } else {
        // Less than 1 minute
        setTimeRemaining("in less than a minute");
      }
    };

    updateCountdown();
    // Update every 10 seconds for more responsive countdown
    const interval = setInterval(updateCountdown, 10000);

    return () => clearInterval(interval);
  }, [nextReviewDate]);

  return (
    <span className={className}>
      {timeRemaining}
    </span>
  );
};

export default LockCountdown;
