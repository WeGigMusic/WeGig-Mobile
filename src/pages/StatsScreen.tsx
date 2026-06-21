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
  Dimensions,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "../components/AppHeader";
import { Colours } from "../theme/colours";
import { apiGet } from "../lib/api";
import type { GigsResponse, Gig } from "../shared/types/Gig";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.min(190, SCREEN_WIDTH * 0.52);

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

type SpotifyArtistPageResponse = {
  artist: {
    imageUrl: string | null;
  } | null;
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
    description: "Logged 15 gigs.",
  },
  "Scene Fixture": {
    title: "Scene Fixture",
    description: "Logged 30 gigs.",
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
    description: "Logged 50 gigs.",
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

function getGigImageUrl(gig: Gig | null | undefined) {
  if (!gig) return null;

  const candidate =
    (gig as any).artistImageUrl ??
    (gig as any).spotifyArtistImageUrl ??
    (gig as any).spotifyImageUrl ??
    (gig as any).imageUrl ??
    (gig as any).artist?.imageUrl ??
    (gig as any).artist?.images?.[0]?.url ??
    null;

  const value = String(candidate ?? "").trim();
  return value.length > 0 ? value : null;
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
      unlocked: total >= 15,
      progressLabel: `${Math.min(total, 15)}/15 gigs`,
    },
    {
      title: "Scene Fixture",
      icon: "🏟️",
      unlocked: total >= 30,
      progressLabel: `${Math.min(total, 30)}/30 gigs`,
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
      unlocked: total >= 50,
      progressLabel: `${Math.min(total, 50)}/50 gigs`,
    },
  ];

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
    timeline,
    badges,
    onTourProgress: clampProgress(cityCount, 5),
    dieHardProgress: clampProgress(topArtistCount, 5),
    touringProgress: clampProgress(venueCount, 7),
    headlinerProgress: clampProgress(total, 50),
  };
}

function SectionHeader(props: { title: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.bigSectionTitle}>{props.title}</Text>
    </View>
  );
}

function KeyStatCard(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  subtitle?: string;
  imageUrl?: string | null;
imageSource?: any;
tone?: "default" | "gold" | "blue" | "purple";
}) {
  const content = (
    <View style={styles.keyStatInner}>
      <View style={styles.keyStatHeader}>
        <Ionicons name={props.icon} size={14} color={Colours.text.primary} />
        <Text style={styles.keyStatLabel}>{props.label}</Text>
      </View>

      <View style={{ flex: 1 }} />

      <Text style={styles.keyStatValue} numberOfLines={2}>
        {props.value}
      </Text>

      {props.subtitle ? (
        <Text style={styles.keyStatSubtitle} numberOfLines={2}>
          {props.subtitle}
        </Text>
      ) : null}
    </View>
  );

if (props.imageUrl || props.imageSource) {
  return (
    <ImageBackground
      source={props.imageSource ?? { uri: props.imageUrl }}
        style={styles.keyStatCard}
        imageStyle={styles.keyStatImage}
      >
        <View style={styles.imageOverlay} />
        {content}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.keyStatCard, styles[`tone_${props.tone ?? "default"}`]]}>
      {content}
    </View>
  );
}

function LiveStatCard(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.liveStatCard}>
      <View style={styles.liveStatHeader}>
        <Ionicons name={props.icon} size={14} color={Colours.text.primary} />
        <Text style={styles.keyStatLabel}>{props.label}</Text>
      </View>

      <View style={styles.liveStatValueWrap}>
        <Text style={styles.liveStatValue}>{props.value}</Text>
      </View>
    </View>
  );
}

function BadgeCard(
  props: BadgeDef & {
    onLongPress?: () => void;
  },
) {
  return (
    <Pressable
      onLongPress={props.onLongPress}
      delayLongPress={320}
      style={({ pressed }) => [
        styles.badgeShape,
        props.unlocked ? styles.badgeCardOn : styles.badgeCardOff,
        pressed ? { opacity: 0.88 } : null,
      ]}
    >
      <View style={styles.badgeTopCut} />
      <Text style={styles.badgeIcon}>{props.icon}</Text>
      <Text style={styles.badgeTitle} numberOfLines={2}>
        {props.title}
      </Text>
      <View style={styles.badgeRibbonRow}>
        <View style={styles.badgeRibbonLeft} />
        <View style={styles.badgeRibbonRight} />
      </View>
    </Pressable>
  );
}

