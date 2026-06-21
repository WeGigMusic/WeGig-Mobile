import React from "react";
import { View, Pressable, StyleSheet, Text, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colours } from "../theme/colours";

export function StarRating(props: {
  value?: number;
  onChange: (next?: number) => void;
  size?: number;
  showLabel?: boolean;
}) {
  const size = props.size ?? 22;
  const value = props.value ?? 0;
  const [preview, setPreview] = React.useState<number | null>(null);
  const activeValue = preview ?? value;

  const anim = React.useRef(
    [1, 2, 3, 4, 5].map(() => new Animated.Value(1)),
  ).current;

  const bump = (idx: number) => {
    anim[idx].stopAnimation();
    anim[idx].setValue(1);

    Animated.spring(anim[idx], {
      toValue: 1.12,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(anim[idx], {
        toValue: 1,
        friction: 6,
        tension: 220,
        useNativeDriver: true,
      }).start();
    });
  };

  const handlePress = (next: number) => {
    props.onChange(value === next ? undefined : next);
  };

  return (
    <View style={styles.row}>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n, i) => {
          const filled = n <= activeValue;
          const isHot = preview === n;

          return (
            <Pressable
              key={n}
              hitSlop={8}
              onPress={() => handlePress(n)}
              onPressIn={() => {
                setPreview(n);
                bump(i);
              }}
              onPressOut={() => setPreview(null)}
              style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}
            >
              <Animated.View
                style={[
                  styles.starWrap,
                  filled ? styles.glow : null,
                  isHot ? styles.glowHot : null,
                  { transform: [{ scale: anim[i] }] },
                ]}
              >
                <Ionicons
                  name={filled ? "star" : "star-outline"}
                  size={size}
                  color={filled ? "#FFD166" : Colours.text.muted}
                />
              </Animated.View>
            </Pressable>
          );
        })}
      </View>

      {props.showLabel ? (
        <Text style={styles.label}>{value ? `${value}/5` : "Not rated"}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  stars: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },

  starWrap: {
    borderRadius: 999,
    padding: 2,
  },

  glow: {
    backgroundColor: "rgba(255, 209, 102, 0.10)",
    shadowColor: "#FFD166",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },

  glowHot: {
    backgroundColor: "rgba(255, 209, 102, 0.18)",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },

  label: {
    color: Colours.text.muted,
    fontWeight: "800",
  },
});