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
          <h1>Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: April 15, 2026</p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Sermable ("the Service"), operated by Sermable AB ("we", "us", or "our"),
            you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Sermable is a speech memorization application that helps users practice and memorize speeches,
            presentations, and other spoken content using AI-powered learning techniques and spaced repetition.
          </p>

          <h2>3. User Accounts</h2>
          <p>
            To use certain features of the Service, you must create an account. You are responsible for:
          </p>
          <ul>
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activities that occur under your account</li>
            <li>Notifying us immediately of any unauthorized use</li>
          </ul>

          <h2>4. User Content</h2>
          <p>
            You retain ownership of all speeches, texts, and other content you upload to the Service ("User Content").
            By uploading User Content, you grant us a limited license to:
          </p>
          <ul>
            <li>Store and process your content to provide the Service</li>
            <li>Use AI to analyze and help you practice your content</li>
            <li>Create practice segments and learning materials from your content</li>
          </ul>
          <p>
            We will never share your User Content with third parties or use it for purposes other than providing the Service to you.
          </p>

          <h2>5. Subscription and Payments</h2>
          <p>
            Sermable offers both free and paid subscription tiers. Our order process is conducted by our online
            reseller <strong>Paddle.com</strong>. Paddle.com is the Merchant of Record for all our orders.
            Paddle provides all customer service inquiries and handles returns.
          </p>
          <p>
            For full details on payment terms, billing, tax, cancellation, and refund mechanics, please refer to{" "}
            <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Paddle's Buyer Terms
            </a>.
          </p>
          <ul>
            <li>Subscriptions automatically renew unless cancelled</li>
            <li>You may cancel your subscription at any time</li>
            <li>Refunds are handled in accordance with our <a href="/refund-policy" className="text-primary hover:underline">Refund Policy</a></li>
          </ul>

          <h2>6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any illegal purpose</li>
            <li>Upload content that infringes on others' intellectual property rights</li>
            <li>Attempt to access other users' accounts or data</li>
            <li>Interfere with or disrupt the Service, including introducing malware or attempting to probe, scan, or test vulnerabilities</li>
            <li>Use automated systems to access the Service without permission</li>
            <li>Engage in fraud, spam, or deceptive practices</li>
          </ul>

          <h2>7. Intellectual Property</h2>
          <p>
            The Service, including its design, features, software, documentation, and branding, is owned by
            Sermable AB and protected by intellectual property laws. You are granted a limited, non-exclusive,
            non-transferable right to use the Service within your selected plan. You may not copy, modify,
            reverse engineer, resell, or distribute any part of the Service without permission.
          </p>

          <h2>8. Disclaimer of Warranties</h2>
          <p>
            The Service is provided "as is" without warranties of any kind, whether express or implied,
            including but not limited to implied warranties of merchantability and fitness for a particular purpose.
            We do not guarantee that the Service will be uninterrupted, error-free, or that it will meet your specific requirements.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Sermable AB shall not be liable for any indirect, incidental,
            special, or consequential damages (including loss of profits, data, or goodwill) arising from your use
            of the Service. Our aggregate liability is limited to the fees you have paid in the preceding 12 months.
          </p>

          <h2>10. Suspension and Termination</h2>
          <p>
            We may suspend or terminate your account at any time for material breach of these Terms, non-payment,
            security or fraud risk, or repeated policy violations. You may also delete your account at any time
            through the Settings page. Upon termination, your data will be deleted within 30 days.
          </p>

          <h2>11. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Sermable AB from any claims arising from your User Content,
            unlawful use of the Service, or violations of these Terms.
          </p>

          <h2>12. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you of significant changes via email
            or through the Service. Continued use after changes constitutes acceptance of the new Terms.
          </p>

          <h2>13. Governing Law</h2>
          <p>
            These Terms are governed by the laws of Sweden. Any disputes shall be resolved in the courts of Sweden.
          </p>

          <h2>14. Contact</h2>
          <p>
            For questions about these Terms, please contact us at{" "}
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
