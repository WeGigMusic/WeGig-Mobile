import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Colours } from "../theme/colours";

export function Card(props: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, props.style]}>{props.children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },
});