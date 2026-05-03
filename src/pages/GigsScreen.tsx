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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { setCachedGigs } from "../lib/gigsCache";
import { apiGet, apiPost, ApiError } from "../lib/api";
import { syncGigReminderNotifications } from "../lib/notifications";
import type { Gig, GigsResponse, CreateGigInput } from "../shared/types/Gig";
import { parseYmdToUtcDate } from "../lib/date";

import { AddGigScreen } from "./AddGigScreen";
import { EditGigScreen } from "./EditGigScreen";
import { ArtistScreen } from "./ArtistScreen";
import { ConfirmGigScreen } from "./ConfirmGigScreen";

import { PrimaryButton } from "../components/PrimaryButton";
import { GigCard } from "../components/GigCard";
import { AppHeader } from "../components/AppHeader";
import { Colours } from "../theme/colours";

const FAVOURITE_GIG_ID_KEY = "wegig.favouriteGigId";

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Gig>);

type SpotifyArtistPageResponse = {
  artist: {
    imageUrl: string | null;
  } | null;
};

function splitGigs(gigs: Gig[]) {
  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  const comingUpGigs = gigs
    .filter((gig) => {
      const d = parseYmdToUtcDate(gig.date);
      return d ? d.getTime() >= todayUtc.getTime() : false;
    })
    .sort((a, b) => {
      const ad = parseYmdToUtcDate(a.date)?.getTime() ?? 0;
      const bd = parseYmdToUtcDate(b.date)?.getTime() ?? 0;
      return ad - bd;
    });

  const pastGigs = gigs
    .filter((gig) => {
      const d = parseYmdToUtcDate(gig.date);
      return d ? d.getTime() < todayUtc.getTime() : true;
    })
    .sort((a, b) => {
      const ad = parseYmdToUtcDate(a.date)?.getTime() ?? 0;
      const bd = parseYmdToUtcDate(b.date)?.getTime() ?? 0;
      return bd - ad;
    });

  return { comingUpGigs, pastGigs };
}

function TicketStub({ count }: { count: number }) {
  return (
    <View style={styles.ticketStub}>
      <View style={styles.ticketStubNotchLeft} />
      <View style={styles.ticketStubNotchRight} />
      <Text style={styles.ticketStubText}>{count}</Text>
    </View>
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

  const [favouriteGigId, setFavouriteGigId] = React.useState("");

  const [artistImageByName, setArtistImageByName] = React.useState<
    Record<string, string | null>
  >({});

  const loadPinnedGigIds = React.useCallback(async () => {
    try {
      const favouriteId = await AsyncStorage.getItem(FAVOURITE_GIG_ID_KEY);
      setFavouriteGigId(favouriteId ?? "");
    } catch {
      setFavouriteGigId("");
    }
  }, []);

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

  React.useEffect(() => {
    const uniqueArtists = Array.from(
      new Set(
        (data?.gigs ?? [])
          .map((g) => g.artist?.trim())
          .filter(Boolean),
      ),
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
  }, [data?.gigs, artistImageByName]);

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
        onPrefillUsed={() => {
          clearDiscoverPrefill();
        }}
        onBack={() => {
          setAddingGig(false);
          clearDiscoverPrefill();
        }}
        onCreated={async (createdGig: Gig) => {
          setAddingGig(false);
          clearDiscoverPrefill();

          if (createdGig?.id) {
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
        onPressArtist={(artist) => {
          setEditingGig(null);
          setArtistView(artist);
        }}
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
        onPressSimilarArtist={(artist) => setArtistView(artist)}
      />
    );
  }

  const gigs = (data?.gigs ?? []).map((gig) => {
    const artistKey = String(gig.artist ?? "").trim().toLowerCase();

    return {
      ...gig,
      artistImageUrl:
        (gig as any).artistImageUrl ?? artistImageByName[artistKey] ?? null,
    };
  });

  const { comingUpGigs, pastGigs } = splitGigs(gigs);
  const isEmpty = !loading && !error && gigs.length === 0;

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
              data={pastGigs}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              ListHeaderComponent={
                <View style={{ marginBottom: 14 }}>
                  {comingUpGigs.length > 0 ? (
                    <View style={{ marginBottom: 22 }}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.bigSectionTitle}>Coming up</Text>
                        <TicketStub count={comingUpGigs.length} />
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                          gap: 12,
                          paddingRight: 16,
                        }}
                      >
                        {comingUpGigs.map((gig) => (
                          <GigCard
                            key={gig.id}
                            gig={gig}
                            variant="poster"
                            onPress={() => setEditingGig(gig)}
                            onPressArtist={(artist: string) =>
                              setArtistView(artist)
                            }
                            isFavouriteGig={gig.id === favouriteGigId}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.bigSectionTitle}>Past gigs</Text>
                    <TicketStub count={pastGigs.length} />
                  </View>
                </View>
              }
              ListEmptyComponent={
                pastGigs.length === 0 ? (
                  <View
                    style={{
                      backgroundColor: Colours.background.card,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: Colours.ui.border,
                      padding: 14,
                    }}
                  >
                    <Text
                      style={{
                        color: Colours.text.muted,
                        fontWeight: "700",
                        fontSize: 13,
                        lineHeight: 18,
                      }}
                    >
                      No past gigs yet.
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <GigCard
                  gig={item}
                  variant="row"
                  onPress={() => setEditingGig(item)}
                  onPressArtist={(artist: string) => setArtistView(artist)}
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
                pressed
                  ? { transform: [{ scale: 0.97 }], opacity: 0.92 }
                  : null,
              ]}
              hitSlop={10}
            >
              <Ionicons name="add" size={28} color={Colours.text.primary} />
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = {
  sectionHeaderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: 12,
  },

  bigSectionTitle: {
    color: Colours.text.primary,
    fontWeight: "800" as const,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.1,
  },

ticketStub: {
  minWidth: 42,
  height: 26,
  paddingHorizontal: 13,
  borderRadius: 5,
  backgroundColor: "rgba(119, 118, 214, 0.18)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  position: "relative" as const,
  overflow: "hidden" as const,
  transform: [{ rotate: "-1deg" }],
},

 ticketStubNotchLeft: {
  position: "absolute" as const,
  left: -5,
  top: "50%" as const,
  marginTop: -5,
  width: 10,
  height: 10,
  borderRadius: 5,
  backgroundColor: Colours.background.app,
},

ticketStubNotchRight: {
  position: "absolute" as const,
  right: -5,
  top: "50%" as const,
  marginTop: -5,
  width: 10,
  height: 10,
  borderRadius: 5,
  backgroundColor: Colours.background.app,
},

ticketStubText: {
  color: "#f1efeb",
  fontWeight: "900" as const,
  fontSize: 12,
  lineHeight: 15,
  letterSpacing: 0.8,
},
};