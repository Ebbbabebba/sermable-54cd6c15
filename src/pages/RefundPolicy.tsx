import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const RefundPolicy = () => {
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
          <h1>Refund Policy</h1>
          <p className="text-muted-foreground">Last updated: April 15, 2026</p>

          <h2>30-Day Money-Back Guarantee</h2>
          <p>
            We want you to be fully satisfied with Sermable. If you're not happy with your purchase,
            you can request a full refund within <strong>30 days</strong> of your order date — no questions asked.
          </p>

          <h2>How to Request a Refund</h2>
          <p>
            All payments are processed by our reseller, <strong>Paddle.com</strong>, who is the Merchant of Record
            for all Sermable orders. To request a refund:
          </p>
          <ol>
            <li>
              Visit{" "}
              <a href="https://paddle.net" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                paddle.net
              </a>{" "}
              and locate your transaction.
            </li>
            <li>Follow the instructions to submit a refund request.</li>
          </ol>
          <p>
            Alternatively, you can contact our support team at{" "}
            <a href="mailto:support@sermable.com" className="text-primary hover:underline">
              support@sermable.com
            </a>{" "}
            and we will help you process the refund.
          </p>

          <h2>Refund Processing</h2>
          <p>
            Once approved, refunds are typically processed within 5–10 business days. The refund will be
            returned to the original payment method used for the purchase.
          </p>

          <h2>After the Refund Period</h2>
          <p>
            After the 30-day refund window, you can still cancel your subscription at any time.
            Cancellations take effect at the end of your current billing period — you will retain
            access to premium features until then.
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
