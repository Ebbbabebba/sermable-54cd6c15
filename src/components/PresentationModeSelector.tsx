import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles } from "lucide-react";

interface PresentationModeSelectorProps {
  onSelectMode: (mode: 'strict' | 'freestyle') => void;
  isAnalyzing?: boolean;
}

export const PresentationModeSelector = ({ onSelectMode, isAnalyzing }: PresentationModeSelectorProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Choose Your Presentation Mode
          </h1>
          <p className="text-muted-foreground text-lg">
            Select how you want to practice your speech
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Strict Mode */}
          <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 cursor-pointer group"
                onClick={() => !isAnalyzing && onSelectMode('strict')}>
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold mb-2">Strict Mode</h3>
                <p className="text-muted-foreground mb-4">
                  Read the script word for word with support words visible
                </p>
              </div>

              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Perfect for memorizing exact lines</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Word-by-word progress tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Ideal for school presentations or speeches</span>
                </li>
              </ul>

              <Button className="w-full mt-6" disabled={isAnalyzing}>
                Select Strict Mode
              </Button>
            </div>
          </Card>

          {/* Freestyle Mode */}
          <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-purple-500/50 cursor-pointer group relative overflow-hidden"
                onClick={() => !isAnalyzing && onSelectMode('freestyle')}>
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="space-y-4 relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-8 h-8 text-purple-500" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  Freestyle Mode
                  <span className="text-xs bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">NEW</span>
                </h3>
                <p className="text-muted-foreground mb-4">
                  Speak freely from the script, focusing on main themes
                </p>
              </div>

              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">✓</span>
                  <span>Focus on key ideas, not exact words</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">✓</span>
                  <span>Visual segment tracking with cue words</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">✓</span>
                  <span>Perfect for natural, flowing presentations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">✓</span>
                  <span>Support prompts when you lose track</span>
                </li>
              </ul>

              <Button 
                className="w-full mt-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" 
                disabled={isAnalyzing}
              >
                {isAnalyzing ? 'Analyzing Speech...' : 'Select Freestyle Mode'}
              </Button>
            </div>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          You can switch modes anytime before starting your presentation
        </p>
      </div>
    </div>
  );
};
