import React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  deleteMyAccount,
  getPendingAccountDeletion,
  subscribeToAccountDeletion,
} from "../lib/accountDeletion";

export function AccountDeletionBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pending, setPending] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const running = React.useRef(false);

  const refresh = React.useCallback(async () => {
    try {
      const deletion = await getPendingAccountDeletion();
      setPending(deletion !== null);
      setError("");
    } catch {
      setError("We couldn't check unfinished account deletion. Please retry.");
    }
  }, []);

  const finishDeletion = React.useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");

    try {
      await deleteMyAccount();
      await refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Deletion could not finish. Please retry.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [refresh]);

  React.useEffect(() => {
    const unsubscribe = subscribeToAccountDeletion(() => {
      void refresh();
    });
    void refresh();
    return unsubscribe;
  }, [refresh]);

  React.useEffect(() => {
    if (pending === true) void finishDeletion();
  }, [pending, finishDeletion]);

  if (pending === false) return <>{children}</>;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0B0B0F",
        justifyContent: "center",
        padding: 28,
        gap: 18,
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 23, fontWeight: "700" }}>
        {pending ? "Finishing account deletion" : "Checking your account"}
      </Text>

      <Text style={{ color: "#CCCCCC", fontSize: 15, lineHeight: 22 }}>
        {error ||
          (pending
            ? "Please keep the app open while we remove your account and clear this device."
            : "Checking for unfinished account deletion.")}
      </Text>

      {busy || (!error && pending === null) ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : null}

      {error && !busy ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (pending) void finishDeletion();
            else void refresh();
          }}
          style={{
            backgroundColor: "#2F8CFF",
            padding: 15,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}