function TimelineTicketCard(props: {
  year: string;
  count: number;
}) {
  return (
    <View style={styles.timelineTicketCard}>
      <View style={styles.timelineTicketNotchLeft} />
      <View style={styles.timelineTicketNotchRight} />

      <Text style={styles.timelineTicketYear}>{props.year}</Text>
      <Text style={styles.timelineTicketLabel}>
        {props.count} {props.count === 1 ? "gig" : "gigs"}
      </Text>
    </View>
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
  const [artistImageByName, setArtistImageByName] = React.useState<
    Record<string, string | null>
  >({});

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

  React.useEffect(() => {
    const uniqueArtists = Array.from(
      new Set(gigs.map((g) => g.artist?.trim()).filter(Boolean)),
    ) as string[];

    const missingArtists = uniqueArtists.filter((artist) => {
      const key = artist.toLowerCase();
      return !(key in artistImageByName);
    });

    if (missingArtists.length === 0) return;

    let cancelled = false;

    const loadImages = async () => {
      const entries = await Promise.all(
        missingArtists.map(async (artist) => {
          try {
            const res = await apiGet<SpotifyArtistPageResponse>(
              `/spotify/artist-page?name=${encodeURIComponent(artist)}`,
            );

            return [artist.toLowerCase(), res.artist?.imageUrl ?? null] as const;
          } catch {
            return [artist.toLowerCase(), null] as const;
          }
        }),
      );

      if (!cancelled) {
        setArtistImageByName((prev) => ({
          ...prev,
          ...Object.fromEntries(entries),
        }));
      }
    };

    void loadImages();

    return () => {
      cancelled = true;
    };
  }, [gigs, artistImageByName]);

  const enrichedGigs = React.useMemo(
    () =>
      gigs.map((gig) => {
        const artistKey = String(gig.artist ?? "").trim().toLowerCase();

        return {
          ...gig,
          artistImageUrl:
            (gig as any).artistImageUrl ?? artistImageByName[artistKey] ?? null,
        };
      }),
    [artistImageByName, gigs],
  );

  const stats = React.useMemo(() => buildStats(enrichedGigs), [enrichedGigs]);

  const topArtistImageUrl = React.useMemo(() => {
    const topArtistName = stats.topArtist?.[0]?.trim().toLowerCase();
    if (!topArtistName) return null;

    const gig = enrichedGigs.find(
      (g) => String(g.artist ?? "").trim().toLowerCase() === topArtistName,
    );

    return getGigImageUrl(gig);
  }, [enrichedGigs, stats.topArtist]);

  const unlockedBadges = stats.badges.filter((badge) => badge.unlocked);
  const lockedBadges = stats.badges.filter((badge) => !badge.unlocked);
  const sortedBadges = [...unlockedBadges, ...lockedBadges];

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
        ) : enrichedGigs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No stats yet</Text>
            <Text style={styles.emptyText}>
              Log your first gig to start building your live music story.
            </Text>
          </View>
        ) : (
          <>

            <SectionHeader title="Your highlights" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRail}
            >
              <KeyStatCard
                icon="musical-notes-outline"
                label="Top artist"
                value={stats.topArtist ? stats.topArtist[0] : "—"}
                subtitle={
                  stats.topArtist
                    ? `${stats.topArtist[1]} ${
                        stats.topArtist[1] === 1 ? "gig" : "gigs"
                      }`
                    : "Log more gigs"
                }
                imageUrl={topArtistImageUrl}
              />

              <KeyStatCard
  icon="business-outline"
  label="Favourite venue"
  value={stats.topVenue ? stats.topVenue[0] : "—"}
  subtitle={
    stats.topVenue
      ? `${stats.topVenue[1]} visits`
      : "No favourite yet"
  }
  imageSource={require("../../assets/venue-background.png")}
/>

              <KeyStatCard
  icon="location-outline"
  label="Main scene"
  value={stats.topCity ? stats.topCity[0] : "—"}
  subtitle={
    stats.topCity
      ? `${stats.topCity[1]} gigs there`
      : "Your city story starts here"
  }
  imageSource={require("../../assets/main-scene-background.png")}
