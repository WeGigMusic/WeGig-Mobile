import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colours } from "../theme/colours";

export function ProfileBadge(props: {
  title: string;
  icon: string;
  unlocked?: boolean;
}) {
  return (
    <View
      style={[
        styles.badge,
        props.unlocked ? styles.badgeOn : styles.badgeOff,
      ]}
    >
      <Text style={styles.icon}>{props.icon}</Text>
      <Text style={styles.text}>{props.title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
  },
  badgeOn: {
    backgroundColor: "rgba(47,140,255,0.18)",
    borderColor: "rgba(47,140,255,0.45)",
  },
  badgeOff: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: Colours.ui.border,
    opacity: 0.5,
  },
  icon: {
    marginRight: 6,
    fontSize: 13,
  },
  text: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 12,
  },
});