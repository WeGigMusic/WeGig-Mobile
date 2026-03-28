import React from "react";
import {
  SafeAreaView,
  Text,
  Alert,
  ScrollView,
  View,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import * as Location from "expo-location";

import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { StarRating } from "../components/StarRating";
import { AppHeader } from "../components/AppHeader";
import { DateField } from "../components/DateField";
import { useToast } from "../components/ToastProvider";
import { apiPost, apiGet } from "../lib/api";
import { Colours } from "../theme/colours";
import type { CreateGigInput, Gig, GigsResponse } from "../shared/types/Gig";

import { getCachedGigs, setCachedGigs } from "../lib/gigsCache";
import { enqueueGig, isOfflineError } from "../lib/offlineQueue";
import { parseYmdToUtcDate } from "../lib/date";
import { reverseGeocodeCity, searchPlaces } from "../lib/mapbox";

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

type TmVenue = {
  id: string;
  name: string;
  city?: string | null;
  countryCode?: string | null;
};

type TmVenueSearchResponse =
  | {
      venues?: TmVenue[];
    }
  | any;

type MapboxPlace = {
  id: string;
  name: string;
  placeName: string;
  city?: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

const UI_COPY = {
  artistLoading: "Looking up artists…",
  venueLoading: "Finding the venue…",
  prefilled: "Filled from Discover ✓",
  autoCity: "City found ✓",
  saving: "Locking it in…",
};

function norm(s: any) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function findDuplicate(existing: Gig[], payload: any): Gig | null {
  const extSource = norm(payload?.externalSource);
  const extId = norm(payload?.externalId);

  if (extSource && extId) {
    const dup = existing.find(
      (g: any) =>
        norm(g?.externalSource) === extSource &&
        norm(g?.externalId) === extId,
    );
    return dup ?? null;
  }

  const a = norm(payload?.artist);
  const v = norm(payload?.venue);
  const c = norm(payload?.city);
  const d = norm(payload?.date);

  if (!a || !v || !c || !d) return null;

  const dup = existing.find((g) => {
    return (
      norm((g as any).artist) === a &&
      norm((g as any).venue) === v &&
      norm((g as any).city) === c &&
      norm((g as any).date) === d
    );
  });

  return dup ?? null;
}

export function AddGigScreen(props: {
  onCreated?: (gig: Gig) => void;
  prefill?: Partial<CreateGigInput> | null;
  onPrefillUsed?: () => void;
  onPressLogo?: () => void;
  onBack?: () => void;
}) {
  const { showToast } = useToast();

  const [artist, setArtist] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [city, setCity] = React.useState("");
  const [date, setDate] = React.useState("");
  const [rating, setRating] = React.useState<number | undefined>(undefined);

  const [artistMbid, setArtistMbid] = React.useState<string | undefined>(
    undefined,
  );
  const [mbLoading, setMbLoading] = React.useState(false);
  const [mbResults, setMbResults] = React.useState<MbArtist[]>([]);
  const [mbError, setMbError] = React.useState("");
  const [mbOpen, setMbOpen] = React.useState(false);

  const [venueLoading, setVenueLoading] = React.useState(false);
  const [venueError, setVenueError] = React.useState("");
  const [venueOpen, setVenueOpen] = React.useState(false);
  const [mapboxVenueResults, setMapboxVenueResults] = React.useState<
    MapboxPlace[]
  >([]);
  const [tmResults, setTmResults] = React.useState<TmVenue[]>([]);

  const [selectedVenueLat, setSelectedVenueLat] = React.useState<
    number | undefined
  >(undefined);
  const [selectedVenueLng, setSelectedVenueLng] = React.useState<
    number | undefined
  >(undefined);
  const [selectedVenuePlaceName, setSelectedVenuePlaceName] = React.useState<
    string | undefined
  >(undefined);
  const [selectedVenueMapboxId, setSelectedVenueMapboxId] = React.useState<
    string | undefined
  >(undefined);

  const [notes, setNotes] = React.useState("");
  const [externalSource, setExternalSource] = React.useState<
    string | undefined
  >(undefined);
  const [externalId, setExternalId] = React.useState<string | undefined>(
    undefined,
  );
  const [ticketUrl, setTicketUrl] = React.useState<string | undefined>(
    undefined,
  );

  const [loading, setLoading] = React.useState(false);
  const [justPrefilled, setJustPrefilled] = React.useState(false);
  const [justAutoCity, setJustAutoCity] = React.useState(false);

  const isFutureGig = React.useMemo(() => {
    const d = parseYmdToUtcDate(date);
    if (!d) return false;
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    return d.getTime() > todayUtc.getTime();
  }, [date]);

  React.useEffect(() => {
    if (isFutureGig && rating != null) setRating(undefined);
  }, [isFutureGig, rating]);

  React.useEffect(() => {
    if (!props.prefill) return;

    if (props.prefill.artist != null) setArtist(String(props.prefill.artist));
    if (props.prefill.venue != null) setVenue(String(props.prefill.venue));
    if (props.prefill.city != null) setCity(String(props.prefill.city));
    if (props.prefill.date != null) setDate(String(props.prefill.date));
    if (typeof props.prefill.rating === "number")
      setRating(props.prefill.rating);

    if ((props.prefill as any).artistMbid != null)
      setArtistMbid(String((props.prefill as any).artistMbid));
    if ((props.prefill as any).notes != null)
      setNotes(String((props.prefill as any).notes));
    if ((props.prefill as any).externalSource != null)
      setExternalSource(String((props.prefill as any).externalSource));
    if ((props.prefill as any).externalId != null)
      setExternalId(String((props.prefill as any).externalId));
    if ((props.prefill as any).ticketUrl != null)
      setTicketUrl(String((props.prefill as any).ticketUrl));

    setJustPrefilled(true);
    const t = setTimeout(() => setJustPrefilled(false), 2500);

    props.onPrefillUsed?.();
    return () => clearTimeout(t);
  }, [props.prefill]);

  const runMbSearch = React.useCallback(async (q: string) => {
    const query = q.trim();
    if (query.length < 2) {
      setMbResults([]);
      setMbError("");
      setMbLoading(false);
      return;
    }

    setMbLoading(true);
    setMbError("");
    try {
      const res = await apiGet<MbArtistSearchResponse>(
        `/mb/artists/search?q=${encodeURIComponent(query)}`,
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

  React.useEffect(() => {
    setArtistMbid(undefined);

    const q = artist.trim();
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
  }, [artist, runMbSearch]);

  const chooseArtist = (a: MbArtist) => {
    setArtist(a.name);
    setArtistMbid(a.id);
    setMbOpen(false);
    setMbResults([]);
    setMbError("");
  };

  const runVenueSearch = React.useCallback(
    async (q: string, cityHint: string) => {
      const query = q.trim();
      if (query.length < 2) {
        setMapboxVenueResults([]);
        setTmResults([]);
        setVenueError("");
        setVenueLoading(false);
        return;
      }

      setVenueLoading(true);
      setVenueError("");

      try {
        const mapboxPlaces = await searchPlaces({
          query,
          cityHint: cityHint.trim() || undefined,
          limit: 8,
        });

        setMapboxVenueResults(mapboxPlaces);
        setTmResults([]);
        setVenueOpen(true);
        return;
      } catch {
        // fall through to Ticketmaster fallback
      }

      try {
        const qs = new URLSearchParams();
        qs.set("q", query);
        if (cityHint.trim()) qs.set("city", cityHint.trim());
        qs.set("size", "8");

        const res = await apiGet<TmVenueSearchResponse>(
          `/tm/venues/search?${qs.toString()}`,
        );

        const venues: TmVenue[] = (res?.venues as TmVenue[]) ?? [];
        setTmResults(Array.isArray(venues) ? venues.slice(0, 8) : []);
        setMapboxVenueResults([]);
        setVenueOpen(true);
      } catch (e: any) {
        setVenueError(e?.message ?? "Venue search failed");
        setMapboxVenueResults([]);
        setTmResults([]);
        setVenueOpen(false);
      } finally {
        setVenueLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    const q = venue.trim();

    setSelectedVenueLat(undefined);
    setSelectedVenueLng(undefined);
    setSelectedVenuePlaceName(undefined);
    setSelectedVenueMapboxId(undefined);

    if (q.length < 2) {
      setMapboxVenueResults([]);
      setTmResults([]);
      setVenueOpen(false);
      setVenueError("");
      return;
    }

    const t = setTimeout(() => {
      void runVenueSearch(q, city);
    }, 320);

    return () => clearTimeout(t);
  }, [venue, city, runVenueSearch]);

  const chooseMapboxVenue = (place: MapboxPlace) => {
    setVenue(place.name);

    const placeCity = (place.city ?? "").trim();
    if (placeCity) {
      setCity(placeCity);
      setJustAutoCity(true);
      setTimeout(() => setJustAutoCity(false), 2200);
    }

    setSelectedVenueLat(place.latitude);
    setSelectedVenueLng(place.longitude);
    setSelectedVenuePlaceName(place.placeName);
    setSelectedVenueMapboxId(place.id);

    setVenueOpen(false);
    setMapboxVenueResults([]);
    setTmResults([]);
    setVenueError("");
  };

  const chooseTicketmasterVenue = (v: TmVenue) => {
    setVenue(v.name);

    const venueCity = (v.city ?? "").toString().trim();
    if (venueCity) {
      const current = city.trim().toLowerCase();
      const shouldOverwrite =
        !current || current === "unknown city" || current === "unknown";

      if (shouldOverwrite) {
        setCity(venueCity);
        setJustAutoCity(true);
        setTimeout(() => setJustAutoCity(false), 2200);
      }
    }

    setSelectedVenueLat(undefined);
    setSelectedVenueLng(undefined);
    setSelectedVenuePlaceName(undefined);
    setSelectedVenueMapboxId(undefined);

    setVenueOpen(false);
    setMapboxVenueResults([]);
    setTmResults([]);
    setVenueError("");
  };

  async function getExistingGigsBestEffort(): Promise<Gig[]> {
    try {
      const res = await apiGet<GigsResponse>("/gigs");
      const gigs = res?.gigs ?? [];
      await setCachedGigs(gigs);
      return gigs;
    } catch {
      return await getCachedGigs();
    }
  }

  const handleUseMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Location access is needed to auto-fill your city.",
        );
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
        const resolvedCity = await reverseGeocodeCity(coords);

        if (resolvedCity.trim()) {
          setCity(resolvedCity.trim());
          setJustAutoCity(true);
          setTimeout(() => setJustAutoCity(false), 2200);
          return;
        }
      } catch {
        // fallback below
      }

      const places = await Location.reverseGeocodeAsync(coords);
      const place = places?.[0];
      const inferredCity =
        place?.city || place?.subregion || place?.region || "";

      if (inferredCity) {
        setCity(inferredCity);
        setJustAutoCity(true);
        setTimeout(() => setJustAutoCity(false), 2200);
      } else {
        Alert.alert(
          "Location detected",
          "Could not determine city automatically.",
        );
      }
    } catch {
      Alert.alert("Location error", "Could not detect your current location.");
    }
  };

  const submit = async () => {
    const payload: CreateGigInput = {
      artist: artist.trim(),
      venue: venue.trim(),
      city: city.trim(),
      date: date.trim(),
      rating: isFutureGig ? undefined : rating,
    };

    payload.notes = notes.trim() || undefined;
    payload.artistMbid = artistMbid;
    payload.externalSource = externalSource;
    payload.externalId = externalId;
    payload.ticketUrl = ticketUrl;

    payload.venueLatitude = selectedVenueLat;
    payload.venueLongitude = selectedVenueLng;
    payload.venuePlaceName = selectedVenuePlaceName;
    payload.venueMapboxId = selectedVenueMapboxId;

    if (!payload.artist || !payload.venue || !payload.city || !payload.date) {
      Alert.alert(
        "Missing fields",
        "Artist, venue, city and date are required.",
      );
      return;
    }

    try {
      const existing = await getExistingGigsBestEffort();
      const dup = findDuplicate(existing, payload);
      if (dup) {
        Alert.alert(
          "Already logged",
          "You’ve already logged this gig.\n\nIf you want to change it, edit the existing entry in your gigs list.",
        );
        return;
      }
    } catch {}

    setLoading(true);
    try {
      const created = await apiPost<Gig>("/gigs", payload);

      try {
        const existing = await getCachedGigs();
        await setCachedGigs([created, ...existing]);
      } catch {}

      showToast({ message: "Saved" });
      props.onCreated?.(created);

      setArtist("");
      setVenue("");
      setCity("");
      setDate("");
      setRating(undefined);

      setNotes("");
      setArtistMbid(undefined);
      setExternalSource(undefined);
      setExternalId(undefined);
      setTicketUrl(undefined);

      setSelectedVenueLat(undefined);
      setSelectedVenueLng(undefined);
      setSelectedVenuePlaceName(undefined);
      setSelectedVenueMapboxId(undefined);

      setMbResults([]);
      setMbOpen(false);
      setMbError("");

      setMapboxVenueResults([]);
      setTmResults([]);
      setVenueOpen(false);
      setVenueError("");

      setJustAutoCity(false);
    } catch (e: any) {
      if (isOfflineError(e)) {
        try {
          const existing = await getCachedGigs();
          const dup = findDuplicate(existing, payload);
          if (dup) {
            Alert.alert(
              "Already logged",
              "This gig already exists (from your last sync).",
            );
            return;
          }
        } catch {}

        try {
          await enqueueGig(payload);
          Alert.alert(
            "Saved offline",
            "You’re offline. This gig was queued and will sync when you’re back online.",
          );
          props.onCreated?.({} as any);
          setArtist("");
          setVenue("");
          setCity("");
          setDate("");
          setRating(undefined);
          setNotes("");
          setArtistMbid(undefined);
          setExternalSource(undefined);
          setExternalId(undefined);
          setTicketUrl(undefined);
          setSelectedVenueLat(undefined);
          setSelectedVenueLng(undefined);
          setSelectedVenuePlaceName(undefined);
          setSelectedVenueMapboxId(undefined);
          setMbResults([]);
          setMbOpen(false);
          setMbError("");
          setMapboxVenueResults([]);
          setTmResults([]);
          setVenueOpen(false);
          setVenueError("");
          setJustAutoCity(false);
          return;
        } catch (qErr: any) {
          Alert.alert(
            "Offline save failed",
            qErr?.message ?? "Couldn’t queue gig.",
          );
          return;
        }
      }

      const msg = String(e?.message ?? "");
      if (msg.includes("409")) {
        Alert.alert("Already logged", "You’ve already logged this gig.");
        return;
      }

      Alert.alert("Error", e?.message ?? "Failed to add gig");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <AppHeader
          onPressLogo={props.onPressLogo}
          onPressBack={props.onBack}
          backLabel="Gigs"
        />

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>Log a gig</Text>
            <Text style={styles.subtitle}>
              Use <Text style={styles.bold}>Discover</Text> to prefill shows
              faster.
            </Text>

            {justPrefilled ? (
              <Text style={styles.ok}>{UI_COPY.prefilled}</Text>
            ) : null}
          </View>

          <View style={[styles.card, styles.formCard]}>
            <TextField
              label="Artist"
              value={artist}
              onChangeText={(t) => {
                setArtist(t);
                setMbOpen(true);
              }}
              placeholder="Start typing an artist..."
              autoCapitalize="words"
            />

            {mbLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator />
                <Text style={styles.muted}>{UI_COPY.artistLoading}</Text>
              </View>
            ) : null}

            {mbError ? <Text style={styles.errorText}>{mbError}</Text> : null}

            {mbOpen && !mbLoading && mbResults.length > 0 ? (
              <View style={styles.suggestCard}>
                {mbResults.map((a) => {
                  const meta = [a.country, a.disambiguation]
                    .filter(Boolean)
                    .join(" • ");
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => chooseArtist(a)}
                      style={({ pressed }) => [
                        styles.suggestRow,
                        pressed ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestTitle}>{a.name}</Text>
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
              <Text style={styles.muted}>Matched artist ✓</Text>
            ) : null}

            <TextField
              label="Venue"
              value={venue}
              onChangeText={(t) => {
                setVenue(t);
                setVenueOpen(true);
              }}
              placeholder="Start typing venue…"
              autoCapitalize="words"
            />

            {venueLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator />
                <Text style={styles.muted}>{UI_COPY.venueLoading}</Text>
              </View>
            ) : null}

            {venueError ? <Text style={styles.errorText}>{venueError}</Text> : null}

            {venueOpen &&
            !venueLoading &&
            (mapboxVenueResults.length > 0 || tmResults.length > 0) ? (
              <View style={styles.suggestCard}>
                {mapboxVenueResults.map((place) => {
                  const meta = [place.city, place.region, place.country]
                    .filter(Boolean)
                    .join(" • ");

                  return (
                    <Pressable
                      key={place.id}
                      onPress={() => chooseMapboxVenue(place)}
                      style={({ pressed }) => [
                        styles.suggestRow,
                        pressed ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestTitle}>{place.name}</Text>
                        {meta ? (
                          <Text style={styles.suggestMeta}>{meta}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.sourcePill}>Mapbox</Text>
                    </Pressable>
                  );
                })}

                {tmResults.map((v) => {
                  const meta = [v.city ?? "", v.countryCode ?? ""]
                    .map((x) => String(x).trim())
                    .filter(Boolean)
                    .join(" • ");

                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => chooseTicketmasterVenue(v)}
                      style={({ pressed }) => [
                        styles.suggestRow,
                        pressed ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestTitle}>{v.name}</Text>
                        {meta ? (
                          <Text style={styles.suggestMeta}>{meta}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.sourcePillMuted}>TM</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <TextField label="City" value={city} onChangeText={setCity} />

            <Pressable
              onPress={handleUseMyLocation}
              style={({ pressed }) => [
                styles.locationBtn,
                pressed ? { opacity: 0.9 } : null,
              ]}
            >
              <Text style={styles.locationBtnText}>Use my current location</Text>
            </Pressable>

            {justAutoCity ? (
              <Text style={styles.muted}>{UI_COPY.autoCity}</Text>
            ) : null}

            <DateField
              label="Date"
              value={date}
              onChange={setDate}
              placeholder="Select date"
            />

            {isFutureGig ? (
              <Text style={styles.muted}>
                Rating available after the gig date.
              </Text>
            ) : (
              <View style={styles.ratingBlock}>
                <Text style={styles.label}>Rating</Text>
                <StarRating value={rating} onChange={setRating} showLabel />
              </View>
            )}

            <PrimaryButton
              title={loading ? "Saving…" : "Save"}
              onPress={submit}
              disabled={loading}
            />

            {loading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator />
                <Text style={styles.muted}>{UI_COPY.saving}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    gap: 12,
    paddingBottom: 140,
  },

  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 13,
  },

  formCard: {
    gap: 12,
  },

  title: {
    color: Colours.text.primary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },

  subtitle: {
    color: Colours.text.muted,
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  bold: {
    color: Colours.text.primary,
    fontWeight: "700",
  },

  ok: {
    marginTop: 10,
    color: "#2EE59D",
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 18,
  },

  label: {
    color: Colours.text.secondary,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
  },

  muted: {
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 18,
  },

  errorText: {
    color: Colours.text.danger,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 17,
  },

  inlineRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },

  suggestCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    overflow: "hidden",
  },

  suggestRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colours.ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  suggestTitle: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
  },

  suggestMeta: {
    marginTop: 2,
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 16,
  },

  sourcePill: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 11,
    lineHeight: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(47,140,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(47,140,255,0.4)",
  },

  sourcePillMuted: {
    color: Colours.text.muted,
    fontWeight: "800",
    fontSize: 11,
    lineHeight: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },

  locationBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colours.background.card,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    alignItems: "center",
  },

  locationBtnText: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 17,
  },

  ratingBlock: {
    gap: 8,
  },
});