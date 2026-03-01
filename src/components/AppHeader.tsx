import React from "react";
import { View, Image, Pressable, StyleSheet } from "react-native";
import { Colours } from "../theme/colours";

export function AppHeader(props: {
  onPressLogo?: () => void;
  right?: React.ReactNode;
}) {
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
          <Image
            source={require("../../assets/wegig-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
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
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: Colours.background.app,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 44, // consistent header height
  },

  logoBtn: {
    justifyContent: "center",
  },

  // Slightly inflated but still within header bounds
  logo: {
    width: 120,  // was 104
    height: 30,  // was 26
  },

  spacer: {
    flex: 1,
  },

  right: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  divider: {
    marginTop: 12,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colours.ui.divider,
  },
}); 