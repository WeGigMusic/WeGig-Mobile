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
import * as Haptics from "expo-haptics";


import { setCachedGigs } from "../lib/gigsCache";
import { apiGet, apiPost, ApiError } from "../lib/api";
import { syncGigReminderNotifications } from "../lib/notifications";
import type { Gig, GigsResponse, CreateGigInput } from "../shared/types/Gig";
import { parseYmdToUtcDate } from "../lib/date";
import { useToast } from "../components/ToastProvider";


import { AddGigScreen } from "./AddGigScreen";
import { EditGigScreen } from "./EditGigScreen";
import { ArtistScreen } from "./ArtistScreen";
import { ConfirmGigScreen } from "./ConfirmGigScreen";


import { PrimaryButton } from "../components/PrimaryButton";
import { GigCard } from "../components/GigCard";
import { AppHeader } from "../components/AppHeader";
import { Colours } from "../theme/colours";


const FAVOURITE_GIG_ID_KEY = "wegig.favouriteGigId";
const HAPTICS_KEY = "wegig.hapticsEnabled";


type SpotifyArtistPageResponse = {
  artist: {
    imageUrl: string | null;
  } | null;
};


type PastGigListItem =
  | { type: "year"; year: string; count: number }
  | { type: "gig"; year: string; gig: Gig };


type UnlockableBadge = {
  title: string;
  icon: string;
  unlocked: boolean;
};


async function hapticsAllowed() {
  try {
    const value = await AsyncStorage.getItem(HAPTICS_KEY);
    return value == null || value === "1";
  } catch {
    return true;
  }
}


const AnimatedFlatList =
  Animated.createAnimatedComponent(FlatList<PastGigListItem>);


function getGigYear(gig: Gig) {
  const d = parseYmdToUtcDate(gig.date);
  return d ? String(d.getUTCFullYear()) : "Unknown";
}


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


function buildPastGigItems(
  pastGigs: Gig[],
  collapsed: Record<string, boolean>,
): PastGigListItem[] {
  const grouped = pastGigs.reduce<Record<string, Gig[]>>((acc, gig) => {
    const year = getGigYear(gig);
    acc[year] = acc[year] ?? [];
    acc[year].push(gig);
    return acc;
  }, {});


  const years = Object.keys(grouped).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return Number(b) - Number(a);
  });


  return years.flatMap((year): PastGigListItem[] => {
    const gigs = grouped[year];


    const header: PastGigListItem = {
      type: "year",
      year,
      count: gigs.length,
    };


    if (collapsed[year]) return [header];


    const gigItems: PastGigListItem[] = gigs.map((gig) => ({
      type: "gig" as const,
      year,
      gig,
    }));


    return [header, ...gigItems];
  });
}


function buildUnlockableBadges(gigs: Gig[]): UnlockableBadge[] {
  const total = gigs.length;


  const rated = gigs.filter((g) => typeof g.rating === "number") as Array<
    Gig & { rating: number }
  >;


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


  const cityCount = Object.keys(byCity).length;
  const venueCount = Object.keys(byVenue).length;
  const topArtistCount =
    Object.entries(byArtist).sort((a, b) => b[1] - a[1])[0]?.[1] ?? 0;
  const hasFiveStarGig = gigs.some((g) => g.rating === 5);


  return [
    {
      title: "Setlist Opener",
      icon: "🎟️",
      unlocked: total >= 1,
    },
    {
      title: "Soundcheck",
      icon: "🎧",
      unlocked: rated.length >= 1,
    },
    {
      title: "Scene Regular",
      icon: "🔥",
      unlocked: total >= 15,
    },
    {
      title: "Scene Fixture",
      icon: "🏟️",
      unlocked: total >= 30,
    },
    {
      title: "Touring the Scene",
      icon: "🏟️",
      unlocked: venueCount >= 7,
    },
    {
      title: "On Tour",
      icon: "🌍",
      unlocked: cityCount >= 5,
    },
    {
      title: "Die Hard",
      icon: "⭐",
      unlocked: topArtistCount >= 5,
    },
    {
      title: "Encore",
      icon: "🌟",
      unlocked: hasFiveStarGig,
    },
    {
      title: "Well Tuned",
      icon: "🎚️",
      unlocked: rated.length >= 5,
    },
    {
      title: "Headliner",
      icon: "🎤",
      unlocked: total >= 50,
    },
  ];
}


function getNewlyUnlockedBadge(previousGigs: Gig[], nextGigs: Gig[]) {
  const previousBadges = buildUnlockableBadges(previousGigs);
  const nextBadges = buildUnlockableBadges(nextGigs);


  const previousUnlocked = new Set(
    previousBadges.filter((badge) => badge.unlocked).map((badge) => badge.title),
  );


  return nextBadges.find(
    (badge) => badge.unlocked && !previousUnlocked.has(badge.title),
  );
}


