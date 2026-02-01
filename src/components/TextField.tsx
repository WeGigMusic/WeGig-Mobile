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
  wrap: { gap: 8 },

  label: {
    color: Colours.text.secondary,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.3,
  },

  input: {
    backgroundColor: Colours.background.card,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: Colours.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },

  multiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },

  focused: {
    borderColor: Colours.brand.primary,
    shadowColor: Colours.brand.primary,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
