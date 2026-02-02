import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";

import { AppHeader } from "../components/AppHeader";
import { Colours } from "../theme/colours";
import { apiGet } from "../lib/api";
import type { GigsResponse, Gig } from "../shared/types/Gig";

function statLine(label: string, value: string) {
  return (
    <View style={styles.statRow} key={label}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function computeProfileStats(gigs: Gig[]) {
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

  const cities = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.city ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topCity = Object.entries(cities).sort((a, b) => b[1] - a[1])[0]?.[0];

  const venues = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.venue ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topVenue = Object.entries(venues).sort((a, b) => b[1] - a[1])[0]?.[0];

  const artists = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.artist ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topArtist =
    Object.entries(artists).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Simple “badges” similar to the Replit look (static logic, looks good now)
  const badges: Array<{ title: string; subtitle: string }> = [];

  if (total >= 1) badges.push({ title: "First Gig", subtitle: "Logged 1 gig" });
  if (total >= 5) badges.push({ title: "Gig Regular", subtitle: "5+ gigs" });
  if (total >= 10) badges.push({ title: "Scene Member", subtitle: "10+ gigs" });

  if (rated.length >= 3)
    badges.push({ title: "Reviewer", subtitle: "Rated 3+ gigs" });

  if (Object.keys(cities).length >= 3)
    badges.push({ title: "Explorer", subtitle: "3+ cities" });

  return {
    total,
    ratedCount: rated.length,
    avgRating,
    topCity,
    topVenue,
    topArtist,
    badges: badges.slice(0, 6),
  };
}

function ActionRow(props: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={!props.onPress}
      style={({ pressed }) => [
        styles.actionRow,
        pressed ? { opacity: 0.9 } : null,
        !props.onPress ? { opacity: 0.6 } : null,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{props.title}</Text>
        {props.subtitle ? (
          <Text style={styles.actionSubtitle}>{props.subtitle}</Text>
        ) : null}
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function ProfileScreen(props: { onPressLogo?: () => void }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [stats, setStats] = React.useState<ReturnType<
    typeof computeProfileStats
  > | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<GigsResponse>("/gigs");
      const s = computeProfileStats(res.gigs ?? []);
      setStats(s);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load profile");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const displayName = "Nowar"; // placeholder until auth
  const handle = "@wegig"; // placeholder
  const location = stats?.topCity ? `Usually in ${stats.topCity}` : "—";

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader title="Profile" onPressLogo={props.onPressLogo} />

      <ScrollView contentContainerStyle={styles.body}>
        {/* Top identity card */}
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayName.slice(0, 1).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.handle}>{handle}</Text>
            <Text style={styles.location}>{location}</Text>
          </View>
        </View>

        {/* Loading / error */}
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            {/* Stats grid (Replit-style tiles) */}
            <View style={styles.grid}>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Total gigs</Text>
                <Text style={styles.tileValue}>{stats?.total ?? 0}</Text>
              </View>

              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Rated</Text>
                <Text style={styles.tileValue}>{stats?.ratedCount ?? 0}</Text>
              </View>

              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Avg rating</Text>
                <Text style={styles.tileValue}>
                  {stats?.avgRating == null ? "—" : stats.avgRating}
                </Text>
              </View>

              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Top artist</Text>
                <Text style={styles.tileValueSmall}>
                  {stats?.topArtist ?? "—"}
                </Text>
              </View>
            </View>

            {/* Details card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Highlights</Text>

              <View style={{ marginTop: 10 }}>
                {statLine("Top city", stats?.topCity ?? "—")}
                {statLine("Top venue", stats?.topVenue ?? "—")}
              </View>
            </View>

            {/* Badges card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Badges</Text>

              <View style={styles.badgeWrap}>
                {(stats?.badges ?? []).length === 0 ? (
                  <Text style={styles.muted}>
                    Log a few gigs to unlock badges.
                  </Text>
                ) : (
                  (stats?.badges ?? []).map((b) => (
                    <View style={styles.badge} key={b.title}>
                      <Text style={styles.badgeTitle}>{b.title}</Text>
                      <Text style={styles.badgeSubtitle}>{b.subtitle}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Settings-ish actions (Replit style list) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Account</Text>

              <View style={{ marginTop: 10 }}>
                <ActionRow
                  title="Edit profile"
                  subtitle="Name, handle, bio (next)"
                  onPress={() => {
                    // placeholder
                  }}
                />
                <ActionRow
                  title="Notifications"
                  subtitle="Push settings (next)"
                  onPress={() => {
                    // placeholder
                  }}
                />
                <ActionRow
                  title="Export gigs"
                  subtitle="CSV / share (next)"
                  onPress={() => {
                    // placeholder
                  }}
                />
                <ActionRow
                  title="About WeGig"
                  subtitle="Version, links (next)"
                  onPress={() => {
                    // placeholder
                  }}
                />
              </View>
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colours.background.app },

  body: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },

  heroCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
    alignItems: "center",
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: Colours.brand.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 22,
  },

  name: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 18,
  },
  handle: {
    marginTop: 2,
    color: Colours.text.muted,
    fontWeight: "800",
  },
  location: {
    marginTop: 6,
    color: Colours.text.secondary,
    fontWeight: "700",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  tile: {
    width: "48%",
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
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
    fontSize: 22,
  },
  tileValueSmall: {
    marginTop: 10,
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 14,
  },

  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },
  cardTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 16,
  },

  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colours.ui.border,
  },
  statLabel: {
    color: Colours.text.muted,
    fontWeight: "800",
    flex: 1,
  },
  statValue: {
    color: Colours.text.primary,
    fontWeight: "900",
  },

  badgeWrap: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badge: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
    borderRadius: 16,
    padding: 12,
  },
  badgeTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
  },
  badgeSubtitle: {
    marginTop: 6,
    color: Colours.text.muted,
    fontWeight: "800",
    fontSize: 12,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colours.ui.border,
  },
  actionTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
  },
  actionSubtitle: {
    marginTop: 3,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  chevron: {
    color: Colours.text.muted,
    fontWeight: "900",
    fontSize: 18,
  },

  muted: { color: Colours.text.muted, fontWeight: "800" },
  error: { color: Colours.text.danger, fontWeight: "900" },
});
