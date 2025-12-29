import { cn } from "@/lib/utils";
import { Monitor, Smartphone, Watch, Glasses, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "./WearableHUD";

interface ViewModeSelectorProps {
  onSelectMode: (mode: ViewMode) => void;
  onBack: () => void;
  speechTitle: string;
}

export const ViewModeSelector = ({
  onSelectMode,
  onBack,
  speechTitle,
}: ViewModeSelectorProps) => {
  const modes = [
    {
      id: 'full' as ViewMode,
      icon: Monitor,
      title: 'Full',
      description: 'Full teleprompter view with all details',
      recommendation: 'Best for practice & desktop',
    },
    {
      id: 'compact' as ViewMode,
      icon: Smartphone,
      title: 'Compact',
      description: 'Minimal HUD overlay with progress ring',
      recommendation: 'Ideal for phone in pocket',
    },
    {
      id: 'wearable' as ViewMode,
      icon: Watch,
      title: 'Wearable',
      description: 'Ultra-minimal for watches & glasses',
      recommendation: 'Optimized for small screens',
      badge: 'NEW',
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col">
      <Button
        variant="ghost"
        onClick={onBack}
        className="self-start mb-8 gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Choose View Mode</h1>
          <p className="text-muted-foreground">{speechTitle}</p>
        </div>

        <div className="grid gap-4 w-full">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className={cn(
                "relative flex items-center gap-4 p-6 rounded-xl",
                "bg-card border border-border",
                "hover:border-primary/50 hover:bg-accent/50",
                "transition-all duration-200",
                "text-left group"
              )}
            >
              <div className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center",
                "bg-primary/10 text-primary",
                "group-hover:bg-primary group-hover:text-primary-foreground",
                "transition-colors duration-200"
              )}>
                <mode.icon className="w-7 h-7" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{mode.title}</h3>
                  {mode.badge && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                      {mode.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {mode.description}
                </p>
                <p className="text-xs text-primary mt-1">
                  {mode.recommendation}
                </p>
              </div>

              <ChevronLeft className="w-5 h-5 rotate-180 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          ))}
        </div>

        {/* Device preview hint */}
        <div className="mt-8 flex items-center gap-6 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Watch className="w-4 h-4" />
            <span className="text-xs">Wear OS</span>
          </div>
          <div className="flex items-center gap-2">
            <Glasses className="w-4 h-4" />
            <span className="text-xs">AI Glasses</span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <span className="text-xs">Mobile</span>
          </div>
        </div>
      </div>
    </div>
  );
};
