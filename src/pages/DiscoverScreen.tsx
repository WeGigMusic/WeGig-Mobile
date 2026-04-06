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
  Switch,
} from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { reverseGeocodeCity } from "../lib/mapbox";
import { avatarPresets } from "../config/avatarPresets";
import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { apiGet } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { Colours } from "../theme/colours";

import type {
  CreateGigInput,
  Gig,
  GigsResponse,
} from "../shared/types/Gig";

const HOME_CITY_KEY = "wegig.homeCity";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

type TicketmasterEvent = {
  id: string;
  name: string;
  url?: string;
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
  _embedded?: {
    events?: TicketmasterEvent[];
  };
};

const UI_COPY = {
  searching: "Searching gigs…",
  detectingLocation: "Finding your city…",
  nearbyLoading: "Loading gigs near you…",
  similarLoading: "Loading similar gigs…",
  emptySearch: "No gigs found. Try another artist, band or city.",
  noNearbyWithCity: (city: string) =>
    `No gigs found in ${city} right now. Try another city or search for an artist.`,
  noNearbyNoCity:
    "Add a city or use your location to see gigs near you.",
  noSimilar:
    "Log a few more gigs and similar recommendations will get better.",
  useLocationLabel: (city: string) =>
    city ? `Use my location (${city})` : "Use my location",
};

function pickVenue(e: TicketmasterEvent) {
  const v = e._embedded?.venues?.[0];
  return {
    venue: v?.name ?? "Unknown venue",
    city: v?.city?.name ?? "Unknown city",
  };
}

