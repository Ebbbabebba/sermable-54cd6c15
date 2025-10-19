import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Brain, Calendar, Mic, TrendingUp, ArrowRight, CheckCircle } from "lucide-react";
import heroImage from "@/assets/hero-speaking.jpg";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Analysis",
      description: "Smart detection of hesitation, missed words, and speaking patterns",
    },
    {
      icon: Calendar,
      title: "Spaced Repetition",
      description: "Automated practice schedule optimized for your memory retention",
    },
    {
      icon: Mic,
      title: "Speech Recognition",
      description: "Practice by speaking aloud with real-time feedback",
    },
    {
      icon: TrendingUp,
      title: "Progress Tracking",
      description: "Visualize your improvement and stay motivated",
    },
  ];

  const benefits = [
    "Gradually memorize without overwhelming yourself",
    "AI generates cue words as you improve",
    "Practice on your schedule with reminders",
    "Track progress toward your goal date",
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5"></div>
        
        <div className="relative container mx-auto px-4 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8 animate-fade-in">
              <div className="inline-block">
                <span className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  AI-Powered Memorization
                </span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Master Your Speech
                <span className="block text-primary mt-2">Before the Big Day</span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-xl">
                Dryrun uses AI and spaced repetition to help you fully memorize your speech, 
                script, or presentation with confidence.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")}
                  className="text-lg px-8"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate("/auth")}
                  className="text-lg px-8"
                >
                  Sign In
                </Button>
              </div>

              <div className="pt-8 space-y-3">
                {benefits.map((benefit, i) => (
                  <div key={i} className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Image */}
            <div className="animate-slide-up">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src={heroImage} 
                  alt="Person practicing speech" 
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-muted-foreground">
              Powerful features designed to help you memorize faster and speak with confidence
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
              <div 
                key={i}
                className="p-6 rounded-xl bg-card border hover:shadow-lg transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Simple 3-Step Process
            </h2>
            <p className="text-xl text-muted-foreground">
              From upload to mastery in just a few clicks
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-12">
            {[
              {
                step: "1",
                title: "Upload Your Speech",
                description: "Paste your text or upload a document. Set your goal date.",
              },
              {
                step: "2",
                title: "Practice with AI",
                description: "Speak aloud and get instant feedback on accuracy and hesitation.",
              },
              {
                step: "3",
                title: "Master It",
                description: "AI gradually reduces text to cue words as you improve.",
              },
            ].map((item, i) => (
              <div 
                key={i}
                className="flex gap-6 items-start p-6 rounded-xl bg-card border animate-slide-up"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-lg text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl lg:text-5xl font-bold">
              Ready to Speak with Confidence?
            </h2>
            <p className="text-xl text-muted-foreground">
              Join Dryrun today and never worry about forgetting your lines again.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="text-lg px-8"
              >
                Start Practicing Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Dryrun. Master your speech with AI.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
