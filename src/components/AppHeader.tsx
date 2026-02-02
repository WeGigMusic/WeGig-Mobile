import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Colours } from "../theme/colours";

export function AppHeader(props: {
  title?: string; // small inline title (optional)
  onPressLogo?: () => void;
  right?: React.ReactNode; // optional right-side action (later)
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

        {props.title ? <Text style={styles.title}>{props.title}</Text> : null}

        <View style={{ flex: 1 }} />

        {props.right ? <View style={styles.right}>{props.right}</View> : null}
      </View>

      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 14,
    backgroundColor: Colours.background.app,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 104,
    height: 26,
  },
  title: {
    color: Colours.text.secondary,
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  right: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  divider: {
    marginTop: 10,
    height: 1,
    backgroundColor: Colours.ui.divider,
  },
});
