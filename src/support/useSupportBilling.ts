import React from "react";
import { AppState, Platform } from "react-native";
import * as Application from "expo-application";
import type * as Iap from "expo-iap";
import { posthog } from "../lib/analytics";
import { getSupportStatus, verifySupportPurchase } from "./api";
import { createPurchaseProcessor, SUPPORT_KEYS, supportId, type PurchaseResult, type Store, type SupportKey } from "./purchases";

type Pending = { productId: string; resolve: (result: PurchaseResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
export function useSupportBilling(userId: string) {
  const [products, setProducts] = React.useState<Array<{ key: SupportKey; displayPrice: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [isFoundingSupporter, setIsFoundingSupporter] = React.useState(false);
  const [issue, setIssue] = React.useState<string | null>(null);
  const [confirmationOutstanding, setConfirmationOutstanding] = React.useState(false);
  const pending = React.useRef<Pending | null>(null);
  const purchaseRef = React.useRef<((key: SupportKey) => Promise<PurchaseResult>) | null>(null);
  const refreshRef = React.useRef<(() => Promise<void>) | null>(null);

  React.useEffect(() => {
    let alive = true;
    let native: typeof Iap | undefined;
    let removeUpdated: (() => void) | undefined;
    let removeError: (() => void) | undefined;
    let running: Promise<void> | null = null;
    let connected = false;
    let confirmationBlocked = false;
    let confirmationRevision = 0;
    let deliveries = 0;
    const updateConfirmation = (blocked: boolean) => {
      if (blocked) confirmationRevision++;
      confirmationBlocked = blocked;
      setConfirmationOutstanding(blocked);
    };
    const store: Store = Platform.OS === "ios" ? "apple" : "google";
    const originalApp = (Platform.OS === "ios" && Application.applicationId === "com.wegig.mobile") || (Platform.OS === "android" && Application.applicationId === "com.wegig.app");
    const settle = (productId: string | undefined, result?: PurchaseResult, error?: Error) => {
      const current = pending.current;
      if (!current || (productId && current.productId !== productId)) return;
      clearTimeout(current.timer); pending.current = null;
      if (error) current.reject(error);
      else {
        if (result === "verified") {
          posthog.capture("support_purchase_completed", { store });
          void posthog.flush();
        }
        current.resolve(result ?? "cancelled");
      }
    };
    const deferred = (productId?: string) => {
      if (alive) {
        updateConfirmation(true);
        setIssue("Your payment is awaiting approval. It will be checked again when you return to WeGig.");
        settle(productId, "pending");
      }
    };
    let process: ((purchase: Iap.Purchase) => Promise<PurchaseResult | undefined>) | undefined;
    const deliver = async (purchase: Iap.Purchase) => {
      deliveries++;
      try {
        const result = await process?.(purchase);
        if (!alive || !result) return;
        if (result === "pending") {
          updateConfirmation(true);
          setIssue("Your payment is awaiting approval. It will be checked again when you return to WeGig.");
        } else if (!confirmationBlocked) { setIssue(null); }
        settle(purchase.productId, result);
      } catch {
        if (!alive) return;
        updateConfirmation(true);
        setIssue("Your payment still needs confirmation. Retry confirmation before making another contribution.");
        settle(purchase.productId, undefined, new Error("Confirmation delayed"));
      } finally { deliveries--; }
    };
    const refresh = (): Promise<void> => {
      if (running) return running;
      running = (async () => {
        if (alive) { purchaseRef.current = null; setLoading(true); setIssue(null); }
        try {
          const account = await getSupportStatus(userId);
          if (!alive) return;
          setIsFoundingSupporter(account.isFoundingSupporter === true);
          if (!originalApp) { setIssue("Payments will be available in the store version of WeGig. This development app is for previewing the screens."); return; }
          if (!native) native = await import("expo-iap");
          if (!alive) return;
          if (!connected) {
            process = createPurchaseProcessor<Iap.Purchase>({ store, account,
              verify: purchase => verifySupportPurchase(userId, store, purchase),
              finish: purchase => native!.finishTransaction({ purchase, isConsumable: true }),
              onVerified: result => { if (alive) setIsFoundingSupporter(result.isFoundingSupporter === true); },
            });
            removeUpdated?.(); removeError?.();
            const updated = native.purchaseUpdatedListener(purchase => { void deliver(purchase); });
            const errors = native.purchaseErrorListener(error => {
              if (!alive) return;
              if (error.code === native!.ErrorCode.UserCancelled) settle(error.productId, "cancelled");
              else if (error.code === native!.ErrorCode.DeferredPayment || error.code === native!.ErrorCode.Pending) deferred(error.productId);
              else settle(error.productId, undefined, new Error("Store payment unavailable"));
            });
            removeUpdated = () => updated.remove(); removeError = () => errors.remove();
            await native.initConnection();
            if (!alive) { await native.endConnection(); return; }
            connected = true;
          }
          const available = await native.fetchProducts({ skus: SUPPORT_KEYS.map(key => supportId(store, key)), type: "in-app" });
          if (!alive) return;
          const offers = new Map<string, string>();
          setProducts(SUPPORT_KEYS.flatMap(key => {
            const product = available?.find(item => item.id === supportId(store, key) && item.type === "in-app");
            if (!product || product.type !== "in-app") return [];
            const offer = product.platform === "android" ? product.discountOffers?.find(item => !item.id && !item.preorderDetailsAndroid && !item.rentalDetailsAndroid) : undefined;
            if (offer?.offerTokenAndroid) offers.set(product.id, offer.offerTokenAndroid);
            const displayPrice = offer?.displayPrice ?? product.displayPrice;
            return displayPrice ? [{ key, displayPrice }] : [];
          }));
          // StoreKit unfinished transactions include consumables that history omits.
          const revision = confirmationRevision;
          const unfinished = Platform.OS === "ios" ? await native.getPendingTransactionsIOS() : await native.getAvailablePurchases();
          let failed = false;
          let waiting = false;
          for (const purchase of unfinished) {
            try { const result = await process!(purchase); if (result === "pending") waiting = true; if (alive && result) settle(purchase.productId, result); }
            catch { failed = true; }
          }
          if (!alive) return;
          const changedDuringRecovery = revision !== confirmationRevision || deliveries > 0;
          updateConfirmation(failed || waiting || changedDuringRecovery);
          if (changedDuringRecovery && !failed && !waiting) setIssue("Retry confirmation to finish checking outstanding payments.");
          if (waiting) setIssue("Your payment is awaiting approval. It will be checked again when you return to WeGig.");
          if (failed) setIssue("Your payment still needs confirmation. Retry confirmation before making another contribution.");
          purchaseRef.current = async key => {
            if (!alive || pending.current || deliveries > 0 || confirmationBlocked || failed || waiting) throw new Error("Payment unavailable");
            const productId = supportId(store, key);
            const result = new Promise<PurchaseResult>((resolve, reject) => {
              const timer = setTimeout(() => {
                if (!alive) return;
                updateConfirmation(true);
                setIssue("Confirmation is taking longer than expected. Retry confirmation before paying again.");
                settle(productId, undefined, new Error("Confirmation delayed"));
              }, 120000);
              pending.current = { productId, resolve, reject, timer };
            });
            void native!.requestPurchase({ type: "in-app", request: store === "apple"
              ? { apple: { sku: productId, appAccountToken: account.appleAppAccountToken, quantity: 1, andDangerouslyFinishTransactionAutomatically: false } }
              : { google: { skus: [productId], obfuscatedAccountId: account.googleObfuscatedAccountId, offerToken: offers.get(productId) } },
            }).catch(error => {
              if (!alive) return;
              const code = (error as { code?: string })?.code;
              if (code === native!.ErrorCode.UserCancelled) settle(productId, "cancelled");
              else if (code === native!.ErrorCode.DeferredPayment || code === native!.ErrorCode.Pending) deferred(productId);
              else settle(productId, undefined, new Error("Store payment unavailable"));
            });
            return result;
          };
        } catch {
          if (alive) { purchaseRef.current = null; setProducts([]); setIssue("Support payments are unavailable at the moment. Please try again later."); }
        } finally { if (alive) setLoading(false); }
      })().finally(() => { running = null; });
      return running;
    };
    refreshRef.current = refresh;
    void refresh();
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
    return () => {
      alive = false; subscription.remove(); removeUpdated?.(); removeError?.();
      settle(undefined, "cancelled"); purchaseRef.current = null; refreshRef.current = null;
      if (connected) void native?.endConnection().catch(() => {});
    };
  }, [userId]);

  const purchase = React.useCallback(async (key: SupportKey) => {
    if (confirmationOutstanding || !purchaseRef.current) throw new Error("Payment unavailable");
    return purchaseRef.current(key);
  }, [confirmationOutstanding]);
  const retry = React.useCallback(() => { void refreshRef.current?.(); }, []);
  return { products, loading, isFoundingSupporter, issue, retry, confirmationOutstanding,
    onPurchase: !loading && !confirmationOutstanding && products.length ? purchase : undefined };
}
