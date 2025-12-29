import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number; // 0-100
  size?: number; // px
  strokeWidth?: number;
  showValue?: boolean;
  valueFormat?: 'percent' | 'fraction';
  current?: number;
  total?: number;
  className?: string;
  trackColor?: string;
  progressColor?: string;
  valueClassName?: string;
}

export const CircularProgress = ({
  value,
  size = 120,
  strokeWidth = 8,
  showValue = true,
  valueFormat = 'percent',
  current,
  total,
  className,
  trackColor = 'hsl(var(--muted))',
  progressColor = 'hsl(var(--primary))',
  valueClassName,
}: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  const displayValue = valueFormat === 'fraction' && current !== undefined && total !== undefined
    ? `${current}/${total}`
    : `${Math.round(value)}%`;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          className="opacity-30"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
        />
      </svg>
      
      {showValue && (
        <div className={cn(
          "absolute inset-0 flex items-center justify-center",
          valueClassName
        )}>
          <span className="text-2xl font-bold tabular-nums">
            {displayValue}
          </span>
        </div>
      )}
    </div>
  );
};
