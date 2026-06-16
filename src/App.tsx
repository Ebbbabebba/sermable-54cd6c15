import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, ComponentType } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Reload once per ~30s when a stale-chunk error happens (new deploy = hashed filenames).
const RELOAD_TS_KEY = "lovable:chunk-reloaded-at";
function isChunkLoadError(msg: string) {
  return (
    msg.includes("Importing a module script failed") ||
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Unable to preload CSS")
  );
}
function reloadForStaleChunk(): Promise<never> {
  if (typeof window !== "undefined") {
    const last = Number(sessionStorage.getItem(RELOAD_TS_KEY) || 0);
    if (Date.now() - last > 30_000) {
      sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
      window.location.reload();
    }
  }
  return new Promise(() => {}) as Promise<never>;
}
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      if (isChunkLoadError(String(err?.message || ""))) {
        return reloadForStaleChunk() as any;
      }
      throw err;
    }
  });
}

// Safety net: stale-chunk errors that escape the lazy boundary (e.g. inside
// React's render) bubble up as window errors / unhandled rejections.
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    if (isChunkLoadError(String(e?.message || ""))) reloadForStaleChunk();
  });
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String((e as any)?.reason?.message || (e as any)?.reason || "");
    if (isChunkLoadError(msg)) reloadForStaleChunk();
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
      <Toaster />
      <Sonner />
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
