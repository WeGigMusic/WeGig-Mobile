import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { AppHeader } from "../components/AppHeader";
import { Colours } from "../theme/colours";
import { apiGet } from "../lib/api";
import type { GigsResponse, Gig } from "../shared/types/Gig";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

type BadgeDef = {
  title: string;
  icon: string;
  unlocked: boolean;
  progressLabel?: string;
};

function avg(nums: number[]) {
  if (nums.length === 0) return null;
  const s = nums.reduce((a, b) => a + b, 0);
  return Math.round((s / nums.length) * 10) / 10;
}

function parseGigYear(value?: string) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})/);
  return match ? match[1] : null;
}

function clampProgress(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

function buildStats(gigs: Gig[]) {
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

  const byVenue = gigs.reduce<Record<string, number>>((acc, g) => {
    const key = (g.venue ?? "").trim() || "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const byArtist = gigs.reduce<Record<string, number>>((acc, g) => {
    const key = (g.artist ?? "").trim() || "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const cityEntries = Object.entries(byCity).sort((a, b) => b[1] - a[1]);
  const venueEntries = Object.entries(byVenue).sort((a, b) => b[1] - a[1]);
  const artistEntries = Object.entries(byArtist).sort((a, b) => b[1] - a[1]);

  const topCity = cityEntries[0] ?? null;
  const topVenue = venueEntries[0] ?? null;
  const topArtist = artistEntries[0] ?? null;

  const cityCount = cityEntries.length;
  const venueCount = venueEntries.length;
  const topArtistCount = topArtist?.[1] ?? 0;
  const hasFiveStarGig = gigs.some((g) => g.rating === 5);

  let statusLabel = "New Fan";
  let statusColor = "#6B7280";
  let statusIcon = "✨";

  if (total >= 10) {
    statusLabel = "Scene Member";
    statusColor = "#8A5BFF";
    statusIcon = "⚡";
  } else if (cityCount >= 3) {
    statusLabel = "Explorer";
    statusColor = "#C0C4CC";
    statusIcon = "🌍";
  } else if (rated.length >= 5) {
    statusLabel = "Reviewer";
    statusColor = "#2EE59D";
    statusIcon = "📝";
  } else if (total >= 5) {
    statusLabel = "Regular";
    statusColor = "#2F8CFF";
    statusIcon = "🔥";
  }

  const bestNight =
    [...rated].sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return String(b.date).localeCompare(String(a.date));
    })[0] ?? null;

  const years = gigs.reduce<Record<string, number>>((acc, g) => {
    const year = parseGigYear(g.date);
    if (!year) return acc;
    acc[year] = (acc[year] ?? 0) + 1;
    return acc;
  }, {});

  const timeline = Object.entries(years)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, count]) => ({ year, count }));

  const badges: BadgeDef[] = [
    {
      title: "First Gig",
      icon: "🎟️",
      unlocked: total >= 1,
      progressLabel: `${Math.min(total, 1)}/1 gigs`,
    },
    {
      title: "Origin Story",
      icon: "🌱",
      unlocked: total >= 1,
      progressLabel: `${Math.min(total, 1)}/1 gigs`,
    },
    {
      title: "That One Night",
      icon: "✨",
      unlocked: rated.length >= 1,
      progressLabel: `${Math.min(rated.length, 1)}/1 rated gigs`,
    },
    {
      title: "Regular",
      icon: "🔥",
      unlocked: total >= 5,
      progressLabel: `${Math.min(total, 5)}/5 gigs`,
    },
    {
      title: "Venue Hopper",
      icon: "🏟️",
      unlocked: venueCount >= 3,
      progressLabel: `${Math.min(venueCount, 3)}/3 venues`,
    },
    {
      title: "City Explorer",
      icon: "🌍",
      unlocked: cityCount >= 3,
      progressLabel: `${Math.min(cityCount, 3)}/3 cities`,
    },
    {
      title: "Superfan",
      icon: "⭐",
      unlocked: topArtistCount >= 3,
      progressLabel: `${Math.min(topArtistCount, 3)}/3 same artist`,
    },
    {
      title: "Five-Star Night",
      icon: "🌟",
      unlocked: hasFiveStarGig,
      progressLabel: `${hasFiveStarGig ? 1 : 0}/1 five-star gigs`,
    },
    {
      title: "Critic",
      icon: "📝",
      unlocked: rated.length >= 5,
      progressLabel: `${Math.min(rated.length, 5)}/5 rated gigs`,
    },
  ];

  const nextBadge = badges.find((b) => !b.unlocked) ?? null;

  return {
    total,
    ratedCount: rated.length,
    avgRating,
    cityCount,
    venueCount,
    topCity,
    topVenue,
    topArtist,
    topArtistCount,
    bestNight,
    timeline,
    badges,
    nextBadge,
    statusLabel,
    statusColor,
    statusIcon,
    explorerProgress: clampProgress(cityCount, 3),
    superfanProgress: clampProgress(topArtistCount, 3),
    venueProgress: clampProgress(venueCount, 3),
  };
}

