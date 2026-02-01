import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle } from "react-native";
import { Colours } from "../theme/colours";

export function PrimaryButton({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colours.brand.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
  text: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 16,
  },
});
