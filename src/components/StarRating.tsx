import React from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  Animated,
  PanResponder,
  LayoutChangeEvent,
} from "react-native";
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

  // drag preview while finger is down
  const [preview, setPreview] = React.useState<number | null>(null);
  const activeValue = preview ?? value;

  // animation bump per star
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

  // Measure row so we can convert finger X -> star index (1..5)
  const layoutRef = React.useRef<{ x: number; width: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layoutRef.current = { x, width };
  };

  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

  const xToStar = (pageX: number) => {
    const layout = layoutRef.current;
    if (!layout) return null;

    // Convert finger position into a 1..5 bucket across the full row width.
    // We intentionally make the full row act like a slider.
    const localX = pageX - layout.x;
    const t = clamp(localX / layout.width, 0, 0.999999);
    const star = clamp(Math.floor(t * 5) + 1, 1, 5);
    return star;
  };

  const commit = (n: number | null) => {
    if (!n) return;

    // Tap/drag to same rating toggles off
    if (value === n) props.onChange(undefined);
    else props.onChange(n);
  };

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (evt) => {
          const n = xToStar(evt.nativeEvent.pageX);
          if (n) {
            setPreview(n);
            bump(n - 1);
          }
        },

        onPanResponderMove: (evt) => {
          const n = xToStar(evt.nativeEvent.pageX);
          if (!n) return;

          setPreview((prev) => {
            if (prev !== n) bump(n - 1);
            return n;
          });
        },

        onPanResponderRelease: () => {
          commit(preview);
          setPreview(null);
        },

        onPanResponderTerminate: () => {
          setPreview(null);
        },
      }),
    // preview intentionally included so release commits latest
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preview, value],
  );

  return (
    <View style={styles.row}>
      <View
        style={styles.stars}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        {[1, 2, 3, 4, 5].map((n, i) => {
          const filled = n <= activeValue;
          const isHot = preview === n;

          return (
            <Pressable
              key={n}
              hitSlop={10}
              onPress={() => {
                // still allow single-tap without dragging
                if (value === n) props.onChange(undefined);
                else props.onChange(n);
              }}
              onPressIn={() => {
                setPreview(n);
                bump(i);
              }}
              onPressOut={() => {
                // if user just tapped, Pressable handles onPress above
                setPreview(null);
              }}
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
        <Text style={styles.label}>
          {value ? `${value}/5` : "Not rated"}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },

  // IMPORTANT: this is the “slider” zone we measure and drag across
  stars: { flexDirection: "row", gap: 8, paddingVertical: 2 },

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

  label: { color: Colours.text.muted, fontWeight: "800" },
});