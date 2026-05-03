// iOS WebView bridge for native In-App Purchases.
//
// On iOS, Apple requires digital subscriptions to be sold through StoreKit IAP.
// The native iOS app (Swift) registers a WKScriptMessageHandler named "iapHandler"
// that listens for "buyMonthly" / "buyYearly" / "fetchPrices" messages.
//
// Native -> Web callbacks the iOS app should make:
//   1. Localized prices:
//      window.__iapPrices = { monthly: "99 kr", yearly: "799 kr" }
//      window.dispatchEvent(new CustomEvent("iap-prices-updated"))
//
//   2. Successful purchase (call this AFTER StoreKit confirms the transaction):
//      window.dispatchEvent(new CustomEvent("iap-purchase-success", {
//        detail: {
//          receipt: "<base64 appStoreReceipt or JWS representation>",
//          productId: "com.ebba.sermable.monthly"
//        }
//      }))
//
//   3. Failed purchase:
//      window.dispatchEvent(new CustomEvent("iap-purchase-failed", {
//        detail: { reason: "userCancelled" | "verificationFailed" | string }
//      }))
//
// On the web (and on Android), this bridge is absent.

import { supabase } from "@/integrations/supabase/client";

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

export interface IAPPurchaseDetail {
  receipt: string;
  productId?: string;
}

export interface IAPVerifyResult {
  success: boolean;
  tier?: string;
  active?: boolean;
  environment?: "live" | "sandbox";
  error?: string;
}

/**
 * True when the app is running inside the native iOS WebView with the
 * StoreKit IAP bridge available.
 */
export function isIOSNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.webkit?.messageHandlers?.iapHandler);
}

export type IAPMessage = "buyMonthly" | "buyYearly" | "fetchPrices" | "restorePurchases";

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

/**
 * Send the App Store receipt to the backend for verification and tier upgrade.
 * Called automatically by `installPurchaseListener` when the native side
 * dispatches an `iap-purchase-success` event.
 */
export async function verifyApplePurchase(
  detail: IAPPurchaseDetail,
): Promise<IAPVerifyResult> {
  if (!detail?.receipt) {
    return { success: false, error: "Missing receipt" };
  }

  const { data, error } = await supabase.functions.invoke("verify-apple-iap", {
    body: {
      receipt_data: detail.receipt,
      product_id: detail.productId,
    },
  });

  if (error) {
    console.error("verify-apple-iap invoke error", error);
    return { success: false, error: error.message };
  }
  return data as IAPVerifyResult;
}

type Listener = (result: IAPVerifyResult, detail: IAPPurchaseDetail) => void;

/**
 * Install a one-time listener that auto-verifies Apple receipts whenever
 * the native side dispatches `iap-purchase-success`. Returns a cleanup fn.
 */
export function installPurchaseListener(onComplete?: Listener): () => void {
  const handler = async (e: Event) => {
    const detail = (e as CustomEvent<IAPPurchaseDetail>).detail;
    if (!detail?.receipt) {
      console.warn("iap-purchase-success fired without receipt");
      return;
    }
    const result = await verifyApplePurchase(detail);
    onComplete?.(result, detail);
  };
  window.addEventListener("iap-purchase-success", handler as EventListener);
  return () => window.removeEventListener("iap-purchase-success", handler as EventListener);
}
