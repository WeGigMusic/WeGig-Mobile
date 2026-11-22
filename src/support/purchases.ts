export const SUPPORT_KEYS = ["small", "medium", "large", "extra1", "extra20", "extra50", "extra100"] as const;
export type SupportKey = typeof SUPPORT_KEYS[number];
export type Store = "apple" | "google";
export type SupportStatus = {
  isFoundingSupporter: boolean;
  isTestSupporter: boolean;
  appleAppAccountToken: string;
  googleObfuscatedAccountId: string;
};
export type Verification = Pick<SupportStatus, "isFoundingSupporter" | "isTestSupporter"> & {
  verified: true;
  environment: "production" | "sandbox";
};
export type StorePurchase = {
  id: string; productId: string; purchaseState: string; purchaseToken?: string | null;
  appAccountToken?: string | null; obfuscatedAccountIdAndroid?: string | null;
};
export function supportId(store: Store, key: SupportKey): string {
  return `${store === "apple" ? "com.wegig.mobile" : "com.wegig.app"}.support.${key}`;
}
export function supportKey(store: Store, id: string): SupportKey | undefined {
  return SUPPORT_KEYS.find(key => supportId(store, key) === id);
}
export class SupportApiError extends Error {
  constructor(readonly code: string) { super("Support confirmation is unavailable"); }
}

export type PurchaseResult = "verified" | "test-verified" | "cancelled" | "pending";

// Deduplicate simultaneous listener/recovery deliveries, but allow later retries
// when verification or store finalisation failed. No receipts are persisted here.
export function createPurchaseProcessor<P extends StorePurchase>(options: {
  store: Store;
  account: SupportStatus;
  verify: (purchase: P) => Promise<Verification>;
  finish: (purchase: P) => Promise<void>;
  onVerified: (result: Verification) => void;
}) {
  const inFlight = new Map<string, Promise<PurchaseResult | undefined>>();
  const finished = new Map<string, PurchaseResult>();
  return (purchase: P): Promise<PurchaseResult | undefined> => {
    if (!supportKey(options.store, purchase.productId)) return Promise.resolve(undefined);
    const binding = options.store === "apple" ? purchase.appAccountToken : purchase.obfuscatedAccountIdAndroid;
    const expected = options.store === "apple" ? options.account.appleAppAccountToken : options.account.googleObfuscatedAccountId;
    if (!binding || binding.toLowerCase() !== expected.toLowerCase()) return Promise.resolve(undefined);
    if (purchase.purchaseState === "pending") return Promise.resolve("pending");
    if (purchase.purchaseState !== "purchased") return Promise.resolve(undefined);
    const identity = options.store === "apple" ? purchase.id : purchase.purchaseToken;
    if (!identity) return Promise.reject(new Error("Missing store confirmation"));
    if (finished.has(identity)) return Promise.resolve(finished.get(identity));
    const existing = inFlight.get(identity);
    if (existing) return existing;
    const operation = (async () => {
      let verified: Verification;
      try {
        verified = await options.verify(purchase);
      } catch (error) {
        if (!(error instanceof SupportApiError)) throw error;
        if (error.code === "PAYMENT_PENDING") return "pending";
        if (error.code !== "PURCHASE_REFUNDED" && error.code !== "PAYMENT_CANCELLED") throw error;
        // A server-confirmed refund or cancellation is terminal and must never grant support or
        // be consumed as a successful purchase.
        return "cancelled";
      }
      if (verified.verified !== true || !["production", "sandbox"].includes(verified.environment)) throw new Error("Payment not verified");
      const result: PurchaseResult = verified.environment === "sandbox" ? "test-verified" : "verified";
      options.onVerified(verified);
      // Only a successful server response permits consuming this repeatable item.
      await options.finish(purchase);
      finished.set(identity, result);
      return result;
    })().finally(() => { inFlight.delete(identity); });
    inFlight.set(identity, operation);
    return operation;
  };
}