function SectionTitle(props: { title: string }) {
  return <Text style={styles.sectionTitle}>{props.title}</Text>;
}

function StatCard(props: { label: string; value: string; subtitle?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statCardLabel}>{props.label}</Text>
      <Text style={styles.statCardValue} numberOfLines={2}>
        {props.value}
      </Text>
      {props.subtitle ? (
        <Text style={styles.statCardSubtitle}>{props.subtitle}</Text>
      ) : null}
    </View>
  );
}

function ProgressRow(props: {
  label: string;
  valueText: string;
  progress: number;
  tint: string;
}) {
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressRowHeader}>
        <Text style={styles.progressLabel}>{props.label}</Text>
        <Text style={styles.progressValue}>{props.valueText}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width:
                props.progress <= 0
                  ? "0%"
                  : `${Math.max(8, props.progress * 100)}%`,
              backgroundColor: props.tint,
            },
          ]}
        />
      </View>
    </View>
  );
}

function AchievementPill(props: BadgeDef) {
  return (
    <View
      style={[
        styles.badgePill,
        props.unlocked ? styles.badgePillOn : styles.badgePillOff,
      ]}
    >
      <Text style={styles.badgePillText}>
        {props.icon} {props.title}
      </Text>
    </View>
  );
}

export function StatsScreen(props: { onPressLogo?: () => void }) {
  const scrollY = React.useRef(new Animated.Value(0)).current;

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

  const stats = React.useMemo(() => buildStats(gigs), [gigs]);

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader onPressLogo={props.onPressLogo} scrollY={scrollY} />

      <AnimatedScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading your journey…</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : gigs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No stats yet</Text>
            <Text style={styles.emptyText}>
              Log your first gig to start building your live music story.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroKicker}>Your journey</Text>
              <Text style={styles.heroTitle}>
                {stats.statusIcon} {stats.statusLabel}
              </Text>
              <Text style={styles.heroSubtitle}>
                {stats.total} gigs attended
                {stats.topCity ? ` • ${stats.topCity[0]}` : ""}
              </Text>
            </View>

            <SectionTitle title="Key stats" />
            <View style={styles.statsGrid}>
              <StatCard
                label="Top artist"
                value={stats.topArtist ? stats.topArtist[0] : "—"}
                subtitle={
                  stats.topArtist
                    ? `${stats.topArtist[1]} ${
                        stats.topArtist[1] === 1 ? "show" : "shows"
                      }`
                    : "Log more gigs"
                }
              />
              <StatCard
                label="Favourite venue"
                value={stats.topVenue ? stats.topVenue[0] : "—"}
                subtitle={
                  stats.topVenue
                    ? `${stats.topVenue[1]} visits`
                    : "No favourite yet"
                }
              />
              <StatCard
                label="Main scene"
                value={stats.topCity ? stats.topCity[0] : "—"}
                subtitle={
                  stats.topCity
                    ? `${stats.topCity[1]} gigs there`
                    : "Your city story starts here"
                }
              />
              <StatCard
                label="Best night"
                value={stats.bestNight ? stats.bestNight.artist : "—"}
                subtitle={
                  stats.bestNight
                    ? `★ ${stats.bestNight.rating}/5 • ${stats.bestNight.venue}`
                    : "Rate a gig to unlock this"
                }
              />
            </View>

            <SectionTitle title="Progress" />
            <View style={styles.card}>
              <ProgressRow
                label="Explorer"
                valueText={`${Math.min(stats.cityCount, 3)}/3 cities`}
                progress={stats.explorerProgress}
                tint="#C0C4CC"
              />
              <ProgressRow
                label="Superfan"
                valueText={`${Math.min(stats.topArtistCount, 3)}/3 same artist`}
                progress={stats.superfanProgress}
                tint="#FFD166"
              />
              <ProgressRow
                label="Venue Hopper"
                valueText={`${Math.min(stats.venueCount, 3)}/3 venues`}
                progress={stats.venueProgress}
                tint="#2F8CFF"
              />
            </View>

            <SectionTitle title="By the numbers" />
            <View style={styles.statsGrid}>
              <StatCard label="Total gigs" value={String(stats.total)} />
              <StatCard label="Rated gigs" value={String(stats.ratedCount)} />
              <StatCard
                label="Avg rating"
                value={stats.avgRating == null ? "—" : String(stats.avgRating)}
              />
              <StatCard label="Cities visited" value={String(stats.cityCount)} />
            </View>

            {stats.timeline.length > 0 ? (
              <>
                <SectionTitle title="Timeline" />
                <View style={styles.card}>
                  {stats.timeline.map((item) => {
                    const maxCount = Math.max(
                      ...stats.timeline.map((entry) => entry.count),
                    );
                    const width = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

                    return (
                      <View key={item.year} style={styles.timelineRow}>
                        <Text style={styles.timelineYear}>{item.year}</Text>
                        <View style={styles.timelineBarTrack}>
                          <View
                            style={[
                              styles.timelineBarFill,
                              { width: `${Math.max(width, 8)}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.timelineCount}>{item.count}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            <SectionTitle title="Achievements" />
            <View style={styles.badgesWrap}>
              {stats.badges.map((badge) => (
                <AchievementPill
                  key={badge.title}
                  title={badge.title}
                  icon={badge.icon}
                  unlocked={badge.unlocked}
                  progressLabel={badge.progressLabel}
                />
              ))}
            </View>

            {stats.nextBadge ? (
              <View style={styles.nextUnlockCard}>
                <Text style={styles.nextUnlockKicker}>Next unlock</Text>
                <Text style={styles.nextUnlockTitle}>
                  {stats.nextBadge.icon} {stats.nextBadge.title}
                </Text>
                <Text style={styles.nextUnlockText}>
                  {stats.nextBadge.progressLabel ??
                    "Keep logging gigs to unlock this."}
                </Text>
              </View>
            ) : null}
          </>
        )}

        <View style={{ height: 110 }} />
      </AnimatedScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colours.background.app,
  },

  body: {
    padding: 16,
    paddingTop: 12,
    gap: 12,
  },

  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },

  muted: {
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 18,
  },

  error: {
    color: Colours.text.danger,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
    marginTop: 12,
  },

  emptyWrap: {
    marginTop: 48,
    alignItems: "center",
    paddingHorizontal: 20,
  },

  emptyTitle: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 24,
  },

  emptyText: {
    marginTop: 10,
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  heroCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    padding: 14,
  },

  heroKicker: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.15,
  },

  heroTitle: {
    marginTop: 6,
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 24,
  },

  heroSubtitle: {
    marginTop: 4,
    color: Colours.text.secondary,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 18,
  },

  sectionTitle: {
    marginTop: 4,
    color: Colours.text.secondary,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
  },

  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    padding: 14,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  statCard: {
    width: "48%",
    backgroundColor: Colours.background.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    padding: 12,
  },

  statCardLabel: {
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },

  statCardValue: {
    marginTop: 6,
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 18,
    lineHeight: 22,
  },

  statCardSubtitle: {
    marginTop: 4,
    color: Colours.text.secondary,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 16,
  },

  progressRow: {
    gap: 8,
    marginBottom: 14,
  },

  progressRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  progressLabel: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 17,
  },

  progressValue: {
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
  },

  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  timelineYear: {
    width: 42,
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 17,
  },

  timelineBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },

  timelineBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colours.brand.primary,
  },

  timelineCount: {
    width: 20,
    textAlign: "right",
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
  },

  badgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },

  badgePillOn: {
    backgroundColor: "rgba(47,140,255,0.12)",
    borderColor: "rgba(47,140,255,0.22)",
  },

  badgePillOff: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.05)",
    opacity: 0.6,
  },

  badgePillText: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  nextUnlockCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    padding: 14,
  },

  nextUnlockKicker: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 14,
  },

  nextUnlockTitle: {
    marginTop: 6,
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 16,
    lineHeight: 20,
  },

  nextUnlockText: {
    marginTop: 4,
    color: Colours.text.secondary,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 17,
  },
});