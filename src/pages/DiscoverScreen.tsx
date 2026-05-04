import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  ActivityIndicator,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Pressable,
  Keyboard,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { avatarPresets } from "../config/avatarPresets";
import { TextField } from "../components/TextField";
import { apiGet } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { Colours } from "../theme/colours";
import type { CreateGigInput } from "../shared/types/Gig";

const DISCOVER_CITY_KEY = "wegig.discoverCity";
const INCLUDE_TRIBUTE_ACTS_KEY = "wegig.includeTributeActs";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

type TicketmasterEvent = {
  id?: string;
  source?: string;
  sourceEventId?: string;
  name?: string;
  title?: string;
  url?: string;
  ticketUrl?: string;
  date?: string;
  dateTime?: string;
  venueName?: string;
  city?: string;
  dates?: {
    start?: {
      localDate?: string;
    };
  };
  _embedded?: {
    venues?: Array<{
      name?: string;
      city?: { name?: string };
    }>;
  };
};

type TicketmasterResponse = {
  events?: TicketmasterEvent[];
  _embedded?: {
    events?: TicketmasterEvent[];
  };
};

type MbArtist = {
  id: string;
  name: string;
  disambiguation?: string;
  country?: string;
};

type MbArtistSearchResponse =
  | {
      artists?: MbArtist[];
    }
  | any;

const UI_COPY = {
  searching: "Searching gigs…",
  artistLoading: "Looking up artists…",
  emptySearch: "No gigs found. Try another artist, band or city.",
};

function isTributeEvent(event: TicketmasterEvent) {
 const venue = pickVenue(event);

 const text = [
   event.name,
   event.title,
   event.venueName,
   venue.venue,
   venue.city,
 ]
   .filter(Boolean)
   .join(" ")
   .toLowerCase();

 return [
   "tribute",
   "tributes",
   "tribute to",
   "a tribute",
   "the tribute",
   "tribute band",
   "tribute act",
   "experience",
   "uk tribute",
   "live tribute",
 ].some((term) => text.includes(term));
}

function filterTributeEvents(
  events: TicketmasterEvent[],
  includeTributeActs: boolean,
) {
  if (includeTributeActs) return events;
  return events.filter((event) => !isTributeEvent(event));
}

function getEventKey(item: TicketmasterEvent, index: number) {
  return `${item.source ?? "event"}-${
    item.sourceEventId ?? item.id ?? item.title ?? item.name ?? index
  }`;
}

function getEventName(item: TicketmasterEvent) {
  return item.title ?? item.name ?? "Untitled event";
}

function pickVenue(e: TicketmasterEvent) {
  const v = e._embedded?.venues?.[0];

  return {
    venue: e.venueName ?? v?.name ?? "Unknown venue",
    city: e.city ?? v?.city?.name ?? "Unknown city",
  };
}

type SocialAvatarKey = "guitar" | "drums" | "mic" | "piano" | "vinyl";

const AVATAR_IMAGES: Record<SocialAvatarKey, any> = {
  guitar: avatarPresets.find((p) => p.id === "guitar")?.image,
  drums: avatarPresets.find((p) => p.id === "drums")?.image,
  mic: avatarPresets.find((p) => p.id === "mic")?.image,
  piano: avatarPresets.find((p) => p.id === "piano")?.image,
  vinyl: avatarPresets.find((p) => p.id === "vinyl")?.image,
};

function getDiscoverySignal(seed: string) {
  const options: Array<{
    avatars: SocialAvatarKey[];
    text: string;
    extraCount?: number;
  }> = [
    {
      avatars: ["guitar", "mic", "vinyl"],
      text: "Worth a look for local gig discovery",
      extraCount: 12,
    },
    {
      avatars: ["drums", "guitar", "mic"],
      text: "Live music pick in your area",
      extraCount: 8,
    },
    {
      avatars: ["vinyl", "piano", "mic"],
      text: "One to watch on the scene",
      extraCount: 5,
    },
    {
      avatars: ["guitar", "drums"],
      text: "Strong local discovery pick",
      extraCount: 14,
    },
    {
      avatars: ["piano", "vinyl"],
      text: "Good fit for a night out",
      extraCount: 6,
    },
  ];

  const hash = seed
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return options[hash % options.length];
}

function AvatarStack(props: {
  avatars: SocialAvatarKey[];
  extraCount?: number;
}) {
  return (
    <View style={styles.socialRow}>
      <View style={styles.avatarStack}>
        {props.avatars.map((key, index) => (
          <Image
            key={`${key}-${index}`}
            source={AVATAR_IMAGES[key]}
            style={[
              styles.socialAvatar,
              index > 0 ? { marginLeft: -10 } : null,
            ]}
          />
        ))}
      </View>

      {props.extraCount ? (
        <Text style={styles.socialExtra}>+{props.extraCount}</Text>
      ) : null}
    </View>
  );
}