/>
            </ScrollView>

            <SectionHeader title="Badges" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRail}
            >
              {sortedBadges.map((badge) => (
                <BadgeCard
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
            </ScrollView>

            <SectionHeader title="Gig stats" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRail}
            >
              <LiveStatCard
                icon="ticket-outline"
                label="Total gigs"
                value={String(stats.total)}
              />
              <LiveStatCard
                icon="create-outline"
                label="Rated gigs"
                value={String(stats.ratedCount)}
              />
              <LiveStatCard
                icon="star-half-outline"
                label="Avg rating"
                value={stats.avgRating == null ? "—" : String(stats.avgRating)}
              />
              <LiveStatCard
                icon="map-outline"
                label="Cities"
                value={String(stats.cityCount)}
              />
            </ScrollView>

            {stats.timeline.length > 0 ? (
              <>
                <SectionHeader title="Timeline" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalRail}
                >
                  {stats.timeline.map((item) => (
                    <TimelineTicketCard
                      key={item.year}
                      year={item.year}
                      count={item.count}
                    />
                  ))}
                </ScrollView>
              </>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
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

  sectionHeaderRow: {
    marginTop: 8,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  bigSectionTitle: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.1,
  },

  horizontalRail: {
    gap: 6,
    paddingRight: 16,
  },

  keyStatCard: {
    width: CARD_WIDTH,
    minHeight: 124,
    backgroundColor: Colours.background.card,
    borderRadius: 16,
    overflow: "hidden",
  },

  keyStatImage: {
    borderRadius: 16,
  },

  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.48)",
  },

  keyStatInner: {
    flex: 1,
    padding: 12,
  },

  keyStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  keyStatLabel: {
    color: Colours.text.secondary,
    fontWeight: "800",
    fontSize: 10,
    lineHeight: 13,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },

  keyStatValue: {
    marginTop: 6,
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.15,
  },

  keyStatSubtitle: {
    marginTop: 4,
    color: Colours.text.secondary,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
  },

  tone_default: {
    backgroundColor: Colours.background.card,
  },

  tone_gold: {
    backgroundColor: "rgba(255,209,102,0.10)",
  },

  tone_blue: {
    backgroundColor: "rgba(47,140,255,0.12)",
  },

  tone_purple: {
    backgroundColor: "rgba(138,91,255,0.12)",
  },

  liveStatCard: {
    width: 104,
    minHeight: 76,
    backgroundColor: Colours.background.card,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  liveStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  liveStatValueWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  liveStatValue: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.15,
    textAlign: "center",
  },

  badgeShape: {
    width: 118,
    height: 92,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colours.background.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,183,3,0.78)",
    overflow: "hidden",
  },

  badgeTopCut: {
    position: "absolute",
    top: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colours.background.app,
    borderWidth: 1,
    borderColor: "rgba(255,183,3,0.28)",
  },

  badgeRibbonRow: {
    position: "absolute",
    bottom: -1,
    flexDirection: "row",
  },

  badgeRibbonLeft: {
    width: 24,
    height: 18,
    backgroundColor: "rgba(255,183,3,0.18)",
    transform: [{ skewX: "-16deg" }],
  },

  badgeRibbonRight: {
    width: 24,
    height: 18,
    backgroundColor: "rgba(255,183,3,0.14)",
    transform: [{ skewX: "16deg" }],
  },

  badgeCardOn: {
    opacity: 1,
  },

  badgeCardOff: {
    opacity: 0.42,
  },

  badgeIcon: {
    fontSize: 20,
    lineHeight: 24,
    textAlign: "center",
  },

  badgeTitle: {
    marginTop: 6,
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 15,
    textAlign: "center",
  },

  timelineTicketCard: {
    width: 118,
    height: 74,
    backgroundColor: Colours.background.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    position: "relative",
    overflow: "hidden",
  },

  timelineTicketNotchLeft: {
    position: "absolute",
    left: -8,
    top: "50%",
    marginTop: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colours.background.app,
  },

  timelineTicketNotchRight: {
    position: "absolute",
    right: -8,
    top: "50%",
    marginTop: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colours.background.app,
  },

  timelineTicketYear: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 20,
  },

  timelineTicketLabel: {
    marginTop: 4,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 14,
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