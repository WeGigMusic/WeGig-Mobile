import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Animated,
  Pressable,
  Alert,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { setCachedGigs } from "../lib/gigsCache";
import { apiGet, apiPost, ApiError } from "../lib/api";
import { syncGigReminderNotifications } from "../lib/notifications";
import type { Gig, GigsResponse, CreateGigInput } from "../shared/types/Gig";

import { AddGigScreen } from "./AddGigScreen";
import { EditGigScreen } from "./EditGigScreen";
import { ArtistScreen } from "./ArtistScreen";
import { ConfirmGigScreen } from "./ConfirmGigScreen";

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

type BadgeInfo = {
  title: string;
  description: string;
};

const BADGE_INFO: Record<string, BadgeInfo> = {
  "First Gig": {
    title: "First Gig",
    description: "Logged your first gig on WeGig.",
  },
  "Scene Regular": {
    title: "Scene Regular",
    description: "Logged 5 gigs.",
  },
  "Venue Hopper": {
    title: "Venue Hopper",
    description: "Visited 3 different venues.",
  },
  "City Explorer": {
    title: "City Explorer",
    description: "Logged gigs in 3 different cities.",
  },
  Superfan: {
    title: "Superfan",
    description: "Saw the same artist 3 times.",
  },
  "Perfect Set": {
    title: "Perfect Set",
    description: "Gave a gig a 5-star rating.",
  },
  "Sharp Ears": {
    title: "Sharp Ears",
    description: "Rated 5 gigs.",
  },
  "First Review": {
    title: "First Review",
    description: "Rated your first gig.",
  },
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
  const topArtistCount = Object.values(artists).sort((a, b) => b - a)[0] ?? 0;

  const badges: BadgeChip[] = [
    { title: "First Gig", icon: "🎟️", unlocked: total >= 1 },
    { title: "First Review", icon: "✨", unlocked: rated.length >= 1 },
    { title: "Scene Regular", icon: "🔥", unlocked: total >= 5 },
    { title: "Venue Hopper", icon: "🏟️", unlocked: venueCount >= 3 },
    { title: "City Explorer", icon: "🌍", unlocked: cityCount >= 3 },
    { title: "Superfan", icon: "⭐", unlocked: topArtistCount >= 3 },
    {
      title: "Perfect Set",
      icon: "🌟",
      unlocked: gigs.some((g) => g.rating === 5),
    },
    { title: "Sharp Ears", icon: "📝", unlocked: rated.length >= 5 },
  ];

  return badges.filter((b) => b.unlocked);
}

