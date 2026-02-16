import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";

import { AppHeader } from "../components/AppHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { GigCard } from "../components/GigCard";
import { apiGet } from "../lib/api";
import { Colours } from "../theme/colours";
import type { Gig, GigsResponse } from "../shared/types/Gig";

function computeArtistStats(gigs: Gig[]) {
  const total = gigs.length;

  const rated = gigs.filter((g) => typeof g.rating === "number") as Array<
    Gig & { rating: number }
  >;

  const avgRating =
    rated.length === 0
      ? null
      : Math.round(
          (rated.reduce((sum, g) => sum + g.rating, 0) / rated.length) * 10,
        ) / 10;

  const venues = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.venue ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topVenue = Object.entries(venues).sort((a, b) => b[1] - a[1])[0]?.[0];

  const cities = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.city ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topCity = Object.entries(cities).sort((a, b) => b[1] - a[1])[0]?.[0];

  return { total, avgRating, topVenue, topCity, ratedCount: rated.length };
}

function StatTile(props: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{props.label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>
        {props.value}
      </Text>
    </View>
  );
}

export function ArtistScreen(props: {
  artist: string;
  onBack: () => void;
  onEditGig?: (gig: Gig) => void;
  onPressLogo?: () => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [gigs, setGigs] = React.useState<Gig[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<GigsResponse>("/gigs");
      const artistNorm = props.artist.trim().toLowerCase();
      const filtered = (res.gigs ?? []).filter(
        (g) => (g.artist ?? "").trim().toLowerCase() === artistNorm,
      );
      setGigs(filtered);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load artist gigs");
      setGigs([]);
    } finally {
      setLoading(false);
    }
  }, [props.artist]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const stats = computeArtistStats(gigs);

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader title={props.artist} onPressLogo={props.onPressLogo} />

      <View style={styles.body}>
        {/* Header actions */}
        <View style={styles.headerCard}>
          <PrimaryButton title="← Back" onPress={props.onBack} />
        </View>

        {loading ? (
          <View style={styles.card}>
            <View style={styles.inlineRow}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading…</Text>
            </View>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <View style={{ height: 10 }} />
            <PrimaryButton title="Try again" onPress={load} />
          </View>
        ) : (
          <>
            {/* Stats */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Artist stats</Text>

              <View style={styles.grid}>
                <StatTile label="Total gigs" value={String(stats.total)} />
                <StatTile label="Rated" value={String(stats.ratedCount)} />
                <StatTile
                  label="Avg rating"
                  value={stats.avgRating == null ? "—" : String(stats.avgRating)}
                />
                <StatTile label="Top city" value={stats.topCity ?? "—"} />
                <View style={{ height: 0 }} />
                <View style={{ height: 0 }} />
              </View>

              <View style={styles.divider} />

              <View style={{ gap: 6 }}>
                <Text style={styles.muted}>
                  Top venue:{" "}
                  <Text style={styles.mutedStrong}>{stats.topVenue ?? "—"}</Text>
                </Text>
              </View>
            </View>

            {/* Gigs list */}
            <View style={[styles.card, { paddingBottom: 10 }]}>
              <Text style={styles.sectionTitle}>Gigs</Text>

              {gigs.length === 0 ? (
                <Text style={[styles.muted, { marginTop: 10 }]}>
                  No gigs logged for this artist yet.
                </Text>
              ) : (
                <FlatList
                  style={{ marginTop: 10 }}
                  data={gigs}
                  keyExtractor={(g) => g.id}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  contentContainerStyle={{ paddingBottom: 4 }}
                  renderItem={({ item }) => (
                    <GigCard
                      gig={item}
                      onPress={() => props.onEditGig?.(item)}
                    />
                  )}
                />
              )}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colours.background.app },
  body: { flex: 1, padding: 16, gap: 12, paddingBottom: 28 },

  headerCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },

  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },

  sectionTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 16,
  },

  inlineRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  muted: { color: Colours.text.muted, fontWeight: "800" },
  mutedStrong: { color: Colours.text.secondary, fontWeight: "900" },
  error: { color: Colours.text.danger, fontWeight: "900" },

  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  tile: {
    width: "48%",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 12,
  },
  tileLabel: {
    color: Colours.text.muted,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  tileValue: {
    marginTop: 10,
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 18,
  },

  divider: {
    marginTop: 14,
    marginBottom: 12,
    height: 1,
    backgroundColor: Colours.ui.divider,
  },
});
