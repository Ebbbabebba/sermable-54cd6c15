import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "s-c5 s-l4 s-y7 s-jn s-qo s-6l s-7g s-3v s-or s-p3 s-tw s-pu s-nv s-cc s-ce s-cj s-cg s-bi s-bk s-kq",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
