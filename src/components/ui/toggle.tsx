import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "s-i4 s-ib s-ig s-qi s-v9 s-d0 s-pu s-ws s-h0 s-hw s-cc s-ce s-cj s-cg s-bl s-bk s-aj s-ak",
  {
    variants: {
      variant: {
        default: "s-61",
        outline: "s-6l s-7g s-61 s-gp s-ht",
      },
      size: {
        default: "s-fn s-or",
        sm: "s-g8 s-oq",
        lg: "s-fo s-ot",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root ref={ref} className={cn(toggleVariants({ variant, size, className }))} {...props} />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
