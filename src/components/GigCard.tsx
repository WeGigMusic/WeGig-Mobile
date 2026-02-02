import React from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Colours } from "../theme/colours";
import type { Gig } from "../shared/types/Gig";

export function GigCard({
  gig,
  onPress,
}: {
  gig: Gig;
  onPress: () => void;
}) {
  const handlePress = async () => {
    // subtle tap feedback like Replit
    await Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={styles.artist}>{gig.artist}</Text>

      <Text style={styles.meta}>
        {gig.venue} • {gig.city}
      </Text>

      <Text style={styles.date}>{gig.date}</Text>

      {gig.rating ? (
        <Text style={styles.rating}>★ {gig.rating}/5</Text>
      ) : null}

      {gig.notes ? <Text style={styles.notes}>{gig.notes}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },
  pressed: {
    opacity: 0.85,
  },
  artist: {
    color: Colours.text.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  meta: {
    marginTop: 4,
    color: Colours.text.secondary,
    fontWeight: "600",
  },
  date: {
    marginTop: 4,
    color: Colours.text.muted,
    fontWeight: "600",
  },
  rating: {
    marginTop: 10,
    color: Colours.text.primary,
    fontWeight: "800",
  },
  notes: {
    marginTop: 8,
    color: Colours.text.secondary,
  },
});
