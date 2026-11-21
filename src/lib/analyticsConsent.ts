import { supabase } from "./supabase";

export const ANALYTICS_CONSENT_VERSION = 1;

export async function readAnalyticsConsent(userId: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("analytics_consent")
    .select("accepted, consent_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.consent_version !== ANALYTICS_CONSENT_VERSION) return null;
  return data.accepted === true;
}

export async function saveAnalyticsConsent(userId: string, accepted: boolean): Promise<void> {
  const { error } = await supabase.from("analytics_consent").upsert({
    user_id: userId,
    accepted,
    consent_version: ANALYTICS_CONSENT_VERSION,
  }, { onConflict: "user_id" });
  if (error) throw error;
}