function BadgeShowcaseChip(props: {
  title: string;
  icon: string;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onLongPress={props.onLongPress}
      delayLongPress={320}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          marginRight: 8,
          borderWidth: 1,
          backgroundColor: "rgba(47,140,255,0.16)",
          borderColor: "rgba(47,140,255,0.38)",
        },
        pressed ? { opacity: 0.92 } : null,
      ]}
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
      <Pressable
        onPress={props.onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.78)",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingHorizontal: 16,
          paddingTop: 120,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
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
          }}
        >
          <Text
            style={{
              color: Colours.text.primary,
              fontSize: 18,
              fontWeight: "700",
              marginBottom: 8,
            }}
          >
            {props.title}
          </Text>

          <Text
            style={{
              color: Colours.text.secondary,
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            {props.description}
          </Text>

          <Text
            style={{
              marginTop: 14,
              color: Colours.text.muted,
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            Tap outside to close
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function GigsScreen(props: {
  onPressLogo?: () => void;
  resetSignal?: number;
  scrollToTopSignal?: number;
  prefill?: Partial<CreateGigInput> | null;
  autoCreatePrefill?: boolean;
  onPrefillUsed?: () => void;
  onGigCreated?: () => void;
}) {
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const listRef = React.useRef<FlatList<Gig>>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState<GigsResponse | null>(null);

  const [addingGig, setAddingGig] = React.useState(false);
  const [confirmingGig, setConfirmingGig] = React.useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = React.useState(false);
  const [editingGig, setEditingGig] = React.useState<Gig | null>(null);
  const [artistView, setArtistView] = React.useState<string | null>(null);

  const [discoverPrefill, setDiscoverPrefill] =
    React.useState<Partial<CreateGigInput> | null>(null);

  const [firstGigId, setFirstGigId] = React.useState("");
  const [favouriteGigId, setFavouriteGigId] = React.useState("");

  const [selectedBadgeInfo, setSelectedBadgeInfo] =
    React.useState<BadgeInfo | null>(null);

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
    [favouriteGigId],
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
    [firstGigId],
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await apiGet<GigsResponse>("/gigs");
      setData(res);
      setCachedGigs(res.gigs ?? []);
      await syncGigReminderNotifications(res.gigs ?? []);
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

  React.useEffect(() => {
    setAddingGig(false);
    setConfirmingGig(false);
    setConfirmingSubmit(false);
    setEditingGig(null);
    setArtistView(null);
    setSelectedBadgeInfo(null);
    setDiscoverPrefill(null);
  }, [props.resetSignal]);

  React.useEffect(() => {
    if (props.scrollToTopSignal == null) return;

    listRef.current?.scrollToOffset({
      offset: 0,
      animated: true,
    });
  }, [props.scrollToTopSignal]);

  React.useEffect(() => {
    const prefill = props.prefill;
    if (!prefill) return;

    const artist =
      typeof prefill.artist === "string" ? prefill.artist.trim() : "";
    const venue =
      typeof prefill.venue === "string" ? prefill.venue.trim() : "";
    const city = typeof prefill.city === "string" ? prefill.city.trim() : "";
    const date = typeof prefill.date === "string" ? prefill.date.trim() : "";

    const normalizedPrefill: Partial<CreateGigInput> = {
      ...prefill,
      artist,
      venue,
      city,
      date,
      notes:
        typeof prefill.notes === "string"
          ? prefill.notes.trim()
          : prefill.notes,
    };

    const hasRequired = Boolean(artist && venue && city && date);

    setDiscoverPrefill(normalizedPrefill);

    if (!hasRequired) {
      setAddingGig(true);
      setConfirmingGig(false);
      return;
    }

    if (props.autoCreatePrefill) {
      setAddingGig(true);
      setConfirmingGig(false);
      return;
    }

    setConfirmingGig(true);
    setAddingGig(false);
  }, [props.prefill, props.autoCreatePrefill]);

  const clearDiscoverPrefill = React.useCallback(() => {
    setDiscoverPrefill(null);
    props.onPrefillUsed?.();
  }, [props.onPrefillUsed]);

  const createGigFromDiscover = React.useCallback(async () => {
    if (!discoverPrefill) return;

    setConfirmingSubmit(true);
    setError("");

    try {
      const created = await apiPost<Gig>("/gigs", discoverPrefill);

      clearDiscoverPrefill();
      setConfirmingGig(false);
      setEditingGig(created);
      await load();
      await loadPinnedGigIds();
      props.onGigCreated?.();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 409) {
        clearDiscoverPrefill();
        setConfirmingGig(false);
        await load();
        await loadPinnedGigIds();
        Alert.alert("Already logged", "This gig is already in your list.");
        return;
      }

      setError(e?.message ?? "Failed to add gig from Discover");
      Alert.alert("Error", e?.message ?? "Failed to add gig from Discover");
    } finally {
      setConfirmingSubmit(false);
    }
  }, [
    clearDiscoverPrefill,
    discoverPrefill,
    load,
    loadPinnedGigIds,
    props.onGigCreated,
  ]);

  if (confirmingGig && discoverPrefill) {
    return (
      <ConfirmGigScreen
        prefill={discoverPrefill}
        onPressLogo={props.onPressLogo}
        loading={confirmingSubmit}
        onBack={() => {
          setConfirmingGig(false);
          clearDiscoverPrefill();
        }}
        onConfirm={() => {
          void createGigFromDiscover();
        }}
        onEdit={() => {
          setConfirmingGig(false);
          setAddingGig(true);
        }}
      />
    );
  }

  if (addingGig) {
    return (
      <AddGigScreen
        onPressLogo={props.onPressLogo}
        prefill={discoverPrefill ?? props.prefill}
        autoCreate={!!props.autoCreatePrefill}
        hasFirstGig={Boolean(firstGigId)}
        onPrefillUsed={() => {
          clearDiscoverPrefill();
        }}
        onBack={() => {
          setAddingGig(false);
          clearDiscoverPrefill();
        }}
        onCreated={async (createdGig, options) => {
          setAddingGig(false);
          clearDiscoverPrefill();

          if (createdGig?.id) {
            if (options?.markAsFirst) {
              await toggleFirstGig(createdGig.id);
            }

            if (options?.markAsFavourite) {
              await toggleFavouriteGig(createdGig.id);
            }

            setEditingGig(createdGig);
          }

          await load();
          await loadPinnedGigIds();
          props.onGigCreated?.();
        }}
      />
    );
  }

  if (editingGig) {
    return (
      <EditGigScreen
        gig={editingGig}
        onPressLogo={props.onPressLogo}
        onBack={() => setEditingGig(null)}
        onDone={() => {
          setEditingGig(null);
          void load();
          void loadPinnedGigIds();
        }}
        isFirstGig={editingGig.id === firstGigId}
        isFavouriteGig={editingGig.id === favouriteGigId}
        onToggleFirst={() => void toggleFirstGig(editingGig.id)}
        onToggleFavourite={() => void toggleFavouriteGig(editingGig.id)}
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
        onPressSimilarArtist={(artist) => setArtistView(artist)}
      />
    );
  }

  const gigs = data?.gigs ?? [];
  const isEmpty = !loading && !error && gigs.length === 0;

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

            <View style={{ width: "100%", maxWidth: 240, marginTop: 4 }}>
              <PrimaryButton
                title="Add your first gig"
                onPress={() => setAddingGig(true)}
              />
            </View>
          </View>
        ) : (
          <>
            <AnimatedFlatList
              ref={listRef}
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
                          onLongPress={() =>
                            setSelectedBadgeInfo(
                              BADGE_INFO[badge.title] ?? {
                                title: badge.title,
                                description:
                                  "Badge unlocked in your gig history.",
                              },
                            )
                          }
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
                />
              )}
              refreshing={loading}
              onRefresh={() => {
                void load();
                void loadPinnedGigIds();
              }}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: false },
              )}
              scrollEventThrottle={16}
            />

            <Pressable
              onPress={() => setAddingGig(true)}
              style={({ pressed }) => [
                {
                  position: "absolute",
                  right: 20,
                  bottom: 96,
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: Colours.brand.primary,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  shadowColor: "#000",
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 8,
                },
                pressed ? { transform: [{ scale: 0.97 }], opacity: 0.92 } : null,
              ]}
              hitSlop={10}
            >
              <Ionicons name="add" size={28} color={Colours.text.primary} />
            </Pressable>

            <BadgeInfoModal
              visible={!!selectedBadgeInfo}
              title={selectedBadgeInfo?.title ?? ""}
              description={selectedBadgeInfo?.description ?? ""}
              onClose={() => setSelectedBadgeInfo(null)}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}