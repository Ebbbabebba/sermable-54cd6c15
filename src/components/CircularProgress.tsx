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
    <div className={cn("s-pd s-i4 s-ib s-ig", className)}>
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
          className="s-mf"
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
          className="s-wr s-bp s-bu"
        />
      </svg>
      
      {showValue && (
        <div className={cn(
          "s-26 s-i5 s-c5 s-ib s-ig",
          valueClassName
        )}>
          <span className="s-t9 s-cx tabular-nums">
            {displayValue}
          </span>
        </div>
      )}
    </div>
  );
};
