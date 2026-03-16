import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { setCachedGigs } from "../lib/gigsCache";
import { apiGet } from "../lib/api";
import type { Gig, GigsResponse } from "../shared/types/Gig";

import { EditGigScreen } from "./EditGigScreen";
import { ArtistScreen } from "./ArtistScreen";

import { PrimaryButton } from "../components/PrimaryButton";
import { GigCard } from "../components/GigCard";
import { AppHeader } from "../components/AppHeader";
import { Colours } from "../theme/colours";

const FIRST_GIG_ID_KEY = "wegig.firstGigId";
const FAVOURITE_GIG_ID_KEY = "wegig.favouriteGigId";

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Gig>);

type BadgeChip = {
  title: string;
  icon: string;
  unlocked: boolean;
};

function computeGigBadges(gigs: Gig[]) {
  const total = gigs.length;

  const rated = gigs.filter((g) => typeof g.rating === "number") as Array<
    Gig & { rating: number }
  >;

  const cities = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.city ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const cityCount = Object.keys(cities).length;

  const venues = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.venue ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const venueCount = Object.keys(venues).length;

  const artists = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.artist ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topArtistCount =
    Object.values(artists).sort((a, b) => b - a)[0] ?? 0;

  const badges: BadgeChip[] = [
    { title: "First Gig", icon: "🎟️", unlocked: total >= 1 },
    { title: "Origin Story", icon: "🌱", unlocked: total >= 1 },
    { title: "That One Night", icon: "✨", unlocked: rated.length >= 1 },
    { title: "Regular", icon: "🔥", unlocked: total >= 5 },
    { title: "Venue Hopper", icon: "🏟️", unlocked: venueCount >= 3 },
    { title: "City Explorer", icon: "🌍", unlocked: cityCount >= 3 },
    { title: "Superfan", icon: "⭐", unlocked: topArtistCount >= 3 },
    {
      title: "Five-Star Night",
      icon: "🌟",
      unlocked: gigs.some((g) => g.rating === 5),
    },
    { title: "Critic", icon: "📝", unlocked: rated.length >= 5 },
  ];

  return badges.filter((b) => b.unlocked);
}

function BadgeShowcaseChip(props: { title: string; icon: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginRight: 8,
        borderWidth: 1,
        backgroundColor: "rgba(47,140,255,0.16)",
        borderColor: "rgba(47,140,255,0.38)",
      }}
    >
      <Text style={{ marginRight: 6, fontSize: 13 }}>{props.icon}</Text>
      <Text
        style={{
          color: Colours.text.primary,
          fontWeight: "700",
          fontSize: 12,
          lineHeight: 16,
        }}
      >
        {props.title}
      </Text>
    </View>
  );
}

