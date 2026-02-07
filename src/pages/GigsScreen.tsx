// src/pages/GigsScreen.tsx
import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";

import { AppHeader } from "../components/AppHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { GigCard } from "../components/GigCard";
import { EditGigScreen } from "./EditGigScreen";

import { apiGet } from "../lib/api";
import { Colours } from "../theme/colours";
import type { Gig, GigsResponse } from "../shared/types/Gig";

export function GigsScreen(props: { onPressLogo?: () => void }) {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [data, setData] = React.useState<GigsResponse | null>(null);

  // ✅ Optional: tap a gig → open Edit screen
  const [selectedGig, setSelectedGig] = React.useState<Gig | null>(null);

  const load = React.useCallback(async () => {
    setError("");
    try {
      const res = await apiGet<GigsResponse>("/gigs");
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load gigs");
      setData(null);
    }
  }, []);

  React.useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ✅ If a gig is selected, show editor instead of list
  if (selectedGig) {
    return (
      <EditGigScreen
        gig={selectedGig}
        onPressLogo={() => {
          setSelectedGig(null);
          props.onPressLogo?.();
        }}
        onDone={() => {
          setSelectedGig(null);
          void load(); // refresh after save/delete
        }}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colours.background.app }}>
      <AppHeader title="Gigs" onPressLogo={props.onPressLogo} />

      <View style={{ flex: 1, padding: 16 }}>
        {/* Top row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: Colours.text.primary }}>
            Gigs
          </Text>

          <Text style={{ opacity: 0.6, color: Colours.text.muted, fontWeight: "800" }}>
            {data ? `${data.count}` : ""}
          </Text>

          <View style={{ flex: 1 }} />
          <PrimaryButton title="Refresh" onPress={() => void onRefresh()} />
        </View>

        {/* Body */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
            <Text style={{ color: Colours.text.danger, fontWeight: "800" }}>{error}</Text>
            <PrimaryButton title="Try again" onPress={() => void onRefresh()} />
          </View>
        ) : (
          <FlatList<Gig>
            style={{ marginTop: 12 }}
            data={data?.gigs ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => (
              <GigCard
                gig={item}
                onPress={() => setSelectedGig(item)} // ✅ Tap → Edit
              />
            )}
            ListEmptyComponent={
              <View style={{ paddingTop: 30 }}>
                <Text style={{ color: Colours.text.muted, fontWeight: "800" }}>
                  No gigs yet. Add one from the Add tab.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
