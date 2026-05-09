import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const RefundPolicy = () => {
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
          <h1>Refund Policy</h1>
          <p className="text-muted-foreground">Last updated: May 9, 2026</p>

          <h2>Apple In-App Purchases</h2>
          <p>
            All Sermable subscriptions and purchases are processed through{" "}
            <strong>Apple In-App Purchase</strong>. Apple is the seller of record for these
            transactions, and refunds are handled directly by Apple in accordance with their
            standard policies.
          </p>

          <h2>Refunds Are Not Guaranteed</h2>
          <p>
            Unlike a traditional money-back guarantee, refunds for App Store purchases are{" "}
            <strong>not automatic and not guaranteed</strong>. Apple reviews each request
            individually and decides at their sole discretion whether to issue a refund based
            on their own criteria (for example: accidental purchase, technical issues, or
            unauthorized charges). We cannot override Apple's decision.
          </p>

          <h2>How to Request a Refund from Apple</h2>
          <p>
            To request a refund for a Sermable purchase, follow Apple's official process:
          </p>
          <ol>
            <li>
              Visit{" "}
              <a
                href="https://reportaproblem.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                reportaproblem.apple.com
              </a>{" "}
              and sign in with your Apple ID.
            </li>
            <li>Find the Sermable purchase you'd like to refund.</li>
            <li>Tap "Report a Problem" and select a reason.</li>
            <li>Submit the request — Apple will review and respond by email.</li>
          </ol>
          <p>
            You can also request a refund directly from your iPhone or iPad under{" "}
            <em>Settings → [Your Name] → Media &amp; Purchases → View Account → Purchase History</em>.
          </p>

          <h2>Refund Window</h2>
          <p>
            Apple generally accepts refund requests submitted within <strong>90 days</strong> of
            the purchase date, though approval is always at Apple's discretion. Requests outside
            this window are rarely granted.
          </p>

          <h2>Cancelling Your Subscription</h2>
          <p>
            Cancelling a subscription is separate from requesting a refund. To cancel, go to{" "}
            <em>Settings → [Your Name] → Subscriptions</em> on your Apple device and turn off
            auto-renewal. You'll retain access to premium features until the end of your current
            billing period, but cancelling does not automatically refund the most recent charge.
          </p>

          <h2>Contact</h2>
          <p>
            If you have questions about our refund policy, please contact us at{" "}
            <a href="mailto:support@sermable.com" className="text-primary hover:underline">
              support@sermable.com
            </a>
          </p>
        </article>
      </main>
    </div>
  );
};

export default RefundPolicy;