function SectionTitle(props: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{props.title}</Text>

      {props.subtitle ? (
        <Text style={styles.sectionSubtitle}>{props.subtitle}</Text>
      ) : null}
    </View>
  );
}

function EventCard(props: {
  item: TicketmasterEvent;
  cityFallback: string;
  artistMbid?: string;
  onAddToGigs: (draft: Partial<CreateGigInput>) => void;
}) {
  const eventName = getEventName(props.item);
  const date = props.item.date ?? props.item.dates?.start?.localDate ?? "";
  const v = pickVenue(props.item);
  const discovery = getDiscoverySignal(
    `${props.item.source ?? ""}-${props.item.sourceEventId ?? props.item.id ?? ""}-${eventName}`,
  );

  return (
    <View style={styles.resultCard}>
      <View style={styles.resultTopRow}>
        <View style={styles.resultIcon}>
          <Ionicons name="musical-notes" size={17} color="#7EB6FF" />
        </View>

        <View style={styles.resultTitleWrap}>
          <Text style={styles.resultTitle}>{eventName}</Text>
          <Text style={styles.resultMeta}>
            {v.venue} • {v.city}
          </Text>
        </View>
      </View>

      {date ? (
        <View style={styles.datePill}>
          <Ionicons
            name="calendar-outline"
            size={13}
            color={Colours.text.muted}
          />
          <Text style={styles.resultDate}>{date}</Text>
        </View>
      ) : null}

      <View style={styles.socialBlock}>
        <AvatarStack
          avatars={discovery.avatars}
          extraCount={discovery.extraCount}
        />
        <Text style={styles.socialText}>{discovery.text}</Text>
      </View>

      <Pressable
        onPress={() => {
          props.onAddToGigs({
            artist: eventName,
            artistMbid: props.artistMbid,
            venue: v.venue,
            city: v.city || props.cityFallback,
            date: date || new Date().toISOString().slice(0, 10),
            externalSource: props.item.source ?? "Ticketmaster",
            externalId: props.item.sourceEventId ?? props.item.id,
            ticketUrl: props.item.ticketUrl ?? props.item.url,
          });
        }}
        style={({ pressed }) => [
          styles.addBtn,
          pressed ? styles.addBtnPressed : null,
        ]}
      >
        <Text style={styles.addBtnText}>Add to gigs</Text>
        <Ionicons name="add" size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

export function DiscoverScreen(props: {
  onAddToGigs: (draft: Partial<CreateGigInput>) => void;
  onPressLogo?: () => void;
  scrollToTopSignal?: number;
}) {
  const scrollY = React.useRef(new Animated.Value(0)).current;
const scrollRef = React.useRef<ScrollView>(null);
const suppressNextArtistSearchRef = React.useRef(false);

  const [cityInput, setCityInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [includeTributeActs, setIncludeTributeActs] = React.useState(false);

  const [artistMbid, setArtistMbid] = React.useState<string | undefined>();
  const [mbLoading, setMbLoading] = React.useState(false);
  const [mbResults, setMbResults] = React.useState<MbArtist[]>([]);
  const [mbError, setMbError] = React.useState("");
  const [mbOpen, setMbOpen] = React.useState(false);

  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState("");
  const [searchEvents, setSearchEvents] = React.useState<TicketmasterEvent[]>(
    [],
  );

  const activeCity = cityInput.trim();
  const trimmedQuery = query.trim();
  const showingSearchResults =
    trimmedQuery.length >= 2 || activeCity.length >= 2;

  const loadPrefs = React.useCallback(async () => {
    try {
      const [savedCity, includeTributes] = await Promise.all([
        AsyncStorage.getItem(DISCOVER_CITY_KEY),
        AsyncStorage.getItem(INCLUDE_TRIBUTE_ACTS_KEY),
      ]);

      if (savedCity?.trim()) {
        setCityInput(savedCity.trim());
      }

      if (includeTributes != null) {
        setIncludeTributeActs(includeTributes === "1");
      }
    } catch {}
  }, []);

  React.useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  React.useEffect(() => {
    if (props.scrollToTopSignal == null) return;

    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }, [props.scrollToTopSignal]);

  React.useEffect(() => {
    const value = cityInput.trim();

    const t = setTimeout(() => {
      if (value) {
        AsyncStorage.setItem(DISCOVER_CITY_KEY, value).catch(() => {});
      } else {
        AsyncStorage.removeItem(DISCOVER_CITY_KEY).catch(() => {});
      }
    }, 400);

    return () => clearTimeout(t);
  }, [cityInput]);

  const runMbSearch = React.useCallback(async (q: string) => {
    const queryValue = q.trim();

    if (queryValue.length < 2) {
      setMbResults([]);
      setMbError("");
      setMbLoading(false);
      return;
    }

    setMbLoading(true);
    setMbError("");

    try {
      const res = await apiGet<MbArtistSearchResponse>(
        `/mb/artists/search?q=${encodeURIComponent(queryValue)}`,
      );

      const artists: MbArtist[] =
        (res?.artists as MbArtist[]) ??
        (res?._embedded?.artists as MbArtist[]) ??
        [];

      setMbResults(Array.isArray(artists) ? artists.slice(0, 8) : []);
      setMbOpen(true);
    } catch (e: any) {
      setMbError(e?.message ?? "Artist search failed");
      setMbResults([]);
      setMbOpen(false);
    } finally {
      setMbLoading(false);
    }
  }, []);

 const chooseArtist = (artist: MbArtist) => {
 suppressNextArtistSearchRef.current = true;
 setQuery(artist.name);
 setArtistMbid(artist.id);
 setMbOpen(false);
 setMbResults([]);
 setMbError("");
 Keyboard.dismiss();
};

  React.useEffect(() => {
    setArtistMbid(undefined);

    const q = query.trim();

    if (q.length < 2) {
      setMbResults([]);
      setMbOpen(false);
      setMbError("");
      return;
    }

    const t = setTimeout(() => {
      void runMbSearch(q);
    }, 320);

    return () => clearTimeout(t);
  }, [query, runMbSearch]);

  const searchArtists = React.useCallback(async () => {
    if (trimmedQuery.length < 2 && activeCity.length < 2) {
      setSearchEvents([]);
      setSearchError("");
      return;
    }

    setSearchLoading(true);
    setSearchError("");

    try {
      const qs = new URLSearchParams();

      if (trimmedQuery.length >= 2) {
        qs.set("keyword", trimmedQuery);
      }

      if (activeCity.length >= 2) {
        qs.set("city", activeCity);
      }

      qs.set("size", "20");

      const res = await apiGet<TicketmasterResponse>(
        `/discover/events?${qs.toString()}`,
      );

      const rawEvents = res.events ?? res._embedded?.events ?? [];

      const cityFilteredEvents =
        activeCity.length >= 2
          ? rawEvents.filter((event) => {
              const eventCity = String(event.city ?? "").toLowerCase();
              const venueCity = String(
                event._embedded?.venues?.[0]?.city?.name ?? "",
              ).toLowerCase();
              const cityNeedle = activeCity.toLowerCase();

              return (
                eventCity.includes(cityNeedle) ||
                venueCity.includes(cityNeedle)
              );
            })
          : rawEvents;

      const events = filterTributeEvents(
        cityFilteredEvents,
        includeTributeActs,
      );

      setSearchEvents(events);
    } catch (e: any) {
      setSearchError(e?.message ?? "Search failed");
      setSearchEvents([]);
    } finally {
      setSearchLoading(false);
    }
  }, [activeCity, includeTributeActs, trimmedQuery]);

  React.useEffect(() => {
    if (trimmedQuery.length < 2 && activeCity.length < 2) {
      setSearchEvents([]);
      setSearchError("");
      return;
    }

    const t = setTimeout(() => {
      void searchArtists();
    }, 350);

    return () => clearTimeout(t);
  }, [trimmedQuery, activeCity, searchArtists]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <AppHeader onPressLogo={props.onPressLogo} scrollY={scrollY} />

        <AnimatedScrollView
          ref={scrollRef}
          style={styles.list}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
        >
          <View style={styles.heroWrap}>
            <View style={styles.heroGlow} />

            <View style={styles.titleRow}>
              <View>
                <Text style={styles.screenTitle}>Discover</Text>
                <Text style={styles.screenSubtitle}>
                  Search gigs and add them in one tap.
                </Text>
              </View>

              <View style={styles.headerIcon}>
                <Ionicons name="sparkles" size={20} color="#7EB6FF" />
              </View>
            </View>

            <View style={styles.searchPanel}>
              <TextField
                label="Artist or band"
                value={query}
                onChangeText={(text) => {
 setQuery(text);
 setArtistMbid(undefined);
 setMbOpen(true);
}}

                placeholder="e.g. Foo Fighters"
                autoCapitalize="none"
              />

              {mbLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator />
                  <Text style={styles.loadingText}>{UI_COPY.artistLoading}</Text>
                </View>
              ) : null}

              {mbError ? <Text style={styles.errorText}>{mbError}</Text> : null}

              {mbOpen && !mbLoading && mbResults.length > 0 ? (
                <View style={styles.suggestCard}>
                  {mbResults.map((artist) => {
                    const meta = [artist.country, artist.disambiguation]
                      .filter(Boolean)
                      .join(" • ");

                    return (
                      <Pressable
                        key={artist.id}
                        onPress={() => chooseArtist(artist)}
                        style={({ pressed }) => [
                          styles.suggestRow,
                          pressed ? styles.rowPressed : null,
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestTitle}>{artist.name}</Text>
                          {meta ? (
                            <Text style={styles.suggestMeta}>{meta}</Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {artistMbid ? (
                <Text style={styles.matchedText}>Matched artist ✓</Text>
              ) : null}

              <TextField
                label="City"
                value={cityInput}
                onChangeText={setCityInput}
                placeholder="e.g. London"
                autoCapitalize="words"
              />

              <View style={styles.tipRow}>
                <Ionicons
                  name="search-outline"
                  size={15}
                  color={Colours.text.muted}
                />
                <Text style={styles.tipText}>
                  Search by artist, city, or both.
                </Text>
              </View>

              {showingSearchResults ? (
                searchLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator />
                    <Text style={styles.loadingText}>{UI_COPY.searching}</Text>
                  </View>
                ) : searchError ? (
                  <Text style={styles.errorText}>{searchError}</Text>
                ) : null
              ) : null}
            </View>
          </View>

          {showingSearchResults ? (
            <View style={styles.sectionBlock}>
              <SectionTitle
                title={
                  activeCity
                    ? `Search results · ${activeCity}`
                    : "Search results"
                }
                subtitle={
                  searchEvents.length > 0
                    ? `${searchEvents.length} upcoming ${
                        searchEvents.length === 1 ? "gig" : "gigs"
                      } found`
                    : undefined
                }
              />

              {searchEvents.length > 0 ? (
                <View style={styles.cardList}>
                  {searchEvents.map((item, index) => (
                    <View key={getEventKey(item, index)} style={styles.cardWrap}>
                      <EventCard
                        item={item}
                        cityFallback={activeCity}
                        artistMbid={artistMbid}
                        onAddToGigs={props.onAddToGigs}
                      />
                    </View>
                  ))}
                </View>
              ) : !searchLoading ? (
                <View style={styles.emptyCard}>
                  <Ionicons
                    name="radio-outline"
                    size={22}
                    color={Colours.text.muted}
                  />
                  <Text style={styles.emptyTitle}>Nothing found yet</Text>
                  <Text style={styles.emptyHint}>{UI_COPY.emptySearch}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons
                name="ticket-outline"
                size={24}
                color={Colours.text.muted}
              />
              <Text style={styles.emptyTitle}>Start with a search</Text>
              <Text style={styles.emptyHint}>
                Search by artist or city to find upcoming gigs.
              </Text>
            </View>
          )}

          <View style={{ height: 24 }} />
        </AnimatedScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colours.background.app,
  },

  keyboardWrap: {
    flex: 1,
  },

  list: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 180,
  },

  heroWrap: {
    marginBottom: 22,
  },

  heroGlow: {
    position: "absolute",
    top: -30,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(47,140,255,0.12)",
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
  },

  screenTitle: {
    color: Colours.text.primary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  screenSubtitle: {
    color: Colours.text.muted,
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },

  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "rgba(47,140,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(126,182,255,0.16)",
  },

  searchPanel: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.075)",
    padding: 14,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },

  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: -2,
  },

  tipText: {
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },

  loadingText: {
    color: Colours.text.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },

  errorText: {
    color: Colours.text.danger,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },

  matchedText: {
    color: "#2EE59D",
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 18,
  },

  suggestCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    overflow: "hidden",
  },

  suggestRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  rowPressed: {
    opacity: 0.9,
  },

  suggestTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 18,
  },

  suggestMeta: {
    marginTop: 2,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  sectionBlock: {
    marginTop: 20,
  },

  sectionTitleWrap: {
    marginBottom: 10,
  },

  sectionTitle: {
    color: Colours.text.primary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  sectionSubtitle: {
    marginTop: 4,
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  cardList: {
    gap: 12,
  },

  cardWrap: {
    width: "100%",
  },

  resultCard: {
    backgroundColor: "rgba(255,255,255,0.045)",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.075)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },

  resultTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },

  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(126,182,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  resultTitleWrap: {
    flex: 1,
  },

  resultTitle: {
    color: Colours.text.primary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.15,
  },

  resultMeta: {
    color: Colours.text.muted,
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },

  datePill: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.055)",
  },

  resultDate: {
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },

  socialBlock: {
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  socialRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },

  socialAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colours.background.app,
    backgroundColor: Colours.background.card,
  },

  socialExtra: {
    marginLeft: 8,
    color: Colours.text.muted,
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 16,
  },

  socialText: {
    marginTop: 8,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  addBtn: {
    marginTop: 14,
    height: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#2F8CFF",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#2F8CFF",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },

  addBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  addBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  emptyCard: {
    marginTop: 20,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    gap: 8,
  },

  emptyTitle: {
    color: Colours.text.primary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },

  emptyHint: {
    color: Colours.text.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
  },
});

