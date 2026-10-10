import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "s-ng s-fz s-xt s-r5 s-ql s-6l s-7n s-pu s-a0 s-a1 s-cc s-ce s-cj s-cg s-bi s-bk",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("s-c5 s-ib s-ig s-u1")}>
      <Check className="s-fz s-xt" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
