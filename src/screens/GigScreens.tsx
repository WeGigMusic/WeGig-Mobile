import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { apiGet } from "../lib/api";
import type { Gig, GigsResponse } from "../types/gig";

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
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Gigs</Text>
        <Text style={{ opacity: 0.6 }}>{data ? `${data.count}` : ""}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={load}
          style={{
            backgroundColor: "black",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
          <Text style={{ color: "crimson" }}>{error}</Text>
          <Pressable
            onPress={load}
            style={{
              backgroundColor: "black",
              padding: 12,
              borderRadius: 12,
              alignItems: "center",
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList<Gig>
          data={data?.gigs ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View
              style={{
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.1)",
                borderRadius: 14,
                padding: 12,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700" }}>
                {item.artist}
              </Text>
              <Text style={{ opacity: 0.8 }}>
                {item.venue} • {item.city}
              </Text>
              <Text style={{ opacity: 0.6 }}>{item.date}</Text>
              {item.rating ? (
                <Text style={{ marginTop: 6 }}>⭐ {item.rating}/5</Text>
              ) : null}
              {item.notes ? (
                <Text style={{ marginTop: 6, opacity: 0.8 }}>
                  {item.notes}
                </Text>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
