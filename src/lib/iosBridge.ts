// iOS WebView bridge for native In-App Purchases.
//
// On iOS, Apple requires digital subscriptions to be sold through StoreKit IAP.
// The native iOS app (Swift) registers a WKScriptMessageHandler named "iapHandler"
// that listens for "buyMonthly" / "buyYearly" / "fetchPrices" messages.
//
// For localized prices, the native side calls back via:
//   window.__iapPrices = { monthly: "99 kr", yearly: "799 kr" }
//   window.dispatchEvent(new CustomEvent("iap-prices-updated"))
//
// On the web (and on Android), this bridge is absent.

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        iapHandler?: {
          postMessage: (message: string) => void;
        };
      };
    };
    __iapPrices?: {
      monthly?: string;
      yearly?: string;
    };
  }
}

/**
 * True when the app is running inside the native iOS WebView with the
 * StoreKit IAP bridge available.
 */
export function isIOSNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.webkit?.messageHandlers?.iapHandler);
}

export type IAPMessage = "buyMonthly" | "buyYearly" | "fetchPrices";

/**
 * Trigger a native In-App Purchase via the iOS bridge.
 * Caller should first check `isIOSNativeApp()`.
 */
export function triggerNativeIAP(message: IAPMessage): void {
  window.webkit?.messageHandlers?.iapHandler?.postMessage(message);
}

/**
 * Read the localized prices the native iOS app pushed onto window.
 * Returns undefined fields when the native side hasn't responded yet.
 */
export function getNativePrices(): { monthly?: string; yearly?: string } {
  if (typeof window === "undefined") return {};
  return window.__iapPrices ?? {};
}
