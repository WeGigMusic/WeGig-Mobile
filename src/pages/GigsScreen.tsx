import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import { apiGet } from "../lib/api";
import type { Gig, GigsResponse } from "../shared/types/Gig";

import { PrimaryButton } from "../components/PrimaryButton";
import { GigCard } from "../components/GigCard";
import { Colours } from "../theme/colours";
import { AppHeader } from "../components/AppHeader";

export function GigsScreen() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [data, setData] = React.useState<GigsResponse | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<GigsResponse>("/gigs");
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load gigs");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader title="Your gigs" />

      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.count}>{data ? `${data.count} gigs` : ""}</Text>
          <View style={{ flex: 1 }} />
          <PrimaryButton title="Refresh" onPress={load} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ color: Colours.text.danger, fontWeight: "800" }}>
              {error}
            </Text>
            <View style={{ height: 12 }} />
            <PrimaryButton title="Try again" onPress={load} />
          </View>
        ) : (
          <FlatList<Gig>
            style={{ marginTop: 12 }}
            data={data?.gigs ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => <GigCard gig={item} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colours.background.app },
  body: { flex: 1, padding: 16 },
  row: { flexDirection: "row", alignItems: "center" },
  count: { color: Colours.text.muted, fontWeight: "800" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
