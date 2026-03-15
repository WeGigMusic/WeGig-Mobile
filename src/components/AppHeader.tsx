import React from "react";
import { View, Image, Pressable, StyleSheet } from "react-native";
import { Colours } from "../theme/colours";

type AppHeaderProps = {
  title?: string;
  onPressLogo?: () => void;
  right?: React.ReactNode;
};

export function AppHeader(props: AppHeaderProps) {
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
          <View style={styles.logoBox}>
            <Image
              source={require("../../assets/wegig-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </Pressable>

        <View style={styles.spacer} />

        {props.right ? <View style={styles.right}>{props.right}</View> : null}
      </View>

      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: Colours.background.app,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
  },

  logoBtn: {
    justifyContent: "center",
  },

  logoBox: {
    height: 36,
    width: 72,
    justifyContent: "center",
    alignItems: "center",
  },

  logo: {
    height: 42,
    width: 72,
  },

  spacer: {
    flex: 1,
  },

  right: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  divider: {
    marginTop: 8,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});