import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colours } from "../theme/colours";

export function OfflineBanner(props: {
  isOnline: boolean;
  queuedCount: number;
  syncing?: boolean;
  justSynced?: boolean;
}) {
  const { isOnline, queuedCount, syncing, justSynced } = props;

  // Don’t show anything if everything is fine
  if (isOnline && queuedCount === 0 && !syncing && !justSynced) return null;

  let title = "";
  let subtitle = "";

  if (!isOnline) {
    title = "Offline";
    subtitle =
      queuedCount > 0
        ? `${queuedCount} gig${queuedCount === 1 ? "" : "s"} queued — will sync when online`
        : "Changes will sync when you're back online";
  } else if (syncing) {
    title = "Syncing…";
    subtitle =
      queuedCount > 0
        ? `Sending ${queuedCount} queued gig${queuedCount === 1 ? "" : "s"}`
        : "Sending queued gigs";
  } else if (justSynced) {
    title = "Synced ✓";
    subtitle = "Queued gigs sent";
  } else if (queuedCount > 0) {
    title = "Queued";
    subtitle = `${queuedCount} gig${queuedCount === 1 ? "" : "s"} waiting to sync`;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  pill: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  title: {
    color: Colours.text.primary,
    fontWeight: "900",
  },
  sub: {
    marginTop: 4,
    color: Colours.text.muted,
    fontWeight: "700",
    lineHeight: 18,
  },
});