export function GigsScreen(props: { onPressLogo?: () => void }) {
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState<GigsResponse | null>(null);

  const [editingGig, setEditingGig] = React.useState<Gig | null>(null);
  const [artistView, setArtistView] = React.useState<string | null>(null);

  const [firstGigId, setFirstGigId] = React.useState("");
  const [favouriteGigId, setFavouriteGigId] = React.useState("");

  const loadPinnedGigIds = React.useCallback(async () => {
    try {
      const [firstId, favouriteId] = await Promise.all([
        AsyncStorage.getItem(FIRST_GIG_ID_KEY),
        AsyncStorage.getItem(FAVOURITE_GIG_ID_KEY),
      ]);

      setFirstGigId(firstId ?? "");
      setFavouriteGigId(favouriteId ?? "");
    } catch {
      setFirstGigId("");
      setFavouriteGigId("");
    }
  }, []);

  const toggleFavouriteGig = React.useCallback(
    async (gigId: string) => {
      try {
        if (favouriteGigId === gigId) {
          await AsyncStorage.removeItem(FAVOURITE_GIG_ID_KEY);
          setFavouriteGigId("");
        } else {
          await AsyncStorage.setItem(FAVOURITE_GIG_ID_KEY, gigId);
          setFavouriteGigId(gigId);
        }
      } catch {}
    },
    [favouriteGigId]
  );

  const toggleFirstGig = React.useCallback(
    async (gigId: string) => {
      try {
        if (firstGigId === gigId) {
          await AsyncStorage.removeItem(FIRST_GIG_ID_KEY);
          setFirstGigId("");
        } else {
          await AsyncStorage.setItem(FIRST_GIG_ID_KEY, gigId);
          setFirstGigId(gigId);
        }
      } catch {}
    },
    [firstGigId]
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await apiGet<GigsResponse>("/gigs");
      setData(res);
      setCachedGigs(res.gigs ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load gigs");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    void loadPinnedGigIds();
  }, [load, loadPinnedGigIds]);

  if (editingGig) {
    return (
      <EditGigScreen
        gig={editingGig}
        onPressLogo={props.onPressLogo}
        onDone={() => {
          setEditingGig(null);
          void load();
          void loadPinnedGigIds();
        }}
      />
    );
  }

  if (artistView) {
    return (
      <ArtistScreen
        artist={artistView}
        onPressLogo={props.onPressLogo}
        onBack={() => setArtistView(null)}
        onEditGig={(g) => setEditingGig(g)}
      />
    );
  }

  const gigs = data?.gigs ?? [];
  const isEmpty = !loading && !error && gigs.length === 0;
  const hasFirstGig = Boolean(firstGigId);
  const hasFavouriteGig = Boolean(favouriteGigId);

  const showcaseBadges = computeGigBadges(gigs).slice(0, 6);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colours.background.app }}>
      <AppHeader onPressLogo={props.onPressLogo} scrollY={scrollY} />

      <View style={{ paddingHorizontal: 16, flex: 1 }}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : error ? (
          <View style={{ paddingTop: 16 }}>
            <Text style={{ color: Colours.text.danger, fontWeight: "800" }}>
              {error}
            </Text>
            <View style={{ height: 10 }} />
            <PrimaryButton title="Try again" onPress={load} />
          </View>
        ) : isEmpty ? (
          <View style={{ alignItems: "center", marginTop: 60, gap: 12 }}>
            <Text
              style={{
                color: Colours.text.muted,
                fontSize: 16,
                fontWeight: "700",
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
              Start by adding one manually or discover shows to prefill faster.
            </Text>
          </View>
        ) : (
          <AnimatedFlatList
            data={gigs}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListHeaderComponent={
              <View style={{ marginBottom: 14, gap: 8 }}>
                <Text
                  style={{
                    color: Colours.text.primary,
                    fontWeight: "700",
                    fontSize: 14,
                    lineHeight: 18,
                  }}
                >
                  My badges
                </Text>

                {showcaseBadges.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 8 }}
                  >
                    {showcaseBadges.map((badge) => (
                      <BadgeShowcaseChip
                        key={badge.title}
                        title={badge.title}
                        icon={badge.icon}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <Text
                    style={{
                      color: Colours.text.muted,
                      fontWeight: "500",
                      fontSize: 13,
                      lineHeight: 18,
                    }}
                  >
                    Log your first gig to start earning badges.
                  </Text>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <GigCard
                gig={item}
                onPress={() => setEditingGig(item)}
                onPressArtist={(artist: string) => setArtistView(artist)}
                isFirstGig={item.id === firstGigId}
                isFavouriteGig={item.id === favouriteGigId}
                showFirstGigAction={!hasFirstGig || item.id === firstGigId}
                showFavouriteAction={
                  !hasFavouriteGig || item.id === favouriteGigId
                }
                onToggleFavourite={() => void toggleFavouriteGig(item.id)}
                onToggleFirstGig={() => void toggleFirstGig(item.id)}
              />
            )}
            refreshing={loading}
            onRefresh={() => {
              void load();
              void loadPinnedGigIds();
            }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
          />
        )}
      </View>
    </SafeAreaView>
  );
}