import React, { useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Colours } from "../theme/colours";

type LoadingScreenProps = {
  message?: string;
};

const DEFAULT_LOADING_MESSAGES = [
  "Loading…",
  "Almost there",
  "Setting the stage",
];

const shouldUseAltMessage = () => Math.random() < 0.4; // 40% of the time

export function LoadingScreen({ message }: LoadingScreenProps) {
  const resolvedMessage = useMemo(() => {
    if (message) return message;

    // Most of the time → plain "Loading…"
    if (!shouldUseAltMessage()) return "Loading…";

    // Occasionally → subtle variation
    const altMessages = DEFAULT_LOADING_MESSAGES.slice(1);
    const index = Math.floor(Math.random() * altMessages.length);
    return altMessages[index];
  }, [message]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator
        size="small"
        color={Colours.brand?.primary ?? "#fff"}
      />
      <Text style={styles.text}>{resolvedMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Colours.background.app,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  text: {
    color: Colours.text?.primary ?? "#fff",
    fontSize: 14,
    opacity: 0.85,
  },
});