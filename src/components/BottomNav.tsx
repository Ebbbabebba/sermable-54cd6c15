import { useNavigate, useLocation } from "react-router-dom";
import { Home, Play, TrendingUp, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: "dashboard", label: "My Speeches", icon: Home, path: "/dashboard" },
    { id: "progress", label: "Progress", icon: TrendingUp, path: "/progress" },
    { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 backdrop-blur-lg bg-card/80 z-50 safe-area-bottom">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around h-20">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path || 
                           (tab.id === "practice" && location.pathname.startsWith("/practice/"));
            
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-6 py-2 rounded-2xl transition-all duration-300",
                  "hover-scale",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon 
                  className={cn(
                    "h-6 w-6 transition-all duration-300",
                    isActive && "scale-110"
                  )} 
                />
                <span className={cn(
                  "text-xs font-medium transition-all duration-300",
                  isActive && "font-semibold"
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
