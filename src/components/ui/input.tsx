import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "s-c5 s-fn s-y7 s-qo s-6l s-7g s-3v s-or s-p3 s-tw s-pu s-bw s-bv s-bz s-bx s-by s-nv s-cc s-ce s-cj s-cg s-bi s-bk s-kq",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
