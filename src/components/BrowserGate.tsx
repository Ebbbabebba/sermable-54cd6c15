import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

const PREVIEW_KEY = "sermable_preview_unlock";
const APP_STORE_URL = "https://apps.apple.com/app/sermable/id0000000000";

const detectNative = (): boolean => {
  const url = new URL(window.location.href);
  if (url.searchParams.get("native_app") === "1") return true;

  // 1. Official Capacitor API
  try {
    if (Capacitor?.isNativePlatform?.()) return true;
    const platform = Capacitor?.getPlatform?.();
    if (platform === "ios" || platform === "android") return true;
  } catch {}

  // 2. Global injected by Capacitor's native bridge
  try {
    const w = window as any;
    if (w.Capacitor?.isNativePlatform?.()) return true;
    if (w.Capacitor?.platform && w.Capacitor.platform !== "web") return true;
    if (w.webkit?.messageHandlers?.bridge) return true; // iOS WKWebView bridge
  } catch {}

  // 3. User-agent fallback (Capacitor injects "CapacitorWebView" or similar)
  try {
    const ua = navigator.userAgent || "";
    if (/Capacitor|CapacitorWebView/i.test(ua)) return true;

    const isIosWebKit = /iPhone|iPad|iPod/i.test(ua) && /AppleWebKit/i.test(ua);
    const isKnownBrowser = /Safari|CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
    if (isIosWebKit && !isKnownBrowser) return true;
  } catch {}

  return false;
};

/**
 * Browser gate: when the app is opened in a regular web browser (Safari,
 * Chrome, etc.), show only an "Download on the App Store" page.
 *
 * Bypasses:
 *  - Running inside the native iOS/Android app (Capacitor)
 *  - URL contains ?preview=1 (persisted to localStorage so it survives navigation)
 */
export const BrowserGate = ({ children }: { children: React.ReactNode }) => {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (detectNative()) {
      setAllowed(true);
      return;
    }

    // Preview unlock via ?preview=1 (persisted)
    const url = new URL(window.location.href);
    if (url.searchParams.get("preview") === "1") {
      try {
        localStorage.setItem(PREVIEW_KEY, "1");
      } catch {}
      setAllowed(true);
      return;
    }

    let stored = false;
    try {
      stored = localStorage.getItem(PREVIEW_KEY) === "1";
    } catch {}

    // Re-check native shortly in case Capacitor injects late
    if (!stored) {
      const t = setTimeout(() => {
        if (detectNative()) setAllowed(true);
        else setAllowed(false);
      }, 300);
      return () => clearTimeout(t);
    }

    setAllowed(stored);
  }, []);

  if (allowed === null) return null;
  if (allowed) return <>{children}</>;

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
          Sermable is available as an iOS app. Download it from the App Store to
          get started.
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
