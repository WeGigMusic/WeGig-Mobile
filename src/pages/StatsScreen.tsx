import React from "react";
import { SafeAreaView, View, Text, StyleSheet } from "react-native";
import { AppHeader } from "../components/AppHeader";
import { Colours } from "../theme/colours";
import { apiGet } from "../lib/api";
import type { GigsResponse, Gig } from "../shared/types/Gig";

function avg(nums: number[]) {
  if (nums.length === 0) return null;
  const s = nums.reduce((a, b) => a + b, 0);
  return Math.round((s / nums.length) * 10) / 10;
}

export function StatsScreen() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [gigs, setGigs] = React.useState<Gig[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<GigsResponse>("/gigs");
      setGigs(res.gigs ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load stats");
      setGigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const total = gigs.length;
  const rated = gigs.filter((g) => typeof g.rating === "number") as Array<
    Gig & { rating: number }
  >;
  const avgRating = avg(rated.map((g) => g.rating));

  const byCity = gigs.reduce<Record<string, number>>((acc, g) => {
    const key = (g.city ?? "").trim() || "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const topCity = Object.entries(byCity).sort((a, b) => b[1] - a[1])[0];

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader title="Stats" />

      <View style={styles.body}>
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <View style={styles.grid}>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Total gigs</Text>
                <Text style={styles.cardValue}>{total}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Rated gigs</Text>
                <Text style={styles.cardValue}>{rated.length}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Avg rating</Text>
                <Text style={styles.cardValue}>
                  {avgRating == null ? "—" : avgRating}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardLabel}>Top city</Text>
                <Text style={styles.cardValue}>
                  {topCity ? `${topCity[0]} (${topCity[1]})` : "—"}
                </Text>
              </View>
            </View>

            <Text style={[styles.muted, { marginTop: 14 }]}>
              Next: we can add “top artists”, “top venues”, streaks, badges, etc.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colours.background.app },
  body: { flex: 1, padding: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "48%",
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },
  cardLabel: { color: Colours.text.muted, fontWeight: "800" },
  cardValue: {
    marginTop: 8,
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 18,
  },
  muted: { color: Colours.text.muted, fontWeight: "700" },
  error: { color: Colours.text.danger, fontWeight: "800" },
});
