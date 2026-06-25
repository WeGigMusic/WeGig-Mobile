import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colours } from "../theme/colours";

export function OfflineBanner(props: {
  isOnline: boolean;
  queuedCount: number;
  syncing?: boolean;
  justSynced?: boolean;
}) {
  const { isOnline, queuedCount, syncing, justSynced } = props;
  const insets = useSafeAreaInsets();

  if (isOnline && queuedCount === 0 && !syncing && !justSynced) {
    return null;
  }

  let title = "";
  let subtitle = "";

  if (!isOnline) {
    title = "🎸 Backstage mode";
    subtitle =
      queuedCount > 0
        ? `${queuedCount} gig${queuedCount === 1 ? "" : "s"} queued — we'll sync when you're back online`
        : "Keep logging gigs — we'll sync when you're back online";
  } else if (syncing) {
    title = "🎛️ Syncing the setlist";
    subtitle =
      queuedCount > 0
        ? `Sending ${queuedCount} queued gig${queuedCount === 1 ? "" : "s"}`
        : "Sending queued gigs";
  } else if (justSynced) {
    title = "✅ All synced";
    subtitle = "Your queued gigs made it to the stage";
  } else if (queuedCount > 0) {
    title = "🎟️ Gigs queued";
    subtitle = `${queuedCount} gig${queuedCount === 1 ? "" : "s"} waiting to sync`;
  }

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
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