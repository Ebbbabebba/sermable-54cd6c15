import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Practice = lazy(() => import("./pages/Practice"));
const Presentation = lazy(() => import("./pages/Presentation"));
const SpeechDetail = lazy(() => import("./pages/SpeechDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const PaymentSettings = lazy(() => import("./pages/PaymentSettings"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const Help = lazy(() => import("./pages/Help"));
const SharedSpeech = lazy(() => import("./pages/SharedSpeech"));
const DeleteAccountRequest = lazy(() => import("./pages/DeleteAccountRequest"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
