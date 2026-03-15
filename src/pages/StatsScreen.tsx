import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { AppHeader } from "../components/AppHeader";
import { Colours } from "../theme/colours";
import { apiGet } from "../lib/api";
import type { GigsResponse, Gig } from "../shared/types/Gig";

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
  const match = raw.match(/^(\d{4})-\d{2}-\d{2}$/);
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
      unlocked: gigs.some((g) => g.rating === 5),
      progressLabel: gigs.some((g) => typeof g.rating === "number")
        ? `${gigs.some((g) => g.rating === 5) ? 1 : 0}/1 five-star gigs`
        : "0/1 five-star gigs",
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

function HighlightCard(props: {
  emoji: string;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <View style={styles.highlightCard}>
      <Text style={styles.highlightEmoji}>{props.emoji}</Text>
      <Text style={styles.highlightTitle}>{props.title}</Text>
      <Text style={styles.highlightValue}>{props.value}</Text>
      <Text style={styles.highlightSubtitle}>{props.subtitle}</Text>
    </View>
  );
}

function ProgressCard(props: {
  title: string;
  valueText: string;
  progress: number;
  tint: string;
}) {
  return (
    <View style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>{props.title}</Text>
        <Text style={styles.progressValueText}>{props.valueText}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.max(6, props.progress * 100)}%`,
              backgroundColor: props.tint,
            },
          ]}
        />
      </View>
    </View>
  );
}

function AchievementChip(props: BadgeDef) {
  return (
    <View
      style={[
        styles.badgeChip,
        props.unlocked ? styles.badgeChipOn : styles.badgeChipOff,
      ]}
    >
      <Text style={styles.badgeIcon}>{props.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.badgeTitle}>{props.title}</Text>
        {props.progressLabel ? (
          <Text style={styles.badgeMeta}>{props.progressLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

function StatCard(props: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statCardLabel}>{props.label}</Text>
      <Text style={styles.statCardValue}>{props.value}</Text>
    </View>
  );
}

export function StatsScreen(props: { onPressLogo?: () => void }) {
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
      <AppHeader onPressLogo={props.onPressLogo} />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
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
              Log your first gig and your live music journey will start to take shape.
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: `${stats.statusColor}18`,
                  borderColor: `${stats.statusColor}40`,
                },
              ]}
            >
              <Text style={styles.heroKicker}>Your live journey</Text>
              <Text style={styles.heroTitle}>
                {stats.statusIcon} You’re a {stats.statusLabel}
              </Text>
              <Text style={styles.heroSubtitle}>
                {stats.total} gigs attended
                {stats.topCity ? ` • ${stats.topCity[0]} is your main scene` : ""}
              </Text>
            </View>

            <SectionTitle title="Highlight moments" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.highlightsScroll}
            >
              <HighlightCard
                emoji="⭐"
                title="Best night"
                value={stats.bestNight ? stats.bestNight.artist : "Still loading..."}
                subtitle={
                  stats.bestNight
                    ? `★ ${stats.bestNight.rating}/5 • ${stats.bestNight.venue}`
                    : "Rate a gig to unlock this"
                }
              />

              <HighlightCard
                emoji="🎤"
                title="Top artist"
                value={stats.topArtist ? stats.topArtist[0] : "—"}
                subtitle={
                  stats.topArtist
                    ? `${stats.topArtist[1]} ${stats.topArtist[1] === 1 ? "show" : "shows"}`
                    : "Log more gigs to reveal this"
                }
              />

              <HighlightCard
                emoji="🌍"
                title="Scene"
                value={stats.topCity ? stats.topCity[0] : "—"}
                subtitle={
                  stats.topCity
                    ? `${stats.topCity[1]} gigs there`
                    : "Your city story starts here"
                }
              />
            </ScrollView>

            <SectionTitle title="Progression goals" />
            <View style={styles.sectionStack}>
              <ProgressCard
                title="Explorer progress"
                valueText={`${Math.min(stats.cityCount, 3)}/3 cities`}
                progress={stats.explorerProgress}
                tint="#C0C4CC"
              />

              <ProgressCard
                title="Superfan progress"
                valueText={`${Math.min(stats.topArtistCount, 3)}/3 same artist`}
                progress={stats.superfanProgress}
                tint="#FFD166"
              />

              <ProgressCard
                title="Venue Hopper"
                valueText={`${Math.min(stats.venueCount, 3)}/3 venues`}
                progress={stats.venueProgress}
                tint="#2F8CFF"
              />
            </View>

            <SectionTitle title="Gig timeline" />
            <View style={styles.timelineCard}>
              {stats.timeline.length > 0 ? (
                stats.timeline.map((item) => (
                  <View key={item.year} style={styles.timelineRow}>
                    <Text style={styles.timelineYear}>{item.year}</Text>
                    <View style={styles.timelineDots}>
                      {Array.from({ length: item.count }).map((_, i) => (
                        <View key={`${item.year}-${i}`} style={styles.timelineDot} />
                      ))}
                    </View>
                    <Text style={styles.timelineCount}>{item.count}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.muted}>No dated gigs yet.</Text>
              )}
            </View>

            <SectionTitle title="Achievements" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.achievementsScroll}
            >
              {stats.badges.map((badge) => (
                <AchievementChip
                  key={badge.title}
                  title={badge.title}
                  icon={badge.icon}
                  unlocked={badge.unlocked}
                  progressLabel={badge.progressLabel}
                />
              ))}
            </ScrollView>

            {stats.nextBadge ? (
              <View style={styles.nextUnlockCard}>
                <Text style={styles.nextUnlockKicker}>Next unlock</Text>
                <Text style={styles.nextUnlockTitle}>
                  {stats.nextBadge.icon} {stats.nextBadge.title}
                </Text>
                <Text style={styles.nextUnlockText}>
                  {stats.nextBadge.progressLabel ?? "Keep logging gigs to unlock this."}
                </Text>
              </View>
            ) : null}

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
          </>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>
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
    gap: 14,
  },

  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },

  muted: {
    color: Colours.text.muted,
    fontWeight: "600",
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
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    backgroundColor: "rgba(47,140,255,0.12)",
  },

  heroKicker: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },

  heroTitle: {
    marginTop: 8,
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 34,
  },

  heroSubtitle: {
    marginTop: 8,
    color: Colours.text.secondary,
    fontWeight: "600",
    fontSize: 15,
    lineHeight: 21,
  },

  sectionTitle: {
    marginTop: 2,
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 18,
    lineHeight: 22,
  },

  highlightsScroll: {
    paddingRight: 8,
  },

  highlightCard: {
    width: 220,
    marginRight: 10,
    backgroundColor: Colours.background.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },

  highlightEmoji: {
    fontSize: 20,
  },

  highlightTitle: {
    marginTop: 10,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  highlightValue: {
    marginTop: 6,
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 24,
  },

  highlightSubtitle: {
    marginTop: 6,
    color: Colours.text.secondary,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 18,
  },

  sectionStack: {
    gap: 10,
  },

  progressCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },

  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  progressTitle: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
  },

  progressValueText: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  progressTrack: {
    marginTop: 12,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  timelineCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
    gap: 12,
  },

  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  timelineYear: {
    width: 44,
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 14,
    lineHeight: 18,
  },

  timelineDots: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: Colours.brand.primary,
  },

  timelineCount: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  achievementsScroll: {
    paddingRight: 8,
  },

  badgeChip: {
    width: 180,
    minHeight: 76,
    marginRight: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },

  badgeChipOn: {
    backgroundColor: "rgba(47,140,255,0.16)",
    borderColor: "rgba(47,140,255,0.38)",
  },

  badgeChipOff: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: Colours.ui.border,
    opacity: 0.55,
  },

  badgeIcon: {
    fontSize: 18,
    marginTop: 1,
  },

  badgeTitle: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 17,
  },

  badgeMeta: {
    marginTop: 5,
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 11,
    lineHeight: 15,
  },

  nextUnlockCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },

  nextUnlockKicker: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  nextUnlockTitle: {
    marginTop: 6,
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 18,
    lineHeight: 22,
  },

  nextUnlockText: {
    marginTop: 6,
    color: Colours.text.secondary,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 18,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  statCard: {
    width: "48%",
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 13,
  },

  statCardLabel: {
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },

  statCardValue: {
    marginTop: 8,
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 24,
  },
});