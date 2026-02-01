import React from "react";
import { SafeAreaView, StyleSheet, ViewStyle } from "react-native";
import { Colours } from "../../theme/colours";

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <SafeAreaView style={[styles.container, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colours.background.primary,
    padding: 16,
  },
});
