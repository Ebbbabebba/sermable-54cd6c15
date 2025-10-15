import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingCTAProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

const FloatingCTA = ({ onClick, label = "Start Practice", className }: FloatingCTAProps) => {
  return (
    <Button
      size="lg"
      onClick={onClick}
      className={cn(
        "fixed bottom-28 right-6 z-50 shadow-xl hover:shadow-2xl",
        "animate-scale-in hover-scale",
        "bg-primary text-primary-foreground",
        className
      )}
    >
      <Play className="h-5 w-5 mr-2" />
      {label}
    </Button>
  );
};

export default FloatingCTA;
