import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function FoundingSupporterBadge() {
  return (
    <View accessible accessibilityLabel="WeGig Founding Supporter" style={styles.wrap}>
      <Ionicons name="sparkles" size={17} color="#E9C65B" />
      <View style={styles.badge}>
        <Image source={require("../../assets/logo-symbol-transparent.png")} style={styles.logo} />
        <Text style={styles.brand}>WeGig</Text>
        <View style={styles.divider} />
        <Text style={styles.label}>Founding Supporter</Text>
      </View>
      <Ionicons name="sparkles" size={17} color="#E9C65B" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" },
  badge: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 7, borderWidth: 1, borderColor: "#E9C65B", borderRadius: 30, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#07080A", maxWidth: "88%" },
  logo: { width: 25, height: 27, resizeMode: "contain" },
  brand: { color: "white", fontSize: 16, fontWeight: "700" },
  divider: { width: 1, height: 20, backgroundColor: "#A88742", marginHorizontal: 3 },
  label: { color: "white", fontSize: 12, fontWeight: "600", flexShrink: 1 },
});
