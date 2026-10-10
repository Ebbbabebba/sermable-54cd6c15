import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "s-i4 s-ib s-qe s-6l s-oq s-ox s-vj s-d3 s-ws s-cq s-cr s-ct s-cs",
  {
    variants: {
      variant: {
        default: "s-84 s-5c s-ux s-h7",
        secondary: "s-84 s-5t s-v6 s-ha",
        destructive: "s-84 s-4h s-u3 s-gw",
        outline: "s-u9",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
