import { supabase } from "../lib/supabase";
import { requireApiBaseUrl } from "../config/env";
import { SupportApiError, type Store, type StorePurchase, type SupportStatus, type Verification } from "./purchases";
async function request<T>(userId: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  if (!data.session || data.session.user.id !== userId) throw new SupportApiError("ACCOUNT_CHANGED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${requireApiBaseUrl().replace(/\/+$/, "")}/support/${path}`, {
      method: body === undefined ? "GET" : "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    if (!response.ok) throw new SupportApiError(typeof result.code === "string" ? result.code : "UNAVAILABLE");
    return result as T;
  } finally { clearTimeout(timer); }
}
export const getSupportStatus = (userId: string) => request<SupportStatus>(userId, "status");
export const verifySupportPurchase = (userId: string, store: Store, purchase: StorePurchase) => request<Verification>(userId, "verify", {
  platform: store, productId: purchase.productId,
  ...(store === "apple" ? { transactionId: purchase.id } : { purchaseToken: purchase.purchaseToken }),
});
