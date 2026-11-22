import React from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import * as Linking from "expo-linking";

type Props = {
  onChoice: (accepted: boolean) => Promise<void>;
  saving: boolean;
};

export default function AnalyticsConsent({ onChoice, saving }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Help make WeGig even better</Text>
      <Text style={styles.body}>Share optional usage analytics to help us improve WeGig? Your choice won’t affect how you use the app.</Text>
      <View style={styles.row}>
        {([true, false] as const).map((accepted) => (
          <Pressable key={String(accepted)} accessibilityRole="button"
            disabled={saving} style={styles.button}
            onPress={() => void onChoice(accepted)}>
            <Text style={styles.buttonText}>{accepted ? "Allow analytics" : "No thanks"}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.caption}>{saving ? "Saving..." : "Change your mind anytime in Profile."}</Text>
      <Text accessibilityRole="link" style={styles.link}
        onPress={() => Alert.alert("How we use your data", "Optional analytics includes app usage, artist and setlist interactions, device and app version, linked to your account ID. You can turn this off anytime in Profile.", [{ text: "Close", style: "cancel" }, { text: "Privacy policy", onPress: () => void Linking.openURL("https://www.wegig.live/privacy/").catch(() => Alert.alert("Unable to open page")) }])}>
        How we use your data
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#15151B", borderRadius: 16, borderWidth: 1, borderColor: "#2A2A34", padding: 14, gap: 10 },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "800", textAlign: "center" },
  body: { color: "#B4B4BE", fontSize: 13, lineHeight: 19, textAlign: "center" },
  row: { flexDirection: "row", gap: 8 },
  button: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "#555555", backgroundColor: "#1D1D24", justifyContent: "center", padding: 8 },
  buttonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textAlign: "center" },
  caption: { color: "#9CA3AF", fontSize: 12, textAlign: "center" },
  link: { color: "#2F8CFF", fontSize: 12, textAlign: "center", paddingVertical: 6, minHeight: 44, textAlignVertical: "center" },
});
