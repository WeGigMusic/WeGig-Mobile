import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Colours } from "../theme/colours";

export function LoadingScreen(props: { message?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="small" color={Colours.brand?.primary ?? "#fff"} />
      <Text style={styles.text}>{props.message ?? "Loading…"}</Text>
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