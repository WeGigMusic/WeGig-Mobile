import React from "react";
import { Text, TextInput, View, TextInputProps } from "react-native";

export function TextField(
  props: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    containerStyle?: any;
  } & TextInputProps,
) {
  const { label, value, onChangeText, containerStyle, ...inputProps } = props;

  return (
    <View style={{ gap: 6, ...(containerStyle ?? {}) }}>
      <Text style={{ fontWeight: "700" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={{
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.15)",
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 16,
        }}
        {...inputProps}
      />
    </View>
  );
}
