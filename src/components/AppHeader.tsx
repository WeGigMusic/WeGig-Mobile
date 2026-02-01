// src/components/AppHeader.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colours } from "../theme/colours";

export function AppHeader({ title }: { title?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <Ionicons name="musical-notes" size={22} color={Colours.brand.primary} />
        <Text style={styles.brand}>WeGig</Text>
      </View>

      {title ? <Text style={styles.title}>{title}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colours.ui.divider,
    backgroundColor: Colours.background.app,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { color: Colours.text.primary, fontWeight: "900", fontSize: 18 },
  title: {
    marginTop: 10,
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 22,
  },
});
