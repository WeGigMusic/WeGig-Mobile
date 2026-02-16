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
import { EditGigScreen } from "./EditGigScreen";

import { PrimaryButton } from "../components/PrimaryButton";
import { GigCard } from "../components/GigCard";
import { AppHeader } from "../components/AppHeader";
import { Colours } from "../theme/colours";

export function GigsScreen(props: { onPressLogo?: () => void }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState<GigsResponse | null>(null);
  const [editingGig, setEditingGig] = React.useState<Gig | null>(null);

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

  if (editingGig) {
    return (
      <EditGigScreen
        gig={editingGig}
        onPressLogo={props.onPressLogo}
        onDone={() => {
          setEditingGig(null);
          void load();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colours.background.app }}>
      <AppHeader title="Gigs" onPressLogo={props.onPressLogo} />

      <View style={{ padding: 16, flex: 1 }}>
        {loading && !data ? (
          <ActivityIndicator />
        ) : error ? (
          <>
            <Text style={{ color: Colours.text.danger, fontWeight: "800" }}>
              {error}
            </Text>
            <View style={{ height: 10 }} />
            <PrimaryButton title="Try again" onPress={load} />
          </>
        ) : (
          <FlatList
            data={data?.gigs ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <GigCard gig={item} onPress={() => setEditingGig(item)} />
            )}
            refreshing={loading}
            onRefresh={load}
            ListEmptyComponent={() => (
              <View style={{ alignItems: "center", marginTop: 60, gap: 12 }}>
                <Text
                  style={{
                    color: Colours.text.muted,
                    fontSize: 16,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  No gigs yet 🎶
                </Text>

                <Text
                  style={{
                    color: Colours.text.muted,
                    textAlign: "center",
                    lineHeight: 20,
                  }}
                >
                  Add one manually, or use Discover to prefill faster.
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}