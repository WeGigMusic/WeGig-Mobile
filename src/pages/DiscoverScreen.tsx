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
import type { CreateGigInput, Gig, GigsResponse } from "../shared/types/Gig";

const HOME_CITY_KEY = "wegig.homeCity";
const DISCOVER_CITY_KEY = "wegig.discoverCity";

const LOCATION_RADII_MILES = [10, 25, 50];

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

type LocationCoords = {
  latitude: number;
  longitude: number;
};

const UI_COPY = {
  searching: "Searching gigs…",
  detectingLocation: "Finding your city…",
  nearbyLoading: "Loading gigs near you…",
  similarLoading: "Loading similar gigs…",
  emptySearch: "No gigs found. Try another artist, band or city.",
  noNearbyWithCity: (city: string) =>
    `No gigs found in ${city} right now. Try another city or search for an artist.`,
  noNearbyNoCity: "Add a city or use your location to see gigs near you.",
  noSimilar: "Log a few more gigs and similar recommendations will get better.",
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
  const [locationCoords, setLocationCoords] =
    React.useState<LocationCoords | null>(null);
  const [locationLoading, setLocationLoading] = React.useState(false);
  const [locationError, setLocationError] = React.useState("");
  const [useLocation, setUseLocation] = React.useState(false);

  const activeCity = cityInput.trim();
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
      const [discoverCity, homeCity] = await Promise.all([
        AsyncStorage.getItem(DISCOVER_CITY_KEY),
        AsyncStorage.getItem(HOME_CITY_KEY),
      ]);

      if (discoverCity?.trim()) {
        setCityInput(discoverCity.trim());
        return;
      }

      if (homeCity?.trim()) {
        setCityInput(homeCity.trim());
      }
    } catch {}
  }, []);

  const loadLoggedGigs = React.useCallback(async () => {
    try {
      const res = await apiGet<GigsResponse>("/gigs");
      setLoggedGigs(res.gigs ?? []);
    } catch {
      setLoggedGigs([]);
    }
  }, []);

  const resolveDeviceCity = React.useCallback(async (): Promise<string> => {
    setLocationLoading(true);
    setLocationError("");

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setDetectedCity("");
        setLocationCoords(null);
        setLocationError(
          permission.canAskAgain
            ? "Location permission not granted"
            : "Location permission is blocked. Enable it in Settings.",
        );
        return "";
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

    const coords = {
 latitude: position.coords.latitude,
 longitude: position.coords.longitude,
};

setLocationCoords(coords); 

      try {
        const resolved = await reverseGeocodeCity(coords);

        if (resolved.trim()) {
          const city = resolved.trim();
          setDetectedCity(city);
setCityInput(city);
return city;
        }
      } catch {}

      const places = await Location.reverseGeocodeAsync(coords);
      const place = places[0];

      const fallbackCity =
        place?.city || place?.subregion || place?.region || "";

      if (fallbackCity.trim()) {
        const city = fallbackCity.trim();
        setDetectedCity(city);
setCityInput(city);
return city;
      }

      setDetectedCity("");
      setLocationError("Could not detect your city");
      return "";
    } catch {
      setDetectedCity("");
      setLocationCoords(null);
      setLocationError("Could not detect your location");
      return "";
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const fetchTicketmasterEvents = React.useCallback(
    async (params: {
      keyword?: string;
      size: number;
    }): Promise<TicketmasterEvent[]> => {
      if (useLocation && locationCoords) {
        for (const radius of LOCATION_RADII_MILES) {
          const qs = new URLSearchParams();

          if (params.keyword?.trim()) {
            qs.set("keyword", params.keyword.trim());
          }

          qs.set(
            "latlong",
            `${locationCoords.latitude},${locationCoords.longitude}`,
          );
          qs.set("radius", String(radius));
          qs.set("unit", "miles");
          qs.set("size", String(params.size));

          const res = await apiGet<TicketmasterResponse>(
            `/tm/events/search?${qs.toString()}`,
          );

          const events = res._embedded?.events ?? [];

          if (events.length > 0 || radius === LOCATION_RADII_MILES.at(-1)) {
            return events;
          }
        }

        return [];
      }

      const qs = new URLSearchParams();

      if (params.keyword?.trim()) {
        qs.set("keyword", params.keyword.trim());
      }

      if (activeCity) {
        qs.set("city", activeCity);
      }

      qs.set("size", String(params.size));

      const res = await apiGet<TicketmasterResponse>(
        `/tm/events/search?${qs.toString()}`,
      );

      return res._embedded?.events ?? [];
    },
    [activeCity, locationCoords, useLocation],
  );

  React.useEffect(() => {
    void loadSavedCity();
    void loadLoggedGigs();
  }, [loadSavedCity, loadLoggedGigs]);

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

  const searchArtists = React.useCallback(async () => {
    if (trimmedQuery.length < 2) {
      setSearchEvents([]);
      setSearchError("");
      return;
    }

    setSearchLoading(true);
    setSearchError("");

    try {
      const events = await fetchTicketmasterEvents({
        keyword: trimmedQuery,
        size: 20,
      });

      setSearchEvents(events);
    } catch (e: any) {
      setSearchError(e?.message ?? "Search failed");
      setSearchEvents([]);
    } finally {
      setSearchLoading(false);
    }
  }, [trimmedQuery, fetchTicketmasterEvents]);

  const loadNearYou = React.useCallback(async () => {
    if (!activeCity && !(useLocation && locationCoords)) {
      setNearYouEvents([]);
      return;
    }

    setNearYouLoading(true);

    try {
      const events = await fetchTicketmasterEvents({
        size: 5,
      });

      setNearYouEvents(events);
    } catch {
      setNearYouEvents([]);
    } finally {
      setNearYouLoading(false);
    }
  }, [activeCity, fetchTicketmasterEvents, locationCoords, useLocation]);

  const loadSimilar = React.useCallback(async () => {
    if (!latestArtist) {
      setSimilarEvents([]);
      return;
    }

    setSimilarLoading(true);

    try {
      const qs = new URLSearchParams();

qs.set("keyword", latestArtist);
qs.set("size", "5");

const res = await apiGet<TicketmasterResponse>(
 `/tm/events/search?${qs.toString()}`,
);

const events = res._embedded?.events ?? [];


      const nextEvents = events.filter(
        (event) => event.name !== latestArtist || event.id !== latestGig?.id,
      );

      setSimilarEvents(nextEvents);
    } catch {
      setSimilarEvents([]);
    } finally {
      setSimilarLoading(false);
    }
  }, [latestArtist, latestGig?.id]);

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
    async (next: boolean) => {
      setUseLocation(next);

      if (!next) return;

      const resolvedCity = await resolveDeviceCity();

      if (!resolvedCity) {
        setLocationError("Location is on, but we couldn't detect your city.");
      }
    },
    [resolveDeviceCity],
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
                  <View style={styles.flex}>
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
                    onValueChange={(next) => {
                      void handleToggleLocation(next);
                    }}
                    disabled={locationLoading}
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
                      <Text style={styles.loadingText}>
                        {UI_COPY.searching}
                      </Text>
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
                  activeCity ? `Search results · ${activeCity}` : "Search results"
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
                        ? `Recommendations for you`
                        : "Similar gigs"
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
                  subtitle={
                    useLocation && locationCoords
                      ? "Expands from 10 to 50 miles if needed"
                      : undefined
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

  flex: {
    flex: 1,
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

  heroCard: {
    backgroundColor: "transparent",
  },

  screenTitle: {
    color: Colours.text.primary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  screenSubtitle: {
    color: Colours.text.muted,
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },

  formBlock: {
    marginTop: 18,
    gap: 16,
  },

  locationRow: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  locationToggleTitle: {
    color: Colours.text.primary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },

  locationMetaText: {
    marginTop: 4,
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

  inlineInfoRow: {
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

  emptyHint: {
    color: Colours.text.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },

  sectionBlock: {
    marginTop: 20,
  },

  sectionTitleWrap: {
    marginBottom: 10,
  },

  sectionTitle: {
    color: Colours.text.primary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: -0.15,
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
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
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

  resultDate: {
    color: Colours.text.muted,
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  resultActionWrap: {
    marginTop: 14,
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
});


