// iOS WebView bridge for native In-App Purchases.
//
// On iOS, Apple requires digital subscriptions to be sold through StoreKit IAP.
// The native iOS app (Swift) registers a WKScriptMessageHandler named "iapHandler"
// that listens for "buyMonthly" / "buyYearly" messages and triggers StoreKit.
//
// On the web (and on Android), this bridge is absent and we fall back to Paddle.

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        iapHandler?: {
          postMessage: (message: string) => void;
        };
      };
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

export type IAPProduct = "buyMonthly" | "buyYearly";

/**
 * Trigger a native In-App Purchase via the iOS bridge.
 * Caller should first check `isIOSNativeApp()`.
 */
export function triggerNativeIAP(product: IAPProduct): void {
  window.webkit?.messageHandlers?.iapHandler?.postMessage(product);
}
