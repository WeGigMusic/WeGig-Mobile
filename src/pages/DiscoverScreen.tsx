import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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

import type { CreateGigInput } from "../shared/types/Gig";

const HOME_CITY_KEY = "wegig.homeCity";

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

const COLORS = {
  bg: "#0B0B10",
  card: "#141422",
  card2: "#10101A",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.65)",
  faint: "rgba(255,255,255,0.12)",
  danger: "#FF4D4D",
  accent: "#2F8CFF",
};

function pickVenue(e: TicketmasterEvent) {
  const v = e._embedded?.venues?.[0];
  return {
    venue: v?.name ?? "Unknown venue",
    city: v?.city?.name ?? "Unknown city",
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

function getSocialSignal(seed: string) {
  const options: Array<{
    avatars: SocialAvatarKey[];
    text: string;
    extraCount?: number;
  }> = [
    {
      avatars: ["guitar", "mic", "vinyl"],
      text: "Popular with fans who saw similar artists",
      extraCount: 12,
    },
    {
      avatars: ["drums", "guitar", "mic"],
      text: "High-energy crowd pick near you",
      extraCount: 8,
    },
    {
      avatars: ["vinyl", "piano", "mic"],
      text: "Scene discovery favourite",
      extraCount: 5,
    },
    {
      avatars: ["guitar", "drums"],
      text: "Big with live-music regulars",
      extraCount: 14,
    },
    {
      avatars: ["piano", "vinyl"],
      text: "Strong match for your taste profile",
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

function SectionTitle(props: { title: string }) {
  return <Text style={styles.sectionTitle}>{props.title}</Text>;
}

function EventCard(props: {
  item: TicketmasterEvent;
  cityFallback: string;
  onAddToGigs: (draft: Partial<CreateGigInput>) => void;
}) {
  const date = props.item.dates?.start?.localDate ?? "";
  const v = pickVenue(props.item);
  const social = getSocialSignal(`${props.item.id}-${props.item.name}`);

  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultTitle}>{props.item.name}</Text>

      <Text style={styles.resultMeta}>
        {v.venue} • {v.city}
      </Text>

      {date ? <Text style={styles.resultDate}>{date}</Text> : null}

      <View style={styles.socialBlock}>
        <AvatarStack
          avatars={social.avatars}
          extraCount={social.extraCount}
        />
        <Text style={styles.socialText}>{social.text}</Text>
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
              notes: "Imported from Ticketmaster",
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
}) {
  const [city, setCity] = React.useState("");
  const [query, setQuery] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [events, setEvents] = React.useState<TicketmasterEvent[]>([]);

  const [nearYouLoading, setNearYouLoading] = React.useState(false);
  const [nearYouEvents, setNearYouEvents] = React.useState<TicketmasterEvent[]>(
    [],
  );

  const [detectedCity, setDetectedCity] = React.useState("");
  const [locationLoading, setLocationLoading] = React.useState(true);
  const [locationError, setLocationError] = React.useState("");

  const activeCity = city.trim() || detectedCity.trim();

  const resolveDeviceCity = React.useCallback(async () => {
    setLocationLoading(true);
    setLocationError("");

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setDetectedCity("");
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
    let cancelled = false;

    (async () => {
      try {
        const saved = await AsyncStorage.getItem(HOME_CITY_KEY);
        if (!cancelled && saved?.trim()) {
          setCity(saved.trim());
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    void resolveDeviceCity();
  }, [resolveDeviceCity]);

  React.useEffect(() => {
    const value = city.trim();

    if (!value) return;

    AsyncStorage.setItem(HOME_CITY_KEY, value).catch(() => {});
  }, [city]);

  const search = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const qs = new URLSearchParams();

      if (query.trim()) qs.set("keyword", query.trim());
      if (activeCity) qs.set("city", activeCity);
      qs.set("size", "20");

      const res = await apiGet<TicketmasterResponse>(
        `/tm/events/search?${qs.toString()}`,
      );

      setEvents(res._embedded?.events ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Search failed");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [activeCity, query]);

  const loadNearYou = React.useCallback(async () => {
    if (!activeCity) {
      setNearYouEvents([]);
      return;
    }

    setNearYouLoading(true);

    try {
      const qs = new URLSearchParams();
      qs.set("city", activeCity);
      qs.set("size", "6");

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

  React.useEffect(() => {
    if (!activeCity) return;
    if (query.trim().length > 0) return;
    void loadNearYou();
  }, [activeCity, query, loadNearYou]);

  React.useEffect(() => {
    const q = query.trim();

    if (q.length < 2) {
      setEvents([]);
      setError("");
      return;
    }

    const t = setTimeout(() => {
      void search();
    }, 350);

    return () => clearTimeout(t);
  }, [query, search]);

  const hasResults = events.length > 0;
  const isCompact = query.trim().length > 0 || hasResults;
  const showingSearchResults = query.trim().length > 0;
  const isUsingManualCity = city.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <AppHeader onPressLogo={props.onPressLogo} />

        <View style={styles.heroWrap}>
          <View
            style={[
              styles.heroCard,
              isCompact ? styles.heroCardCompact : null,
            ]}
          >
            <Text style={styles.screenTitle}>Discover</Text>

            {!isCompact ? (
              <Text style={styles.screenSubtitle}>
                Search Ticketmaster and prefill your gig log in one tap.
              </Text>
            ) : null}

            <View
              style={[
                styles.formBlock,
                isCompact ? styles.formBlockCompact : null,
              ]}
            >
              <TextField
                label="Search"
                value={query}
                onChangeText={setQuery}
                placeholder="e.g. Foo Fighters"
                autoCapitalize="none"
              />

              <TextField
                label="City override"
                value={city}
                onChangeText={setCity}
                placeholder={
                  detectedCity
                    ? `Leave blank to use ${detectedCity}`
                    : "e.g. Manchester"
                }
                autoCapitalize="words"
              />

              <View style={styles.locationMetaWrap}>
                {locationLoading ? (
                  <Text style={styles.locationMetaText}>
                    Detecting your location…
                  </Text>
                ) : activeCity ? (
                  <Text style={styles.locationMetaText}>
                    {isUsingManualCity
                      ? `Using city override: ${city.trim()}`
                      : `Using your location: ${detectedCity}`}
                  </Text>
                ) : locationError ? (
                  <Text style={styles.locationMetaText}>
                    {locationError}. Add a city to browse gigs.
                  </Text>
                ) : (
                  <Text style={styles.locationMetaText}>
                    Add a city to browse gigs near you.
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.searchRow,
                  isCompact ? styles.searchRowCompact : null,
                ]}
              >
                <PrimaryButton title="Search Ticketmaster" onPress={search} />

                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator />
                    <Text style={styles.loadingText}>Searching…</Text>
                  </View>
                ) : null}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {!loading && !error && !hasResults && !isCompact ? (
                <Text style={styles.emptyHint}>
                  Try searching an artist or band name.
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {showingSearchResults ? (
          <FlatList
            style={styles.list}
            data={events}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <EventCard
                item={item}
                cityFallback={activeCity}
                onAddToGigs={props.onAddToGigs}
              />
            )}
            ListEmptyComponent={
              !loading ? (
                <Text style={styles.emptyResultsText}>
                  No results yet. Try another artist or city.
                </Text>
              ) : null
            }
          />
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.discoverContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sectionBlock}>
              <SectionTitle
                title={
                  activeCity
                    ? isUsingManualCity
                      ? `Gigs in ${city.trim()}`
                      : `Near you · ${detectedCity}`
                    : "Near you"
                }
              />

              {nearYouLoading ? (
                <View style={styles.inlineInfoRow}>
                  <ActivityIndicator />
                  <Text style={styles.loadingText}>Loading nearby gigs…</Text>
                </View>
              ) : nearYouEvents.length > 0 ? (
                <View style={styles.nearYouList}>
                  {nearYouEvents.map((item) => (
                    <View key={item.id} style={styles.nearYouCardWrap}>
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
                    ? `No gigs found for ${activeCity} yet. Try searching for an artist.`
                    : "Enable location or add a city above to see nearby events."}
                </Text>
              )}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  keyboardWrap: {
    flex: 1,
  },

  heroWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },

  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.faint,
  },

  heroCardCompact: {
    padding: 10,
  },

  screenTitle: {
    color: COLORS.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },

  screenSubtitle: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  formBlock: {
    marginTop: 10,
    gap: 10,
  },

  formBlockCompact: {
    marginTop: 8,
    gap: 8,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  searchRowCompact: {
    gap: 10,
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
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },

  emptyHint: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  emptyResultsText: {
    paddingTop: 12,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  list: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  discoverContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 18,
  },

  sectionBlock: {
    marginTop: 4,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 10,
  },

  locationMetaWrap: {
    paddingHorizontal: 2,
  },

  locationMetaText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  nearYouList: {
    gap: 10,
  },

  nearYouCardWrap: {
    width: "100%",
  },

  separator: {
    height: 10,
  },

  resultCard: {
    backgroundColor: COLORS.card2,
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.faint,
  },

  resultTitle: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "700",
  },

  resultMeta: {
    color: COLORS.muted,
    marginTop: 5,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },

  resultDate: {
    color: COLORS.muted,
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
    borderColor: "#10101A",
    backgroundColor: "#10101A",
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