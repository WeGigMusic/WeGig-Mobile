import React from "react";
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { readStoreAgeSignal, type StoreAgeSignal } from "../lib/storeAgeSignals";
import { supabase } from "../lib/supabase";

export function ageAccessMessage(signal: StoreAgeSignal): string | null {
  switch (signal.status) {
    case "not-required":
      return null;
    case "unavailable":
      return signal.required ? "We couldn’t check your age range. Please try again." : null;
    case "verification-required":
      return "Open Google Play to finish checking your age, then return to WeGig.";
    case "not-shared":
      return "Share your age range through your app store to continue.";
    case "shared": {
      const { upperBound, significantChangeStatus } = signal.ageRange;
      if (upperBound !== null && upperBound < 13) return "You need to be 13 or older to use WeGig.";
      if (significantChangeStatus === "PENDING" || significantChangeStatus === "DECLINED") {
        return "Ask your parent or guardian to review WeGig in Google Play.";
      }
      return null;
    }
  }
}

export function StoreAgeGate({ children }: React.PropsWithChildren) {
  const [signal, setSignal] = React.useState<StoreAgeSignal | null>(null);
  const [checking, setChecking] = React.useState(true);
  const checkingRef = React.useRef(false);
  const alive = React.useRef(false);

  const check = React.useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    try {
      const next = await readStoreAgeSignal();
      if (alive.current) {
        setSignal(previous => {
          // A transient store failure must not clear a known restriction.
          if (previous && next.status === "unavailable" && !next.required && ageAccessMessage(previous)) {
            return previous;
          }
          return next;
        });
      }
    } finally {
      checkingRef.current = false;
      if (alive.current) setChecking(false);
    }
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

  const message = signal && ageAccessMessage(signal);
  if (signal && !message) return <>{children}</>;

  const open = (url: string) => void Linking.openURL(url).catch(() => undefined);
  return (
    <View style={styles.container}>
      {!signal ? <ActivityIndicator accessibilityLabel="Checking WeGig access" color="white" /> : <>
        <Text accessibilityRole="header" style={styles.title}>WeGig access</Text>
        <Text accessibilityRole="alert" style={styles.message}>{message}</Text>
        {Platform.OS === "android" && signal.status === "verification-required" && (
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
