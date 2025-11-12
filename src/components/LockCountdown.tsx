import { useEffect, useState } from "react";
import { formatDistanceToNow, differenceInHours, differenceInMinutes } from "date-fns";

interface LockCountdownProps {
  nextReviewDate: Date;
  className?: string;
}

const LockCountdown = ({ nextReviewDate, className = "" }: LockCountdownProps) => {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isLessThan24Hours, setIsLessThan24Hours] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const hours = differenceInHours(nextReviewDate, now);
      const minutes = differenceInMinutes(nextReviewDate, now);

      if (minutes < 0) {
        setTimeRemaining("Ready now!");
        setIsLessThan24Hours(false);
        return;
      }

      if (hours < 24) {
        setIsLessThan24Hours(true);
        if (hours < 1) {
          setTimeRemaining(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
        } else {
          const remainingMinutes = minutes % 60;
          setTimeRemaining(`${hours}h ${remainingMinutes}m`);
        }
      } else {
        setIsLessThan24Hours(false);
        setTimeRemaining(formatDistanceToNow(nextReviewDate, { addSuffix: false }));
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [nextReviewDate]);

  return (
    <span className={className}>
      {isLessThan24Hours ? timeRemaining : `in ${timeRemaining}`}
    </span>
  );
};

export default LockCountdown;
