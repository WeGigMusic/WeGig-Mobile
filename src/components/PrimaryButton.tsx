import React from "react";
import { Pressable, Text, ViewStyle } from "react-native";

export function PrimaryButton(props: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const disabled = Boolean(props.disabled);

  return (
    <Pressable
      onPress={props.onPress}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? "rgba(0,0,0,0.4)" : "black",
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        alignItems: "center",
        ...(props.style ?? {}),
      }}
    >
      <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>
        {props.title}
      </Text>
    </Pressable>
  );
}
