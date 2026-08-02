import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-normal normal-case transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "duo-btn bg-primary text-primary-foreground hover:brightness-105",
        destructive: "duo-btn duo-btn-destructive bg-destructive text-destructive-foreground hover:brightness-105",
        outline: "duo-btn duo-btn-outline border border-border bg-card hover:bg-accent/50 text-foreground",
        secondary: "duo-btn duo-btn-outline bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent/50 text-foreground font-medium",
        link: "text-primary underline-offset-4 hover:underline font-medium",
        gradient: "duo-btn bg-primary text-primary-foreground hover:brightness-105",
        success: "duo-btn bg-success text-success-foreground hover:brightness-105",
        info: "duo-btn duo-btn-info bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))] hover:brightness-105",
        warning: "duo-btn duo-btn-warning bg-warning text-warning-foreground hover:brightness-105",
        purple: "duo-btn duo-btn-purple bg-[hsl(var(--duo-purple))] text-[hsl(var(--duo-purple-foreground))] hover:brightness-105",
        apple: "duo-btn bg-primary text-primary-foreground hover:brightness-105",
        "apple-secondary": "duo-btn duo-btn-outline bg-secondary text-foreground hover:bg-secondary/80",
        "apple-ghost": "text-primary hover:bg-primary/10 font-medium",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-full px-4 text-xs",
        lg: "h-12 rounded-full px-8 text-base",
        xl: "h-14 rounded-full px-10 text-base font-semibold",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
