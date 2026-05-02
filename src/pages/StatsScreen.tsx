import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
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

type BadgeInfo = {
  title: string;
  description: string;
};

const BADGE_INFO: Record<string, BadgeInfo> = {
  "Setlist Opener": {
    title: "Setlist Opener",
    description: "Logged your first gig on WeGig.",
  },
  Soundcheck: {
    title: "Soundcheck",
    description: "Rated your first gig.",
  },
  "Scene Regular": {
    title: "Scene Regular",
    description: "Logged 10 gigs.",
  },
  "Touring the Scene": {
    title: "Touring the Scene",
    description: "Visited 7 different venues.",
  },
  "On Tour": {
    title: "On Tour",
    description: "Logged gigs in 5 different cities.",
  },
  "Die Hard": {
    title: "Die Hard",
    description: "Saw the same artist 5 times.",
  },
  Encore: {
    title: "Encore",
    description: "Rated a gig 5 stars.",
  },
  "Well Tuned": {
    title: "Well Tuned",
    description: "Rated 5 gigs.",
  },
  Headliner: {
    title: "Headliner",
    description: "Logged 20 gigs.",
  },
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

  if (total >= 20) {
    statusLabel = "Headliner";
    statusColor = "#FFB703";
    statusIcon = "🎤";
  } else if (total >= 10) {
    statusLabel = "Scene Regular";
    statusColor = "#8A5BFF";
    statusIcon = "🔥";
  } else if (cityCount >= 5) {
    statusLabel = "On Tour";
    statusColor = "#C0C4CC";
    statusIcon = "🌍";
  } else if (rated.length >= 5) {
    statusLabel = "Well Tuned";
    statusColor = "#2EE59D";
    statusIcon = "🎚️";
  } else if (total >= 1) {
    statusLabel = "Setlist Opener";
    statusColor = "#2F8CFF";
    statusIcon = "🎟️";
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
      title: "Setlist Opener",
      icon: "🎟️",
      unlocked: total >= 1,
      progressLabel: `${Math.min(total, 1)}/1 gigs`,
    },
    {
      title: "Soundcheck",
      icon: "🎧",
      unlocked: rated.length >= 1,
      progressLabel: `${Math.min(rated.length, 1)}/1 rated gigs`,
    },
    {
      title: "Scene Regular",
      icon: "🔥",
      unlocked: total >= 10,
      progressLabel: `${Math.min(total, 10)}/10 gigs`,
    },
    {
      title: "Touring the Scene",
      icon: "🏟️",
      unlocked: venueCount >= 7,
      progressLabel: `${Math.min(venueCount, 7)}/7 venues`,
    },
    {
      title: "On Tour",
      icon: "🌍",
      unlocked: cityCount >= 5,
      progressLabel: `${Math.min(cityCount, 5)}/5 cities`,
    },
    {
      title: "Die Hard",
      icon: "⭐",
      unlocked: topArtistCount >= 5,
      progressLabel: `${Math.min(topArtistCount, 5)}/5 same artist`,
    },
    {
      title: "Encore",
      icon: "🌟",
      unlocked: hasFiveStarGig,
      progressLabel: `${hasFiveStarGig ? 1 : 0}/1 five-star gigs`,
    },
    {
      title: "Well Tuned",
      icon: "🎚️",
      unlocked: rated.length >= 5,
      progressLabel: `${Math.min(rated.length, 5)}/5 rated gigs`,
    },
    {
      title: "Headliner",
      icon: "🎤",
      unlocked: total >= 20,
      progressLabel: `${Math.min(total, 20)}/20 gigs`,
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
    onTourProgress: clampProgress(cityCount, 5),
    dieHardProgress: clampProgress(topArtistCount, 5),
    touringProgress: clampProgress(venueCount, 7),
    headlinerProgress: clampProgress(total, 20),
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
        <Text style={styles.statCardSubtitle} numberOfLines={2}>
          {props.subtitle}
        </Text>
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

function AchievementPill(
  props: BadgeDef & {
    onLongPress?: () => void;
  },
) {
  return (
    <Pressable
      onLongPress={props.onLongPress}
      delayLongPress={320}
      style={({ pressed }) => [
        styles.badgePill,
        props.unlocked ? styles.badgePillOn : styles.badgePillOff,
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      <Text style={styles.badgePillText}>
        {props.icon} {props.title}
      </Text>
    </Pressable>
  );
}

function BadgeInfoModal(props: {
  visible: boolean;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
      statusBarTranslucent
    >
      <Pressable onPress={props.onClose} style={styles.badgeModalOverlay}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={styles.badgeModalCard}
        >
          <Text style={styles.badgeModalTitle}>{props.title}</Text>
          <Text style={styles.badgeModalDescription}>{props.description}</Text>
          <Text style={styles.badgeModalHint}>Tap outside to close</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function StatsScreen(props: {
  onPressLogo?: () => void;
  scrollToTopSignal?: number;
}) {
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const scrollRef = React.useRef<ScrollView>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [gigs, setGigs] = React.useState<Gig[]>([]);
  const [selectedBadgeInfo, setSelectedBadgeInfo] =
    React.useState<BadgeInfo | null>(null);

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

  React.useEffect(() => {
    if (props.scrollToTopSignal == null) return;

    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }, [props.scrollToTopSignal]);

  const stats = React.useMemo(() => buildStats(gigs), [gigs]);

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader onPressLogo={props.onPressLogo} scrollY={scrollY} />

      <AnimatedScrollView
        ref={scrollRef}
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
                        stats.topArtist[1] === 1 ? "gig" : "gigs"
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
                label="Headliner"
                valueText={`${Math.min(stats.total, 20)}/20 gigs`}
                progress={stats.headlinerProgress}
                tint="#FFB703"
              />
              <ProgressRow
                label="On Tour"
                valueText={`${Math.min(stats.cityCount, 5)}/5 cities`}
                progress={stats.onTourProgress}
                tint="#C0C4CC"
              />
              <ProgressRow
                label="Die Hard"
                valueText={`${Math.min(stats.topArtistCount, 5)}/5 same artist`}
                progress={stats.dieHardProgress}
                tint="#FFD166"
              />
              <ProgressRow
                label="Touring the Scene"
                valueText={`${Math.min(stats.venueCount, 7)}/7 venues`}
                progress={stats.touringProgress}
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
                    const width =
                      maxCount > 0 ? (item.count / maxCount) * 100 : 0;

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
                  onLongPress={() =>
                    setSelectedBadgeInfo(
                      BADGE_INFO[badge.title] ?? {
                        title: badge.title,
                        description: "Badge progress from your gig history.",
                      },
                    )
                  }
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

      <BadgeInfoModal
        visible={!!selectedBadgeInfo}
        title={selectedBadgeInfo?.title ?? ""}
        description={selectedBadgeInfo?.description ?? ""}
        onClose={() => setSelectedBadgeInfo(null)}
      />
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
    gap: 10,
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
    padding: 12,
  },

  heroKicker: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.15,
  },

  heroTitle: {
    marginTop: 4,
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 18,
    lineHeight: 22,
  },

  heroSubtitle: {
    marginTop: 2,
    color: Colours.text.secondary,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 18,
  },

  sectionTitle: {
    marginTop: 6,
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
    padding: 10,
    minHeight: 110,
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
    fontSize: 16,
    lineHeight: 20,
  },

  statCardSubtitle: {
    marginTop: 4,
    color: Colours.text.secondary,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 15,
  },

  progressRow: {
    gap: 8,
    marginBottom: 12,
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
    borderColor: "rgba(255,255,255,0.06)",
    opacity: 0.72,
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
    padding: 12,
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
    fontSize: 15,
    lineHeight: 18,
  },

  nextUnlockText: {
    marginTop: 4,
    color: Colours.text.secondary,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 17,
  },

  badgeModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 120,
  },

  badgeModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    padding: 18,
    backgroundColor: "#17191C",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },

  badgeModalTitle: {
    color: Colours.text.primary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },

  badgeModalDescription: {
    color: Colours.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },

  badgeModalHint: {
    marginTop: 14,
    color: Colours.text.muted,
    fontSize: 12,
    fontWeight: "600",
  },
});