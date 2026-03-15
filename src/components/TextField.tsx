import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
} from "react-native";
import { Colours } from "../theme/colours";

export function TextField({
  label,
  multiline,
  style,
  ...props
}: TextInputProps & { label: string }) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={Colours.text.muted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          focused ? styles.focused : null,
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },

  label: {
    color: Colours.text.secondary,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },

  input: {
    backgroundColor: Colours.background.card,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: Colours.text.primary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "400",
  },

  multiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },

  focused: {
    borderColor: Colours.brand.primary,
    shadowColor: Colours.brand.primary,
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
});