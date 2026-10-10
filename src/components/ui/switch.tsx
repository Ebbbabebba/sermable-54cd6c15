import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "s-ng s-i4 s-g2 s-xg s-r5 s-8m s-ib s-qe s-6n s-84 s-ws s-a0 s-b9 s-cc s-ce s-cj s-cg s-ch s-bi s-bk",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "s-nx s-6i s-g1 s-xv s-qe s-3v s-qx s-pk s-wu s-a2 s-ba",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
