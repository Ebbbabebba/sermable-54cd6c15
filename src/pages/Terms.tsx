import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Terms of Use (EULA)</h1>
          <p className="text-muted-foreground">Last updated: May 1, 2026</p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By downloading, installing, or using Sermable ("the Service"), operated by Sermable AB
            ("we", "us", or "our"), you agree to be bound by these Terms of Use. If you do not agree,
            do not use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Sermable is a speech memorization application that helps users practice and memorize speeches
            and presentations using AI-powered learning techniques and spaced repetition.
          </p>

          <h2>3. User Accounts</h2>
          <p>You are responsible for:</p>
          <ul>
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activities that occur under your account</li>
            <li>Notifying us immediately of any unauthorized use</li>
          </ul>

          <h2>4. User Content</h2>
          <p>
            You retain ownership of all speeches, texts, and other content you upload ("User Content").
            By uploading, you grant us a limited license to store, process, and analyze your content
            solely to provide the Service to you.
          </p>

          <h2>5. Subscriptions, Auto-Renewal & Cancellation</h2>
          <p>
            Sermable offers free and paid subscription tiers. Paid subscriptions are sold and processed
            exclusively through Apple's In-App Purchase system on iOS devices. The following terms apply:
          </p>
          <ul>
            <li>
              <strong>Pricing & plans:</strong> Sermable Premium is offered as a monthly or annual
              auto-renewing subscription. Current pricing is displayed in the app prior to purchase
              and in App Store Connect.
            </li>
            <li>
              <strong>Payment:</strong> Payment is charged to your Apple ID account at confirmation
              of purchase.
            </li>
            <li>
              <strong>Auto-renewal:</strong> Your subscription automatically renews unless auto-renew
              is turned off at least 24 hours before the end of the current period. Your account will
              be charged for renewal within 24 hours prior to the end of the current period at the
              then-current subscription price.
            </li>
            <li>
              <strong>Managing & cancelling:</strong> You can manage your subscription and turn off
              auto-renewal by going to your Apple ID Account Settings after purchase
              (Settings → [your name] → Subscriptions on iOS). Cancellation takes effect at the end
              of the current billing period; you retain access to premium features until then.
            </li>
            <li>
              <strong>Refunds:</strong> All refund requests for In-App Purchases are handled by Apple
              in accordance with the Apple Media Services Terms and Conditions. To request a refund,
              visit{" "}
              <a href="https://reportaproblem.apple.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                reportaproblem.apple.com
              </a>.
            </li>
            <li>
              <strong>Free trials:</strong> If a free trial is offered, any unused portion is forfeited
              when you purchase a subscription.
            </li>
          </ul>

          <h2>6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any illegal purpose</li>
            <li>Upload content that infringes on others' intellectual property rights</li>
            <li>Attempt to access other users' accounts or data</li>
            <li>Interfere with or disrupt the Service, including malware or vulnerability probing</li>
            <li>Use automated systems to access the Service without permission</li>
            <li>Engage in fraud, spam, or deceptive practices</li>
          </ul>

          <h2>7. Intellectual Property</h2>
          <p>
            The Service, including its design, features, software, and branding, is owned by Sermable AB
            and protected by intellectual property laws. You are granted a limited, non-exclusive,
            non-transferable right to use the Service within your selected plan.
          </p>

          <h2>8. Disclaimer of Warranties</h2>
          <p>
            The Service is provided "as is" without warranties of any kind. We do not guarantee that the
            Service will be uninterrupted or error-free.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Sermable AB shall not be liable for any indirect,
            incidental, special, or consequential damages. Our aggregate liability is limited to the
            fees you have paid in the preceding 12 months.
          </p>

          <h2>10. Suspension and Termination</h2>
          <p>
            We may suspend or terminate your account for material breach of these Terms, non-payment,
            security or fraud risk, or repeated policy violations. You may delete your account at any
            time through the Settings page.
          </p>

          <h2>11. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use after changes constitutes
            acceptance of the new Terms.
          </p>

          <h2>12. Governing Law</h2>
          <p>
            These Terms are governed by the laws of Sweden. Any disputes shall be resolved in the
            courts of Sweden.
          </p>

          <h2>13. Contact</h2>
          <p>
            For questions about these Terms, contact us at{" "}
            <a href="mailto:support@sermable.com" className="text-primary hover:underline">
              support@sermable.com
            </a>
          </p>
        </article>
      </main>
    </div>
  );
};

export default Terms;
