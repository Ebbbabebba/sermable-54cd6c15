import { GripVertical } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn("s-c5 s-gg s-y7 s-9k", className)}
    {...props}
  />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "s-pd s-c5 s-y9 s-ib s-ig s-4a s-2h s-2q s-2r s-2u s-2g s-9l s-9m s-9h s-9g s-9j s-9f s-9i s-cc s-cd s-cj s-cf s-11",
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="s-ye s-c5 s-fz s-xp s-ib s-ig s-ql s-6l s-4a">
        <GripVertical className="s-ft s-xl" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
