import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  FlatList,
  ActivityIndicator,
} from "react-native";

import { apiGet } from "../lib/api";
import type { Gig, GigsResponse } from "../shared/types/Gig";

import { PrimaryButton } from "../components/PrimaryButton";
import { GigCard } from "../components/GigCard";

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
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "800" }}>Gigs</Text>
        <Text style={{ opacity: 0.6 }}>{data ? `${data.count}` : ""}</Text>
        <View style={{ flex: 1 }} />
        <PrimaryButton title="Refresh" onPress={load} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
          <Text style={{ color: "crimson" }}>{error}</Text>
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
    </SafeAreaView>
  );
}
