import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("s-30 s-qo s-50", className)} {...props} />;
}

export { Skeleton };