function getLatestLoggedGig(gigs: Gig[]) {
  return [...gigs].sort((a, b) => {
    const aTime = new Date(a.date ?? 0).getTime();
    const bTime = new Date(b.date ?? 0).getTime();
    return bTime - aTime;
  })[0];
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
  onAddToGigs: (draft: Partial<CreateGigInput>) => void;
}) {
  const date = props.item.dates?.start?.localDate ?? "";
  const v = pickVenue(props.item);
  const discovery = getDiscoverySignal(`${props.item.id}-${props.item.name}`);

  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultTitle}>{props.item.name}</Text>

      <Text style={styles.resultMeta}>
        {v.venue} • {v.city}
      </Text>

      {date ? <Text style={styles.resultDate}>{date}</Text> : null}

      <View style={styles.socialBlock}>
        <AvatarStack
          avatars={discovery.avatars}
          extraCount={discovery.extraCount}
        />
        <Text style={styles.socialText}>{discovery.text}</Text>
      </View>

      <View style={styles.resultActionWrap}>
        <PrimaryButton
          title="Add to gigs"
          onPress={() => {
            props.onAddToGigs({
              artist: props.item.name,
              venue: v.venue,
              city: v.city || props.cityFallback,
              date: date || new Date().toISOString().slice(0, 10),
              externalSource: "Ticketmaster",
              externalId: props.item.id,
              ticketUrl: props.item.url,
            });
          }}
          style={styles.resultActionBtn}
        />
      </View>
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

  const [cityInput, setCityInput] = React.useState("");
  const [query, setQuery] = React.useState("");

  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState("");
  const [searchEvents, setSearchEvents] = React.useState<TicketmasterEvent[]>(
    [],
  );

  const [nearYouLoading, setNearYouLoading] = React.useState(false);
  const [nearYouEvents, setNearYouEvents] = React.useState<TicketmasterEvent[]>(
    [],
  );

  const [similarLoading, setSimilarLoading] = React.useState(false);
  const [similarEvents, setSimilarEvents] = React.useState<TicketmasterEvent[]>(
    [],
  );

  const [loggedGigs, setLoggedGigs] = React.useState<Gig[]>([]);
  const [detectedCity, setDetectedCity] = React.useState("");
  const [locationLoading, setLocationLoading] = React.useState(false);
  const [locationError, setLocationError] = React.useState("");
  const [useLocation, setUseLocation] = React.useState(false);

  const activeCity = useLocation ? detectedCity.trim() : cityInput.trim();
  const trimmedQuery = query.trim();
  const showingSearchResults = trimmedQuery.length >= 2;
  const latestGig = React.useMemo(
    () => getLatestLoggedGig(loggedGigs),
    [loggedGigs],
  );
  const latestArtist = latestGig?.artist?.trim() ?? "";
  const hasLoggedGigs = loggedGigs.length > 0;

  const loadSavedCity = React.useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(HOME_CITY_KEY);
      if (saved?.trim()) {
        setCityInput(saved.trim());
      }
    } catch {
      // ignore
    }
  }, []);

  const loadLoggedGigs = React.useCallback(async () => {
    try {
      const res = await apiGet<GigsResponse>("/gigs");
      setLoggedGigs(res.gigs ?? []);
    } catch {
      setLoggedGigs([]);
    }
  }, []);

  const resolveDeviceCity = React.useCallback(async () => {
    setLocationLoading(true);
    setLocationError("");

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setDetectedCity("");
        setUseLocation(false);
        setLocationError("Location permission not granted");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      try {
        const resolved = await reverseGeocodeCity(coords);

        if (!resolved.trim()) {
          setDetectedCity("");
          setLocationError("Could not detect your city");
          return;
        }

        setDetectedCity(resolved.trim());
        return;
      } catch {
        const places = await Location.reverseGeocodeAsync(coords);

        const place = places[0];
        const fallbackCity =
          place?.city || place?.subregion || place?.region || "";

        if (fallbackCity.trim()) {
          setDetectedCity(fallbackCity.trim());
          return;
        }

        setDetectedCity("");
        setLocationError("Could not detect your city");
      }
    } catch {
      setDetectedCity("");
      setLocationError("Could not detect your location");
    } finally {
      setLocationLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadLoggedGigs();
    void resolveDeviceCity();
  }, [loadLoggedGigs, resolveDeviceCity]);

  React.useEffect(() => {
    if (props.scrollToTopSignal == null) return;

    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }, [props.scrollToTopSignal]);

  React.useEffect(() => {
    const value = cityInput.trim();

    if (!value) return;

    const t = setTimeout(() => {
      AsyncStorage.setItem(HOME_CITY_KEY, value).catch(() => {});
    }, 400);

    return () => clearTimeout(t);
  }, [cityInput]);

  React.useEffect(() => {
    if (!useLocation) return;
    if (detectedCity.trim()) return;
    void resolveDeviceCity();
  }, [useLocation, detectedCity, resolveDeviceCity]);

  const searchArtists = React.useCallback(async () => {
    if (trimmedQuery.length < 2) {
      setSearchEvents([]);
      setSearchError("");
      return;
    }

    setSearchLoading(true);
    setSearchError("");

    try {
      const qs = new URLSearchParams();
      qs.set("keyword", trimmedQuery);
      if (activeCity) qs.set("city", activeCity);
      qs.set("size", "20");

      const res = await apiGet<TicketmasterResponse>(
        `/tm/events/search?${qs.toString()}`,
      );

      setSearchEvents(res._embedded?.events ?? []);
    } catch (e: any) {
      setSearchError(e?.message ?? "Search failed");
      setSearchEvents([]);
    } finally {
      setSearchLoading(false);
    }
  }, [trimmedQuery, activeCity]);

  const loadNearYou = React.useCallback(async () => {
    if (!activeCity) {
      setNearYouEvents([]);
      return;
    }

    setNearYouLoading(true);

    try {
      const qs = new URLSearchParams();
      qs.set("city", activeCity);
      qs.set("size", "5");

      const res = await apiGet<TicketmasterResponse>(
        `/tm/events/search?${qs.toString()}`,
      );

      setNearYouEvents(res._embedded?.events ?? []);
    } catch {
      setNearYouEvents([]);
    } finally {
      setNearYouLoading(false);
    }
  }, [activeCity]);

  const loadSimilar = React.useCallback(async () => {
    if (!latestArtist) {
      setSimilarEvents([]);
      return;
    }

    setSimilarLoading(true);

    try {
      const qs = new URLSearchParams();
      qs.set("keyword", latestArtist);
      if (activeCity) qs.set("city", activeCity);
      qs.set("size", "5");

      const res = await apiGet<TicketmasterResponse>(
        `/tm/events/search?${qs.toString()}`,
      );

      const nextEvents = (res._embedded?.events ?? []).filter(
        (event) => event.name !== latestArtist || event.id !== latestGig?.id,
      );

      setSimilarEvents(nextEvents);
    } catch {
      setSimilarEvents([]);
    } finally {
      setSimilarLoading(false);
    }
  }, [latestArtist, latestGig?.id, activeCity]);

  React.useEffect(() => {
    if (trimmedQuery.length < 2) {
      setSearchEvents([]);
      setSearchError("");
      return;
    }

    const t = setTimeout(() => {
      void searchArtists();
    }, 350);

    return () => clearTimeout(t);
  }, [trimmedQuery, searchArtists]);

  React.useEffect(() => {
    if (showingSearchResults) return;
    void loadNearYou();
  }, [showingSearchResults, loadNearYou]);

  React.useEffect(() => {
    if (!hasLoggedGigs) {
      setSimilarEvents([]);
      return;
    }

    if (showingSearchResults) return;

    void loadSimilar();
  }, [hasLoggedGigs, showingSearchResults, loadSimilar]);

  const handleToggleLocation = React.useCallback(
    (next: boolean) => {
      if (next && !detectedCity.trim()) {
        void resolveDeviceCity();
      }
      setUseLocation(next);
    },
    [detectedCity, resolveDeviceCity],
  );

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
            <View style={styles.heroCard}>
              <Text style={styles.screenTitle}>Discover</Text>
              <Text style={styles.screenSubtitle}>
                Find gigs near you and add them to your log in one tap.
              </Text>

              <View style={styles.formBlock}>
                <TextField
                  label="Artist or band"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="e.g. Foo Fighters"
                  autoCapitalize="none"
                />

                <TextField
                  label="City"
                  value={cityInput}
                  onChangeText={setCityInput}
                  placeholder="e.g. London"
                  autoCapitalize="words"
                />

                <View style={styles.locationRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationToggleTitle}>
                      {UI_COPY.useLocationLabel(detectedCity)}
                    </Text>

                    {locationLoading ? (
                      <Text style={styles.locationMetaText}>
                        {UI_COPY.detectingLocation}
                      </Text>
                    ) : locationError ? (
                      <Text style={styles.locationMetaText}>
                        {locationError}
                      </Text>
                    ) : useLocation && detectedCity ? (
                      <Text style={styles.locationMetaText}>
                        Showing gigs near {detectedCity}
                      </Text>
                    ) : null}
                  </View>

                  <Switch
                    value={useLocation}
                    onValueChange={handleToggleLocation}
                    disabled={locationLoading || !detectedCity.trim()}
                    trackColor={{
                      false: "rgba(255,255,255,0.18)",
                      true: "rgba(47,140,255,0.35)",
                    }}
                    thumbColor={
                      useLocation ? "#2F8CFF" : "rgba(255,255,255,0.8)"
                    }
                    ios_backgroundColor="rgba(255,255,255,0.18)"
                  />
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
          </View>

          {showingSearchResults ? (
            <View style={styles.sectionBlock}>
              <SectionTitle
                title={
                  activeCity
                    ? `Search results · ${activeCity}`
                    : "Search results"
                }
              />

              {searchEvents.length > 0 ? (
                <View style={styles.cardList}>
                  {searchEvents.map((item) => (
                    <View key={item.id} style={styles.cardWrap}>
                      <EventCard
                        item={item}
                        cityFallback={activeCity}
                        onAddToGigs={props.onAddToGigs}
                      />
                    </View>
                  ))}
                </View>
              ) : !searchLoading ? (
                <Text style={styles.emptyHint}>{UI_COPY.emptySearch}</Text>
              ) : null}
            </View>
          ) : (
            <>
              {hasLoggedGigs ? (
                <View style={styles.sectionBlock}>
                  <SectionTitle
                    title={
                      latestArtist
                        ? `Because you saw ${latestArtist}`
                        : "Similar gigs"
                    }
                    subtitle={
                      activeCity ? `Filtered to ${activeCity}` : undefined
                    }
                  />

                  {similarLoading ? (
                    <View style={styles.inlineInfoRow}>
                      <ActivityIndicator />
                      <Text style={styles.loadingText}>
                        {UI_COPY.similarLoading}
                      </Text>
                    </View>
                  ) : similarEvents.length > 0 ? (
                    <View style={styles.cardList}>
                      {similarEvents.map((item) => (
                        <View key={item.id} style={styles.cardWrap}>
                          <EventCard
                            item={item}
                            cityFallback={activeCity}
                            onAddToGigs={props.onAddToGigs}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyHint}>{UI_COPY.noSimilar}</Text>
                  )}
                </View>
              ) : null}

              <View style={styles.sectionBlock}>
                <SectionTitle
                  title={
                    activeCity
                      ? useLocation
                        ? `Near you · ${activeCity}`
                        : `Gigs in ${activeCity}`
                      : "Near you"
                  }
                />

                {nearYouLoading ? (
                  <View style={styles.inlineInfoRow}>
                    <ActivityIndicator />
                    <Text style={styles.loadingText}>
                      {UI_COPY.nearbyLoading}
                    </Text>
                  </View>
                ) : nearYouEvents.length > 0 ? (
                  <View style={styles.cardList}>
                    {nearYouEvents.map((item) => (
                      <View key={item.id} style={styles.cardWrap}>
                        <EventCard
                          item={item}
                          cityFallback={activeCity}
                          onAddToGigs={props.onAddToGigs}
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyHint}>
                    {activeCity
                      ? UI_COPY.noNearbyWithCity(activeCity)
                      : UI_COPY.noNearbyNoCity}
                  </Text>
                )}
              </View>
            </>
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
    paddingBottom: 24,
  },

  heroWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },

  heroCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },

  screenTitle: {
    color: Colours.text.primary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },

  screenSubtitle: {
    color: Colours.text.muted,
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  formBlock: {
    marginTop: 10,
    gap: 10,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  locationToggleTitle: {
    color: Colours.text.primary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },

  locationMetaText: {
    marginTop: 4,
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  inlineInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },

  loadingText: {
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  errorText: {
    color: Colours.text.danger,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },

  emptyHint: {
    color: Colours.text.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  sectionBlock: {
    paddingHorizontal: 16,
    marginTop: 6,
  },

  sectionTitleWrap: {
    marginBottom: 10,
  },

  sectionTitle: {
    color: Colours.text.primary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },

  sectionSubtitle: {
    marginTop: 4,
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  cardList: {
    gap: 10,
  },

  cardWrap: {
    width: "100%",
  },

  resultCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },

  resultTitle: {
    color: Colours.text.primary,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "700",
  },

  resultMeta: {
    color: Colours.text.muted,
    marginTop: 5,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },

  resultDate: {
    color: Colours.text.muted,
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },

  resultActionWrap: {
    marginTop: 12,
    alignSelf: "flex-start",
  },

  resultActionBtn: {
    alignSelf: "flex-start",
  },

  socialBlock: {
    marginTop: 12,
    paddingTop: 12,
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
    borderColor: Colours.background.card,
    backgroundColor: Colours.background.card,
  },

  socialExtra: {
    marginLeft: 8,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  socialText: {
    marginTop: 8,
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
  },
});