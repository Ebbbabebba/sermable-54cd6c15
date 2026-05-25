import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, ComponentType } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Retry dynamic imports once after a stale-chunk deploy, then hard-reload.
const RELOAD_KEY = "lovable:chunk-reloaded";
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || "");
      const isChunkError =
        msg.includes("Importing a module script failed") ||
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("error loading dynamically imported module");
      if (isChunkError && typeof window !== "undefined") {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);
        if (!alreadyReloaded) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          // Return a never-resolving promise while reload kicks in.
          return new Promise(() => {}) as any;
        }
      }
      throw err;
    }
  });
}

const Index = lazyWithRetry(() => import("./pages/Index"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const Onboarding = lazyWithRetry(() => import("./pages/Onboarding"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Practice = lazyWithRetry(() => import("./pages/Practice"));
const Presentation = lazyWithRetry(() => import("./pages/Presentation"));
const SpeechDetail = lazyWithRetry(() => import("./pages/SpeechDetail"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const PaymentSettings = lazyWithRetry(() => import("./pages/PaymentSettings"));
const AccountSettings = lazyWithRetry(() => import("./pages/AccountSettings"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const RefundPolicy = lazyWithRetry(() => import("./pages/RefundPolicy"));
const Help = lazyWithRetry(() => import("./pages/Help"));
const SharedSpeech = lazyWithRetry(() => import("./pages/SharedSpeech"));
const DeleteAccountRequest = lazyWithRetry(() => import("./pages/DeleteAccountRequest"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/practice/:id" element={<Practice />} />
            <Route path="/presentation/:id" element={<Presentation />} />
            <Route path="/speech/:id" element={<SpeechDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/payment" element={<PaymentSettings />} />
            <Route path="/settings/account" element={<AccountSettings />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/help" element={<Help />} />
            <Route path="/support" element={<Help />} />
            <Route path="/share/:token" element={<SharedSpeech />} />
            <Route path="/delete-account" element={<DeleteAccountRequest />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
