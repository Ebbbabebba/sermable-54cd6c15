import { Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  isVisible: boolean;
}

const LoadingOverlay = ({ isVisible }: LoadingOverlayProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-32 h-32">
        <div className="absolute inset-0 animate-[spin_3s_linear_infinite]">
          <Rocket className="w-12 h-12 text-primary absolute top-0 left-1/2 -translate-x-1/2" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30 animate-pulse" />
      </div>
    </div>
  );
};

export default LoadingOverlay;
