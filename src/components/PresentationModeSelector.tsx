import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText } from "lucide-react";

interface PresentationModeSelectorProps {
  onSelectMode: (mode: 'strict' | 'fullscript') => void;
}

export const PresentationModeSelector = ({ onSelectMode }: PresentationModeSelectorProps) => {
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
                onClick={() => onSelectMode('strict')}>
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

              <Button className="w-full mt-6">
                Select Strict Mode
              </Button>
            </div>
          </Card>

          {/* Full Script Mode */}
          <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 cursor-pointer group relative overflow-hidden"
                onClick={() => onSelectMode('fullscript')}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="space-y-4 relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold mb-2">Full Script Mode</h3>
                <p className="text-muted-foreground mb-4">
                  See the entire script, words fade as you speak
                </p>
              </div>

              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Full text visible at all times</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Words fade out as you speak them</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>No color marking - focus on fluency</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Build confidence naturally</span>
                </li>
              </ul>

              <Button className="w-full mt-6 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
                Select Full Script Mode
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
