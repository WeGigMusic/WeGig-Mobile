import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";

type Props = {
  avatars: any[]; // image requires
  extraCount?: number;
};

export function AvatarStack({ avatars, extraCount }: Props) {
  return (
    <View style={styles.row}>
      {avatars.map((img, i) => (
        <Image
          key={i}
          source={img}
          style={[
            styles.avatar,
            i !== 0 && { marginLeft: -10 },
          ]}
        />
      ))}

      {extraCount ? (
        <Text style={styles.extra}>+{extraCount}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#07080A",
  },
  extra: {
    marginLeft: 6,
    color: "#9BA1A6",
    fontWeight: "700",
    fontSize: 12,
  },
});