async function triggerGigSavedFeedback(hasUnlockedBadge: boolean) {
  if (!(await hapticsAllowed())) return;


  try {
    if (hasUnlockedBadge) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }


    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
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
  openGigIdFromNotification?: string | null;
  onNotificationGigOpened?: () => void;
}) {
  const { showToast } = useToast();


  const scrollY = React.useRef(new Animated.Value(0)).current;
  const listRef = React.useRef<FlatList<PastGigListItem>>(null);


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


  const [collapsedYears, setCollapsedYears] = React.useState<
    Record<string, boolean>
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
    const venue = typeof prefill.venue === "string" ? prefill.venue.trim() : "";
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
    const targetGigId = props.openGigIdFromNotification;


    if (!targetGigId) return;
    if (loading) return;
    if (!data?.gigs?.length) return;


    const targetGig = data.gigs.find((gig) => gig.id === targetGigId);


    if (!targetGig) {
      props.onNotificationGigOpened?.();
      return;
    }


    setAddingGig(false);
    setConfirmingGig(false);
    setConfirmingSubmit(false);
    setArtistView(null);
    setDiscoverPrefill(null);
    setEditingGig(targetGig);


    props.onNotificationGigOpened?.();
  }, [
    data?.gigs,
    loading,
    props.openGigIdFromNotification,
    props.onNotificationGigOpened,
  ]);


  React.useEffect(() => {
    const uniqueArtists = Array.from(
      new Set((data?.gigs ?? []).map((g) => g.artist?.trim()).filter(Boolean)),
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
  }, [props]);


  const toggleYear = React.useCallback((year: string) => {
    setCollapsedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }));
  }, []);


  const showGigCreatedFeedback = React.useCallback(
    async (previousGigs: Gig[], createdGig: Gig) => {
      const nextGigs = [
        ...previousGigs.filter((gig) => gig.id !== createdGig.id),
        createdGig,
      ];


      const newlyUnlocked = getNewlyUnlockedBadge(previousGigs, nextGigs);


      await triggerGigSavedFeedback(Boolean(newlyUnlocked));


      if (newlyUnlocked) {
        showToast({
          eyebrow: "Milestone unlocked",
          title: newlyUnlocked.title,
          icon: newlyUnlocked.icon,
          duration: 2600,
        });
        return;
      }


      showToast({
        message: "Gig added",
        duration: 1500,
      });
    },
    [showToast],
  );


  const createGigFromDiscover = React.useCallback(async () => {
    if (!discoverPrefill) return;


    const previousGigs = data?.gigs ?? [];


    setConfirmingSubmit(true);
    setError("");


    try {
      const created = await apiPost<Gig>("/gigs", discoverPrefill);


      clearDiscoverPrefill();
      setConfirmingGig(false);
      setEditingGig(created);


      await showGigCreatedFeedback(previousGigs, created);
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
    data?.gigs,
    discoverPrefill,
    load,
    loadPinnedGigIds,
    props,
    showGigCreatedFeedback,
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
          const previousGigs = data?.gigs ?? [];


          setAddingGig(false);
          clearDiscoverPrefill();


          if (createdGig?.id) {
            setEditingGig(createdGig);
          }


          await showGigCreatedFeedback(previousGigs, createdGig);
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
        onPressArtist={(artist: string) => {
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
        onEditGig={(g: Gig) => setEditingGig(g)}
        onPressSimilarArtist={(artist: string) => setArtistView(artist)}
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
  const pastGigItems = buildPastGigItems(pastGigs, collapsedYears);
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
              data={pastGigItems}
              keyExtractor={(item) =>
                item.type === "year" ? `year-${item.year}` : item.gig.id
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
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
                            onPress={() => setArtistView(gig.artist)}
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
              renderItem={({ item }) => {
                if (item.type === "year") {
                  const isCollapsed = !!collapsedYears[item.year];


                  return (
                    <Pressable
                      onPress={() => toggleYear(item.year)}
                      style={({ pressed }) => [
                        styles.yearHeader,
                        pressed ? styles.yearHeaderPressed : null,
                      ]}
                      hitSlop={8}
                    >
                      <View style={styles.yearTitleRow}>
                        <Ionicons
                          name={
                            isCollapsed ? "chevron-forward" : "chevron-down"
                          }
                          size={16}
                          color={Colours.text.muted}
                        />
                        <Text style={styles.yearTitle}>{item.year}</Text>
                      </View>
                    </Pressable>
                  );
                }


                return (
                  <GigCard
                    gig={item.gig}
                    variant="row"
                    onPress={() => setArtistView(item.gig.artist)}
                    onPressArtist={(artist: string) => setArtistView(artist)}
                    isFavouriteGig={item.gig.id === favouriteGigId}
                  />
                );
              }}
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
    minWidth: 34,
    height: 20,
    paddingHorizontal: 10,
    borderRadius: 3,
    backgroundColor: "rgba(47,140,255,0.12)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    position: "relative" as const,
    overflow: "hidden" as const,
    borderWidth: 0,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    transform: [{ rotate: "-0.6deg" }],
  },


  ticketStubNotchLeft: {
    position: "absolute" as const,
    left: -4,
    top: "50%" as const,
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colours.background.app,
    opacity: 0.9,
  },


  ticketStubNotchRight: {
    position: "absolute" as const,
    right: -4,
    top: "50%" as const,
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colours.background.app,
    opacity: 0.9,
  },


  ticketStubText: {
    color: Colours.text.primary,
    fontWeight: "800" as const,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.4,
  },


  yearHeader: {
    marginTop: 8,
    marginBottom: 2,
    paddingVertical: 8,
    paddingHorizontal: 2,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },


  yearHeaderPressed: {
    opacity: 0.78,
  },


  yearTitleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },


  yearTitle: {
    color: Colours.text.primary,
    fontWeight: "800" as const,
    fontSize: 16,
    lineHeight: 21,
  },
};



