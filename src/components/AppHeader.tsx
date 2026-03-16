import React from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { Colours } from "../theme/colours";

type AppHeaderProps = {
  onPressLogo?: () => void;
  right?: React.ReactNode;
  scrollY?: Animated.Value;
};

export function AppHeader(props: AppHeaderProps) {
  const animatedLogoHeight = props.scrollY
    ? props.scrollY.interpolate({
        inputRange: [-60, 0, 120],
        outputRange: [64, 56, 34],
        extrapolate: "clamp",
      })
    : 56;

  const animatedLogoWidth = props.scrollY
    ? props.scrollY.interpolate({
        inputRange: [-60, 0, 120],
        outputRange: [156, 140, 90],
        extrapolate: "clamp",
      })
    : 140;

  const animatedTranslateY = props.scrollY
    ? props.scrollY.interpolate({
        inputRange: [-60, 0, 120],
        outputRange: [2, 0, 0],
        extrapolate: "clamp",
      })
    : 0;

  const animatedDividerOpacity = props.scrollY
    ? props.scrollY.interpolate({
        inputRange: [0, 40],
        outputRange: [0.2, 1],
        extrapolate: "clamp",
      })
    : 0.2;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={props.onPressLogo}
          disabled={!props.onPressLogo}
          style={({ pressed }) => [
            styles.logoBtn,
            props.onPressLogo ? { opacity: pressed ? 0.85 : 1 } : null,
          ]}
          hitSlop={12}
        >
          <Animated.Image
            source={require("../../assets/wegig-logo.png")}
            resizeMode="contain"
            style={{
              height: animatedLogoHeight,
              width: animatedLogoWidth,
              transform: [{ translateY: animatedTranslateY }],
            }}
          />
        </Pressable>

        <View style={styles.spacer} />

        {props.right ? <View style={styles.right}>{props.right}</View> : null}
      </View>

      <Animated.View
        style={[styles.divider, { opacity: animatedDividerOpacity }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 6,
    paddingBottom: 4,
    paddingHorizontal: 16,
    backgroundColor: Colours.background.app,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
  },

  logoBtn: {
    justifyContent: "center",
  },

  spacer: {
    flex: 1,
  },

  right: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  divider: {
    marginTop: 4,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});