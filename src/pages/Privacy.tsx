import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: January 13, 2026</p>

          <h2>1. Introduction</h2>
          <p>
            Sermable ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains 
            how we collect, use, and safeguard your information when you use our speech memorization application.
          </p>

          <h2>2. Information We Collect</h2>
          
          <h3>2.1 Account Information</h3>
          <p>When you create an account, we collect:</p>
          <ul>
            <li>Email address</li>
            <li>Name (optional)</li>
            <li>Authentication credentials</li>
          </ul>

          <h3>2.2 User Content</h3>
          <p>We store the content you upload, including:</p>
          <ul>
            <li>Speeches and presentation texts</li>
            <li>Practice session recordings (processed locally, not stored)</li>
            <li>Practice progress and performance data</li>
          </ul>

          <h3>2.3 Usage Data</h3>
          <p>We automatically collect:</p>
          <ul>
            <li>Practice session statistics</li>
            <li>App usage patterns</li>
            <li>Device information and preferences</li>
            <li>Timezone settings</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and improve the speech memorization service</li>
            <li>Personalize your learning experience using AI</li>
            <li>Track your progress and calculate practice streaks</li>
            <li>Send practice reminders (if you enable notifications)</li>
            <li>Process payments for premium subscriptions</li>
            <li>Communicate important updates about the Service</li>
          </ul>

          <h2>4. AI Processing</h2>
          <p>
            Sermable uses AI to enhance your learning experience. This includes:
          </p>
          <ul>
            <li>Analyzing your speech content to create practice segments</li>
            <li>Providing feedback on your practice sessions</li>
            <li>Adapting difficulty based on your performance</li>
          </ul>
          <p>
            Your speech content is processed securely and is never used to train AI models or shared with third parties.
          </p>

          <h2>5. Data Storage and Security</h2>
          <p>
            Your data is stored securely using industry-standard encryption. We use secure cloud infrastructure 
            to protect your information. Audio from practice sessions is processed in real-time and is not 
            permanently stored on our servers.
          </p>

          <h2>6. Data Sharing</h2>
          <p>We do not sell your personal information. We may share data with:</p>
          <ul>
            <li>Service providers who help us operate the app (e.g., payment processors)</li>
            <li>Legal authorities when required by law</li>
          </ul>

          <h2>7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access</strong> your personal data</li>
            <li><strong>Correct</strong> inaccurate information</li>
            <li><strong>Delete</strong> your account and all associated data</li>
            <li><strong>Export</strong> your data</li>
            <li><strong>Opt out</strong> of marketing communications</li>
          </ul>
          <p>
            To exercise these rights, contact us at{" "}
            <a href="mailto:support@sermable.com" className="text-primary hover:underline">
              support@sermable.com
            </a>
          </p>

          <h2>8. Data Retention</h2>
          <p>
            We retain your data as long as your account is active. When you delete your account, 
            we will delete your personal data within 30 days, except where we are required to retain 
            it for legal purposes.
          </p>

          <h2>9. Children's Privacy</h2>
          <p>
            Sermable is not intended for children under 13. We do not knowingly collect information 
            from children under 13. If you believe a child has provided us with personal information, 
            please contact us.
          </p>

          <h2>10. International Users</h2>
          <p>
            If you are accessing the Service from outside the country where our servers are located, 
            your information may be transferred to and processed in that country. By using the Service, 
            you consent to this transfer.
          </p>

          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant changes 
            via email or through the app. The "Last updated" date at the top indicates when the policy was 
            last revised.
          </p>

          <h2>12. Contact Us</h2>
          <p>
            For questions about this Privacy Policy or our data practices, please contact us at:{" "}
            <a href="mailto:support@sermable.com" className="text-primary hover:underline">
              support@sermable.com
            </a>
          </p>
        </article>
      </main>
    </div>
  );
};

export default Privacy;
