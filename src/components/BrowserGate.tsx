import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

const APP_STORE_URL = "https://apps.apple.com/app/sermable/id0000000000";

/**
 * Browser gate.
 *
 * The iOS app bundles the web build (no `server.url` in capacitor.config.ts),
 * so it loads from capacitor://localhost and `Capacitor.isNativePlatform()`
 * is always true inside the native app — no race conditions.
 *
 * Anywhere else (Safari, Chrome, the Lovable preview URL, sermable.lovable.app)
 * we show a hard wall pointing to the App Store.
 */
export const BrowserGate = ({ children }: { children: React.ReactNode }) => {
  const [isNative, setIsNative] = useState<boolean | null>(null);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  if (isNative === null) return null;
  if (isNative) return <>{children}</>;

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground px-6 py-12">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight leading-none">
            <span className="block">SERM</span>
            <span className="block text-primary">ABLE</span>
          </h1>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            Memorize. Present. Deliver.
          </p>
        </div>

        <p className="text-base text-muted-foreground">
          Sermable is only available as an iOS app. Download it from the App
          Store to get started.
        </p>

        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background px-6 py-3 text-base font-medium hover:opacity-90 transition-opacity"
          aria-label="Download on the App Store"
        >
          Download on the App Store
        </a>
      </div>
    </main>
  );
};
