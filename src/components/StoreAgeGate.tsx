import React from "react";
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { readStoreAgeSignal } from "../lib/storeAgeSignals";
import { ageAccessMessage, allowsOptionalAnalytics } from "../lib/storeAgePolicy";
import { stopAnalytics } from "../lib/analytics";
import { supabase } from "../lib/supabase";

export function StoreAgeGate({ children }: { children: (ageAllowsAnalytics: () => Promise<boolean>) => React.ReactNode }) {
  const [decision, setDecision] = React.useState<{ message: string | null; openPlay: boolean } | null>(null);
  const [checking, setChecking] = React.useState(true);
  const checkingRef = React.useRef(false);
  const alive = React.useRef(false);
  const required = React.useRef(false);
  const pending = React.useRef<Promise<boolean>>(Promise.resolve(false));
  const ageAllowsAnalytics = React.useCallback(async () => {
    const check = pending.current;
    const allowed = await check;
    return check === pending.current && allowed;
  }, []);

  const check = React.useCallback(() => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    stopAnalytics();
    setChecking(true);
    pending.current = (async () => {
      try {
        const signal = await readStoreAgeSignal();
        if (!alive.current) return false;
        if (signal.status === "not-required") required.current = false;
        else if (signal.status !== "unavailable" || signal.required) required.current = true;
        const message = ageAccessMessage(signal, required.current);
        const openPlay = signal.status === "verification-required";
        const unavailable = signal.status === "unavailable";
        setDecision(previous => {
          if (previous?.message && unavailable) return previous;
          return { message, openPlay };
        });
        // Play signals are used only for app access. Google prohibits their use for analytics.
        return !message && (Platform.OS !== "ios" || allowsOptionalAnalytics(signal));
      } finally {
        checkingRef.current = false;
        if (alive.current) setChecking(false);
      }
    })();
  }, []);

  React.useEffect(() => {
    alive.current = true;
    void check();
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") void check();
    });
    return () => {
      alive.current = false;
      subscription.remove();
    };
  }, [check]);

  if (decision && !decision.message) return <>{children(ageAllowsAnalytics)}</>;

  const open = (url: string) => void Linking.openURL(url).catch(() => undefined);
  return (
    <View style={styles.container}>
      {!decision ? <ActivityIndicator accessibilityLabel="Checking WeGig access" color="white" /> : <>
        <Text accessibilityRole="header" style={styles.title}>WeGig access</Text>
        <Text accessibilityRole="alert" style={styles.message}>{decision.message}</Text>
        {Platform.OS === "android" && decision.openPlay && (
          <Pressable accessibilityRole="link" onPress={() => open("market://details?id=com.wegig.app")}>
            <Text style={styles.link}>Open Google Play</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" disabled={checking} onPress={() => void check()}>
          <Text style={styles.link}>{checking ? "Checking…" : "Try again"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void supabase.auth.signOut({ scope: "local" })}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => open("https://www.wegig.live/privacy/")}>
          <Text style={styles.link}>Privacy and account deletion</Text>
        </Pressable>
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#0B0B0B" },
  title: { color: "white", fontSize: 24, fontWeight: "700", textAlign: "center" },
  message: { color: "white", fontSize: 16, textAlign: "center" },
  link: { color: "#62A8FF", paddingVertical: 12, textAlign: "center" },
});
