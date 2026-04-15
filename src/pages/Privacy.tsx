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
          <p className="text-muted-foreground">Last updated: April 15, 2026</p>

          <h2>1. Introduction</h2>
          <p>
            Sermable AB ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains
            how we collect, use, and safeguard your information when you use our speech memorization application ("the Service").
            Sermable AB is the data controller for the personal data processed through the Service.
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
            <li>IP address</li>
            <li>Timezone settings</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and improve the speech memorization service</li>
            <li>Personalize your learning experience using AI</li>
            <li>Track your progress and calculate practice streaks</li>
            <li>Send practice reminders (if you enable notifications)</li>
            <li>Ensure security and prevent fraud</li>
            <li>Communicate important updates about the Service</li>
          </ul>

          <h2>4. Legal Basis for Processing</h2>
          <p>We process your personal data based on the following legal grounds:</p>
          <ul>
            <li><strong>Contract performance</strong> — processing your account information, user content, and usage data is necessary to provide the Service to you.</li>
            <li><strong>Legitimate interests</strong> — we process usage data for product improvement, security, and fraud prevention.</li>
            <li><strong>Consent</strong> — we send push notifications and marketing communications only with your consent.</li>
            <li><strong>Legal obligation</strong> — we may process data to comply with applicable laws.</li>
          </ul>

          <h2>5. AI Processing</h2>
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

          <h2>6. Data Storage and Security</h2>
          <p>
            Your data is stored securely using industry-standard encryption and appropriate technical
            and organisational measures, including access controls and encrypted connections. Audio from
            practice sessions is processed in real-time and is not permanently stored on our servers.
          </p>

          <h2>7. Data Sharing</h2>
          <p>We do not sell your personal information. We may share data with:</p>
          <ul>
            <li><strong>Paddle.com</strong> — our Merchant of Record, which processes payments, manages subscriptions, handles tax compliance, and issues invoices on our behalf.</li>
            <li><strong>Service providers</strong> — hosting, analytics, and support tooling providers who assist us in operating the Service.</li>
            <li><strong>Professional advisers</strong> — legal and accounting professionals as needed.</li>
            <li><strong>Legal authorities</strong> — when required by law.</li>
          </ul>

          <h2>8. Your Rights</h2>
          <p>Under applicable data protection law (including GDPR), you have the right to:</p>
          <ul>
            <li><strong>Access</strong> your personal data</li>
            <li><strong>Rectify</strong> inaccurate information</li>
            <li><strong>Erase</strong> your account and all associated data</li>
            <li><strong>Restrict</strong> processing of your data</li>
            <li><strong>Data portability</strong> — receive your data in a portable format</li>
            <li><strong>Object</strong> to processing based on legitimate interests</li>
            <li><strong>Withdraw consent</strong> at any time where processing is based on consent</li>
            <li><strong>Lodge a complaint</strong> with a supervisory authority (in Sweden: Integritetsskyddsmyndigheten, IMY)</li>
          </ul>
          <p>
            We will respond to rights requests within one month. To exercise these rights, contact us at{" "}
            <a href="mailto:support@sermable.com" className="text-primary hover:underline">
              support@sermable.com
            </a>
          </p>

          <h2>9. Data Retention</h2>
          <p>
            We retain your data as long as your account is active. When you delete your account,
            we will delete your personal data within 30 days, except where we are required to retain
            it for legal purposes.
          </p>

          <h2>10. International Transfers</h2>
          <p>
            Your data may be processed outside the EEA. Where this occurs, we ensure appropriate
            safeguards are in place, such as Standard Contractual Clauses (SCCs) or adequacy decisions.
          </p>

          <h2>11. Cookies</h2>
          <p>
            We use essential cookies required for the Service to function (authentication, preferences).
            We do not use third-party advertising cookies. You can manage cookie preferences through your browser settings.
          </p>

          <h2>12. Children's Privacy</h2>
          <p>
            Sermable is not intended for children under 13. We do not knowingly collect information
            from children under 13. If you believe a child has provided us with personal information,
            please contact us.
          </p>

          <h2>13. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant changes
            via email or through the app. The "Last updated" date at the top indicates when the policy was
            last revised.
          </p>

          <h2>14. Contact Us</h2>
          <p>
            Sermable AB<br />
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
