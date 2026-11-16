import React from "react";
import { ActivityIndicator, Alert, BackHandler, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colours } from "../theme/colours";
import { FoundingSupporterBadge } from "../components/FoundingSupporterBadge";

export const SUPPORT_OPTIONS = [
  { key: "small", amount: 2 },
  { key: "medium", amount: 5 },
  { key: "large", amount: 10 },
  { key: "extra1", amount: 1 },
  { key: "extra20", amount: 20 },
  { key: "extra50", amount: 50 },
  { key: "extra100", amount: 100 },
] as const;

export type SupportOptionKey = typeof SUPPORT_OPTIONS[number]["key"];
export type SupportStoreProduct = { key: SupportOptionKey; displayPrice: string };
type Props = {
  onBack: () => void;
  products?: SupportStoreProduct[];
  loading?: boolean;
  onPurchase?: (key: SupportOptionKey) => Promise<"verified" | "cancelled" | "pending">;
};

export function SupportWeGigScreen({ onBack, products = [], loading = false, onPurchase }: Props) {
  const [selected, setSelected] = React.useState<SupportOptionKey>("medium");
  const [expanded, setExpanded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [complete, setComplete] = React.useState(false);
  const inFlight = React.useRef(false);
  const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!inFlight.current) onBack();
      return true;
    });
    return () => handler.remove();
  }, [onBack]);

  const product = products.find((item) => item.key === selected);
  const preview = products.length === 0;
  const price = (key: SupportOptionKey) => products.find((item) => item.key === key)?.displayPrice
    ?? (preview ? `£${SUPPORT_OPTIONS.find((item) => item.key === key)!.amount}` : "Unavailable");

  const purchase = async () => {
    if (!onPurchase || !product || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await onPurchase(selected);
      if (!mounted.current) return;
      if (result === "verified") setComplete(true);
      else if (result === "pending") Alert.alert("Payment pending", "Your support will be confirmed once your payment is approved.");
    } catch {
      if (mounted.current) Alert.alert("Payment not completed", "We couldn't confirm your payment. Please try again later.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const amountButton = (key: SupportOptionKey, extra = false) => (
    <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: selected === key, disabled: busy || (!preview && !products.some((item) => item.key === key)) }}
      accessibilityLabel={`Support WeGig with ${price(key)}`} disabled={busy || (!preview && !products.some((item) => item.key === key))}
      onPress={() => setSelected(key)} style={({ pressed }) => [styles.amount, extra && styles.extraAmount, selected === key && styles.selected, pressed && styles.pressed]}>
      <Text style={styles.amountText}>{price(key)}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {!complete && <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" disabled={busy} onPress={onBack} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" color="white" size={25} />
        </Pressable>
        <Text style={styles.headerTitle}>Support WeGig</Text>
      </View>}
      <ScrollView contentContainerStyle={[styles.body, complete && styles.thankBody]}>
        {complete ? <>
          <View style={styles.wordmark}><Image source={require("../../assets/logo-symbol-transparent.png")} style={styles.logo} /><Text style={styles.heroTitle}>WeGig</Text></View>
          <Text accessibilityRole="header" style={styles.thankTitle}>Thank you</Text>
          <Text style={styles.copy}>Your support means a lot and helps keep WeGig independent.</Text>
          <View style={styles.badgeSpace}><FoundingSupporterBadge /></View>
          <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.primary, styles.returnButton, pressed && styles.pressed]}><Text style={styles.primaryText}>Back to Profile</Text></Pressable>
        </> : <>
          <View style={styles.wordmark}><Text style={styles.heroTitle}>Back</Text><Image source={require("../../assets/logo-symbol-transparent.png")} style={styles.logo} /><Text style={styles.heroTitle}>WeGig</Text></View>
          <Text style={styles.copy}>A one-person project built for gig lovers.{"\n"}If you’re enjoying it, chip in to help keep it independent.</Text>
          <View style={styles.amountRow}>{SUPPORT_OPTIONS.slice(0, 3).map((item) => amountButton(item.key))}</View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} disabled={busy} onPress={() => setExpanded(!expanded)} style={styles.other}>
            <Text style={styles.otherText}>Other amount{!expanded && selected.startsWith("extra") ? ` · ${price(selected)}` : ""}</Text>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={19} color="white" />
          </Pressable>
          {expanded && <View style={styles.extraRow}>{SUPPORT_OPTIONS.slice(3).map((item) => amountButton(item.key, true))}</View>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !product || !onPurchase || loading || busy, busy }} disabled={!product || !onPurchase || loading || busy} onPress={() => void purchase()}
            style={({ pressed }) => [styles.primary, (!product || !onPurchase || loading || busy) && styles.disabled, pressed && styles.pressed]}>
            {busy || loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Continue with {price(selected)}</Text>}
          </Pressable>
          <Text style={styles.note}>One-off contribution. No subscription.{"\n"}Completely optional.</Text>
          {!loading && (!onPurchase || !products.length) && <Text accessibilityRole="alert" style={styles.availability}>Support payments aren’t available yet.</Text>}
          <View style={styles.badgeSpace}><FoundingSupporterBadge /></View>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colours.background.app },
  header: { minHeight: 56, justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderBottomColor: Colours.ui.divider, paddingHorizontal: 52 },
  back: { position: "absolute", left: 16, minHeight: 44, minWidth: 32, justifyContent: "center" },
  headerTitle: { color: "white", fontWeight: "700", fontSize: 19 },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 42, paddingBottom: 108, maxWidth: 520, width: "100%", alignSelf: "center" },
  thankBody: { paddingTop: 70 },
  wordmark: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 22 },
  logo: { width: 47, height: 52, resizeMode: "contain" },
  heroTitle: { color: "white", fontSize: 33, fontWeight: "700" },
  copy: { color: Colours.text.secondary, fontSize: 17, textAlign: "center", lineHeight: 26, marginBottom: 32 },
  amountRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  extraRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  amount: { flexGrow: 1, flexBasis: "26%", paddingHorizontal: 5, minHeight: 58, paddingVertical: 15, borderWidth: 1, borderColor: Colours.ui.borderStrong, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colours.background.card },
  extraAmount: { flexBasis: "45%" },
  selected: { borderColor: Colours.brand.primary, backgroundColor: "rgba(47,140,255,0.13)" },
  amountText: { color: "white", fontSize: 21, fontWeight: "700", textAlign: "center" },
  other: { flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colours.ui.borderStrong, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 17, backgroundColor: Colours.background.card },
  otherText: { color: "white", fontSize: 17, fontWeight: "600", flexShrink: 1 },
  primary: { minHeight: 58, backgroundColor: Colours.brand.primary, borderRadius: 14, justifyContent: "center", alignItems: "center", padding: 16, marginTop: 28 },
  primaryText: { color: "white", fontWeight: "700", fontSize: 18, textAlign: "center" },
  note: { color: Colours.text.secondary, textAlign: "center", fontSize: 13, lineHeight: 20, marginTop: 18 },
  availability: { color: Colours.text.muted, textAlign: "center", marginTop: 12, fontSize: 13 },
  badgeSpace: { marginTop: 30, marginBottom: 20 },
  thankTitle: { color: "white", fontSize: 36, fontWeight: "700", textAlign: "center", marginVertical: 16 },
  returnButton: { marginTop: "auto" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
