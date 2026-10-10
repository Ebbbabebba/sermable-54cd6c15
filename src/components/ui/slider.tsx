import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("s-pd s-c5 s-y7 s-wd s-qq s-ib", className)}
    {...props}
  >
    <SliderPrimitive.Track className="s-pd s-fs s-y7 s-fi s-mn s-qe s-5t">
      <SliderPrimitive.Range className="s-26 s-gg s-5c" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="s-6i s-g1 s-xv s-qe s-6n s-7n s-3v s-pu s-ws s-cc s-ce s-cj s-cg s-bl s-bk" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
