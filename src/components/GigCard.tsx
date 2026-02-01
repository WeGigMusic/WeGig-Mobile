import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colours } from "../theme/colours";
import type { Gig } from "../shared/types/Gig";
import { Ionicons } from "@expo/vector-icons";

export function GigCard({ gig }: { gig: Gig }) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.artist} numberOfLines={1}>
          {gig.artist}
        </Text>

        {gig.rating ? (
          <View style={styles.pill}>
            <Ionicons name="star" size={14} color={Colours.text.primary} />
            <Text style={styles.pillText}>{gig.rating}/5</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={14} color={Colours.text.muted} />
        <Text style={styles.meta} numberOfLines={1}>
          {gig.venue} • {gig.city}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={14} color={Colours.text.muted} />
        <Text style={styles.date}>{gig.date}</Text>
      </View>

      {gig.notes ? (
        <Text style={styles.notes} numberOfLines={3}>
          {gig.notes}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  artist: {
    flex: 1,
    color: Colours.text.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colours.background.cardStrong,
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },
  pillText: { color: Colours.text.primary, fontWeight: "800", fontSize: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  meta: { flex: 1, color: Colours.text.secondary, fontWeight: "700" },
  date: { color: Colours.text.muted, fontWeight: "700" },
  notes: { marginTop: 10, color: Colours.text.secondary, lineHeight: 18 },
});
