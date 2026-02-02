import React from "react";
import { View, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colours } from "../theme/colours";

export function StarRating(props: {
  value?: number; // 1-5
  onChange: (next?: number) => void;
  size?: number;
  showLabel?: boolean;
}) {
  const size = props.size ?? 22;
  const value = props.value ?? 0;

  const set = (n: number) => {
    // tap same star to clear
    if (value === n) props.onChange(undefined);
    else props.onChange(n);
  };

  return (
    <View style={styles.row}>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= value;
          return (
            <Pressable
              key={n}
              onPress={() => set(n)}
              hitSlop={8}
              style={({ pressed }) => [pressed ? { opacity: 0.75 } : null]}
            >
              <Ionicons
                name={filled ? "star" : "star-outline"}
                size={size}
                color={filled ? "#FFD166" : Colours.text.muted}
              />
            </Pressable>
          );
        })}
      </View>

      {props.showLabel ? (
        <Text style={styles.label}>
          {value ? `${value}/5` : "Not rated"}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  stars: { flexDirection: "row", gap: 6 },
  label: { color: Colours.text.muted, fontWeight: "800" },
});
