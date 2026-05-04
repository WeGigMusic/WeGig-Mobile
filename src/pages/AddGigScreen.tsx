import React from "react";
import {
  SafeAreaView,
  Text,
  Alert,
  View,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

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
import { reverseGeocodeCity } from "../lib/mapbox";
import { addGigToCalendar } from "../lib/calendar";
import {
  searchArtistSetlists,
  setlistDateToYmd,
  type SetlistItem,
} from "../lib/setlist";
import {
  createSessionToken,
  getPlaceDetails,
  searchVenues,
  type PlaceDetails,
  type PlaceSuggestion,
} from "./googlePlaces";
import { TicketScanScreen } from "./TicketScanScreen";

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
  artistLoading: "Looking up artists…",
  venueLoading: "Finding the venue…",
  prefilled: "Filled from Discover ✓",
  scanned: "Filled from ticket scan ✓",
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
  const d = norm(payload?.date);
  const placeId = norm(payload?.venuePlaceId);

  if (a && d && placeId) {
    const dup = existing.find((g: any) => {
      return (
        norm(g?.artist) === a &&
        norm(g?.date) === d &&
        norm(g?.venuePlaceId) === placeId
      );
    });

    if (dup) return dup;
  }

  const v = norm(payload?.venue);
  const c = norm(payload?.city);

  if (!a || !v || !c || !d) return null;

  const dup = existing.find((g: any) => {
    return (
      norm(g?.artist) === a &&
      norm(g?.venue) === v &&
      norm(g?.city) === c &&
      norm(g?.date) === d
    );
  });

  return dup ?? null;
}

export function AddGigScreen(props: {
  onCreated?: (gig: Gig) => void;
  prefill?: Partial<CreateGigInput> | null;
  autoCreate?: boolean;
  onPrefillUsed?: () => void;
  onPressLogo?: () => void;
  onBack?: () => void;
}) {
  
const { showToast } = useToast();
const scrollRef = React.useRef<any>(null);
const suppressNextArtistSearchRef = React.useRef(false);

  const [artist, setArtist] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [city, setCity] = React.useState("");
  const [date, setDate] = React.useState("");
  const [rating, setRating] = React.useState<number | undefined>(undefined);

  const [artistMbid, setArtistMbid] = React.useState<string | undefined>();
  const [mbLoading, setMbLoading] = React.useState(false);
  const [mbResults, setMbResults] = React.useState<MbArtist[]>([]);
  const [mbError, setMbError] = React.useState("");
  const [mbOpen, setMbOpen] = React.useState(false);

  const [venueLoading, setVenueLoading] = React.useState(false);
  const [venueError, setVenueError] = React.useState("");
  const [venueOpen, setVenueOpen] = React.useState(false);
  const [venueResults, setVenueResults] = React.useState<PlaceSuggestion[]>([]);
  const [venueSessionToken, setVenueSessionToken] = React.useState(
    createSessionToken(),
  );
  const [locationBias, setLocationBias] = React.useState<
    | {
        latitude: number;
        longitude: number;
      }
    | undefined
  >();

  const [selectedVenueLat, setSelectedVenueLat] = React.useState<
    number | undefined
  >();
  const [selectedVenueLng, setSelectedVenueLng] = React.useState<
    number | undefined
  >();
  const [selectedVenuePlaceName, setSelectedVenuePlaceName] = React.useState<
    string | undefined
  >();
  const [selectedVenuePlaceId, setSelectedVenuePlaceId] = React.useState<
    string | undefined
  >();

  const [notes, setNotes] = React.useState("");
  const [externalSource, setExternalSource] = React.useState<
    string | undefined
  >();
  const [externalId, setExternalId] = React.useState<string | undefined>();
  const [ticketUrl, setTicketUrl] = React.useState<string | undefined>();

  const [gigSearchLoading, setGigSearchLoading] = React.useState(false);
  const [gigSearchError, setGigSearchError] = React.useState("");
  const [gigSearchOpen, setGigSearchOpen] = React.useState(false);
  const [gigSearchResults, setGigSearchResults] = React.useState<SetlistItem[]>(
    [],
  );

  const [loading, setLoading] = React.useState(false);
  const [justPrefilled, setJustPrefilled] = React.useState(false);
  const [justScanned, setJustScanned] = React.useState(false);
  const [justAutoCity, setJustAutoCity] = React.useState(false);
  const [scanningTicket, setScanningTicket] = React.useState(false);
  const [autoCreateAttempted, setAutoCreateAttempted] = React.useState(false);
  const [addToCalendar, setAddToCalendar] = React.useState(false);

  const isFutureGig = React.useMemo(() => {
    const d = parseYmdToUtcDate(date);
    if (!d) return false;

    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    return d.getTime() > todayUtc.getTime();
  }, [date]);

  const canAddToCalendar = isFutureGig;

  React.useEffect(() => {
    if (isFutureGig && rating != null) setRating(undefined);
  }, [isFutureGig, rating]);

  React.useEffect(() => {
    if (!props.prefill) return;

    if (props.prefill.artist != null) setArtist(String(props.prefill.artist));
    if (props.prefill.venue != null) setVenue(String(props.prefill.venue));
    if (props.prefill.city != null) setCity(String(props.prefill.city));
    if (props.prefill.date != null) setDate(String(props.prefill.date));

    if (typeof props.prefill.rating === "number") {
      setRating(props.prefill.rating);
    }

    if ((props.prefill as any).artistMbid != null) {
      setArtistMbid(String((props.prefill as any).artistMbid));
    }

    if ((props.prefill as any).notes != null) {
      setNotes(String((props.prefill as any).notes));
    }

    if ((props.prefill as any).externalSource != null) {
      setExternalSource(String((props.prefill as any).externalSource));
    }

    if ((props.prefill as any).externalId != null) {
      setExternalId(String((props.prefill as any).externalId));
    }

    if ((props.prefill as any).ticketUrl != null) {
      setTicketUrl(String((props.prefill as any).ticketUrl));
    }

    setAutoCreateAttempted(false);
    setJustPrefilled(true);

    const t = setTimeout(() => setJustPrefilled(false), 2500);

    props.onPrefillUsed?.();

    return () => clearTimeout(t);
  }, [props.prefill, props.onPrefillUsed]);

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
  if (suppressNextArtistSearchRef.current) {
    suppressNextArtistSearchRef.current = false;
    return;
  }

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

  React.useEffect(() => {
    if (!props.autoCreate) return;
    if (!props.prefill) return;
    if (autoCreateAttempted) return;
    if (loading) return;

    const hasRequired =
      artist.trim() && venue.trim() && city.trim() && date.trim();

    if (!hasRequired) return;

    setAutoCreateAttempted(true);

    const t = setTimeout(() => {
      void submit();
    }, 250);

    return () => clearTimeout(t);
  }, [
    props.autoCreate,
    props.prefill,
    autoCreateAttempted,
    loading,
    artist,
    venue,
    city,
    date,
  ]);

const chooseArtist = (a: MbArtist) => {
  suppressNextArtistSearchRef.current = true;
  setArtist(a.name);
  setArtistMbid(a.id);
  setMbOpen(false);
  setMbResults([]);
  setMbError("");
};

  const runVenueSearch = React.useCallback(
    async (q: string) => {
      const query = q.trim();

      if (query.length < 2) {
        setVenueResults([]);
        setVenueError("");
        setVenueLoading(false);
        return;
      }

      setVenueLoading(true);
      setVenueError("");

      try {
        const results = await searchVenues(query, venueSessionToken, {
          cityHint: city.trim() || undefined,
          locationBias: locationBias
            ? {
                latitude: locationBias.latitude,
                longitude: locationBias.longitude,
                radiusMeters: 50000,
              }
            : undefined,
        });

        setVenueResults(results.slice(0, 8));
        setVenueOpen(true);
      } catch (e: any) {
        setVenueError(e?.message ?? "Venue search failed");
        setVenueResults([]);
        setVenueOpen(false);
      } finally {
        setVenueLoading(false);
      }
    },
    [venueSessionToken, city, locationBias],
  );

  React.useEffect(() => {
    const q = venue.trim();

    if (selectedVenuePlaceId) {
      setVenueResults([]);
      setVenueOpen(false);
      setVenueLoading(false);
      return;
    }

    if (q.length < 2) {
      setVenueResults([]);
      setVenueOpen(false);
      setVenueError("");
      setVenueLoading(false);
      return;
    }

    const t = setTimeout(() => {
      void runVenueSearch(q);
    }, 320);

    return () => clearTimeout(t);
  }, [venue, runVenueSearch, selectedVenuePlaceId]);

  const chooseGoogleVenue = async (suggestion: PlaceSuggestion) => {
    try {
      setVenueLoading(true);
      setVenueError("");

      const details: PlaceDetails = await getPlaceDetails(
        suggestion.placeId,
        venueSessionToken,
      );

      setSelectedVenuePlaceId(details.placeId);
      setSelectedVenueLat(details.latitude);
      setSelectedVenueLng(details.longitude);
      setSelectedVenuePlaceName(details.formattedAddress);

      setVenue(details.venueName);

      const placeCity = details.city.trim();

      if (placeCity) {
        setCity(placeCity);
        setJustAutoCity(true);
        setTimeout(() => setJustAutoCity(false), 2200);
      }

      setVenueResults([]);
      setVenueOpen(false);
      setVenueError("");
      setVenueLoading(false);
      setVenueSessionToken(createSessionToken());
    } catch (e: any) {
      setVenueError(e?.message ?? "Failed to load venue details");
      setVenueLoading(false);
    }
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

      setLocationBias(coords);

      try {
        const resolvedCity = await reverseGeocodeCity(coords);

        if (resolvedCity.trim()) {
          setCity(resolvedCity.trim());
          setJustAutoCity(true);
          setTimeout(() => setJustAutoCity(false), 2200);
          return;
        }
      } catch {}

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

  const runGigSearch = async () => {
    const q = artist.trim();

    if (!q) {
      Alert.alert("Artist needed", "Add an artist first, then search for a gig.");
      return;
    }

    setGigSearchLoading(true);
    setGigSearchError("");
    setGigSearchOpen(false);

    try {
      const results = await searchArtistSetlists({
  artist: q,
  artistMbid,
  city,
  venue,
});

      const venueQuery = venue.trim().toLowerCase();
      const cityQuery = city.trim().toLowerCase();
      const dateQuery = date.trim();

      const filtered = results.filter((item) => {
        const itemVenue = item.venueName.toLowerCase();
        const itemCity = item.cityName.toLowerCase();
        const itemDate = setlistDateToYmd(item.eventDate);

        const venueOk = !venueQuery || itemVenue.includes(venueQuery);
        const cityOk = !cityQuery || itemCity.includes(cityQuery);
        const dateOk = !dateQuery || itemDate === dateQuery;

        return venueOk && cityOk && dateOk;
      });

      const nextResults = filtered.length > 0 ? filtered : results;

      setGigSearchResults(nextResults);
      setGigSearchOpen(true);

      if (nextResults.length === 0) {
        setGigSearchError("No matching gigs found.");
      }
    } catch (e: any) {
      setGigSearchResults([]);
      setGigSearchError(e?.message ?? "Gig search failed");
    } finally {
      setGigSearchLoading(false);
    }
  };

  const chooseSetlistGig = (gig: SetlistItem) => {
    const ymdDate = setlistDateToYmd(gig.eventDate);

    setVenue(gig.venueName);
    setCity(gig.cityName);
    if (ymdDate) setDate(ymdDate);

    setExternalSource("setlist.fm");
    setExternalId(gig.id);
    setTicketUrl(gig.url ?? undefined);

    setGigSearchOpen(false);
    setGigSearchResults([]);
    setGigSearchError("");

    setJustPrefilled(true);
    setTimeout(() => setJustPrefilled(false), 2500);
  };

  const handleTicketScanned = (scanPrefill: Partial<CreateGigInput>) => {
    if (scanPrefill.artist != null) setArtist(String(scanPrefill.artist));
    if (scanPrefill.venue != null) setVenue(String(scanPrefill.venue));
    if (scanPrefill.city != null) setCity(String(scanPrefill.city));
    if (scanPrefill.date != null) setDate(String(scanPrefill.date));

    if (typeof scanPrefill.rating === "number") {
      setRating(scanPrefill.rating);
    }

    if ((scanPrefill as any).artistMbid != null) {
      setArtistMbid(String((scanPrefill as any).artistMbid));
    }

    if ((scanPrefill as any).notes != null) {
      setNotes(String((scanPrefill as any).notes));
    }

    if ((scanPrefill as any).externalSource != null) {
      setExternalSource(String((scanPrefill as any).externalSource));
    }

    if ((scanPrefill as any).externalId != null) {
      setExternalId(String((scanPrefill as any).externalId));
    }

    if ((scanPrefill as any).ticketUrl != null) {
      setTicketUrl(String((scanPrefill as any).ticketUrl));
    }

    setScanningTicket(false);
    setJustScanned(true);
    setTimeout(() => setJustScanned(false), 2500);
  };

  const resetForm = () => {
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
    setSelectedVenuePlaceId(undefined);
    setLocationBias(undefined);

    setMbResults([]);
    setMbOpen(false);
    setMbError("");

    setVenueResults([]);
    setVenueOpen(false);
    setVenueError("");
    setVenueLoading(false);
    setVenueSessionToken(createSessionToken());

    setGigSearchResults([]);
    setGigSearchOpen(false);
    setGigSearchError("");
    setGigSearchLoading(false);

    setJustAutoCity(false);
    setAutoCreateAttempted(false);
    setAddToCalendar(false);
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
    payload.venuePlaceId = selectedVenuePlaceId;

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

      if (addToCalendar && canAddToCalendar) {
        try {
          await addGigToCalendar({
            title: `${payload.artist} @ ${payload.venue}`,
            location: `${payload.venue}, ${payload.city}`,
            date: payload.date,
          });
        } catch (e: any) {
          Alert.alert("Calendar", e?.message ?? "Couldn’t add to calendar");
        }
      }

      props.onCreated?.(created);
      resetForm();
    } catch (e: any) {
      if (isOfflineError(e)) {
        try {
          const existing = await getCachedGigs();
          const dup = findDuplicate(existing, payload);

          if (dup) {
            Alert.alert(
              "Already logged",
              "This gig already exists from your last sync.",
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
          resetForm();
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

  if (scanningTicket) {
    return (
      <TicketScanScreen
        onPressLogo={props.onPressLogo}
        onBack={() => setScanningTicket(false)}
        onScanned={handleTicketScanned}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={20}
      >
        <AppHeader
          onPressLogo={props.onPressLogo}
          onPressBack={props.onBack}
          backLabel="Gigs"
        />

        <KeyboardAwareScrollView
          ref={scrollRef}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          enableOnAndroid
          enableAutomaticScroll={false}
          extraScrollHeight={0}
        >
          <View style={styles.hero}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Log a gig</Text>

              <Pressable
                onPress={() => setScanningTicket(true)}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.scanHeaderBtn,
                  pressed ? styles.pressedSmall : null,
                ]}
              >
                <Ionicons
                  name="scan-outline"
                  size={20}
                  color={Colours.text.primary}
                />
              </Pressable>
            </View>

            {justPrefilled ? (
              <Text style={styles.ok}>{UI_COPY.prefilled}</Text>
            ) : null}

            {justScanned ? (
              <Text style={styles.ok}>{UI_COPY.scanned}</Text>
            ) : null}
          </View>

          <View style={styles.form}>
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
                        pressed ? styles.rowPressed : null,
                      ]}
                    >
                      <View style={styles.flex}>
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
                setVenueError("");
                setSelectedVenueLat(undefined);
                setSelectedVenueLng(undefined);
                setSelectedVenuePlaceName(undefined);
                setSelectedVenuePlaceId(undefined);
              }}
              placeholder="Start typing a venue..."
              autoCapitalize="words"
            />

            {venueLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator />
                <Text style={styles.muted}>{UI_COPY.venueLoading}</Text>
              </View>
            ) : null}

            {venueError ? (
              <Text style={styles.errorText}>{venueError}</Text>
            ) : null}

            {venueOpen && !venueLoading && venueResults.length > 0 ? (
              <View style={styles.suggestCard}>
                {venueResults.map((place) => (
                  <Pressable
                    key={place.placeId}
                    onPress={() => void chooseGoogleVenue(place)}
                    style={({ pressed }) => [
                      styles.suggestRow,
                      pressed ? styles.rowPressed : null,
                    ]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.suggestTitle}>{place.title}</Text>
                      {place.subtitle ? (
                        <Text style={styles.suggestMeta}>
                          {place.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <TextField label="City" value={city} onChangeText={setCity} />

            {justAutoCity ? (
              <Text style={styles.muted}>{UI_COPY.autoCity}</Text>
            ) : null}

            <Pressable
              onPress={handleUseMyLocation}
              style={({ pressed }) => [
                styles.locationBtn,
                pressed ? styles.rowPressed : null,
              ]}
            >
              <Ionicons
                name="location-outline"
                size={16}
                color={Colours.text.primary}
              />
              <Text style={styles.locationBtnText}>Use my location</Text>
            </Pressable>

            <DateField
              label="Date"
              value={date}
              onChange={setDate}
              placeholder="Select date"
            />

            <Pressable
              onPress={runGigSearch}
              disabled={gigSearchLoading}
              style={({ pressed }) => [
                styles.locationBtn,
                pressed ? styles.rowPressed : null,
                gigSearchLoading ? styles.saveBtnDisabled : null,
              ]}
            >
              <Ionicons
                name="search-outline"
                size={16}
                color={Colours.text.primary}
              />
              <Text style={styles.locationBtnText}>
                {gigSearchLoading ? "Searching…" : "Search for gig"}
              </Text>
            </Pressable>

            {gigSearchError ? (
              <Text style={styles.errorText}>{gigSearchError}</Text>
            ) : null}

            {gigSearchOpen && gigSearchResults.length > 0 ? (
              <View style={styles.suggestCard}>
                {gigSearchResults.map((gig) => (
                  <Pressable
                    key={gig.id}
                    onPress={() => chooseSetlistGig(gig)}
                    style={({ pressed }) => [
                      styles.suggestRow,
                      pressed ? styles.rowPressed : null,
                    ]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.suggestTitle}>
                        {gig.eventDate} · {gig.venueName}
                      </Text>
                      <Text style={styles.suggestMeta}>
                        {[gig.cityName, gig.countryCode, `${gig.songCount} songs`]
                          .filter(Boolean)
                          .join(" • ")}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

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

            {canAddToCalendar ? (
              <View style={styles.highlightSection}>
                <Text style={styles.sectionTitle}>Calendar</Text>

                <Pressable
                  onPress={() => setAddToCalendar((v) => !v)}
                  style={({ pressed }) => [
                    styles.highlightRow,
                    addToCalendar ? styles.highlightActiveBlue : null,
                    pressed ? styles.highlightPressed : null,
                  ]}
                >
                  <View style={styles.highlightLeft}>
                    <View
                      style={[
                        styles.highlightIconWrap,
                        addToCalendar ? styles.highlightIconBlue : null,
                      ]}
                    >
                      <Ionicons
                        name={addToCalendar ? "checkmark" : "calendar-outline"}
                        size={16}
                        color={addToCalendar ? "#7EB6FF" : Colours.text.muted}
                      />
                    </View>

                    <View style={styles.flex}>
                      <Text style={styles.highlightTitle}>
                        {addToCalendar ? "Calendar ready" : "Add to calendar"}
                      </Text>
                      <Text style={styles.highlightText}>
                        Create an event after saving.
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            ) : null}

            <TextField
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Who you went with, favourite moment…"
              autoCapitalize="sentences"
              multiline
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
              onFocus={() => {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd?.({ animated: true });
                }, 180);
              }}
              style={{ minHeight: 100 }}
            />

            <Pressable
              onPress={submit}
              disabled={loading}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.saveActionBtn,
                loading ? styles.saveBtnDisabled : null,
                pressed && !loading ? styles.saveBtnPressed : null,
              ]}
            >
              <Text style={styles.saveBtnText}>
                {loading ? "Saving…" : "Save"}
              </Text>
            </Pressable>

            {loading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator />
                <Text style={styles.muted}>{UI_COPY.saving}</Text>
              </View>
            ) : null}
          </View>
        </KeyboardAwareScrollView>
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

  body: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 180,
  },

  hero: {
    marginBottom: 22,
  },

  form: {
    gap: 16,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  title: {
    color: Colours.text.primary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  ok: {
    marginTop: 10,
    color: "#2EE59D",
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 18,
  },

  label: {
    color: Colours.text.secondary,
    fontWeight: "600",
    fontSize: 13,
    letterSpacing: 0.1,
  },

  muted: {
    color: Colours.text.muted,
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 18,
  },

  errorText: {
    color: Colours.text.danger,
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 17,
  },

  inlineRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 2,
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

  scanHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(47,140,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  pressedSmall: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },

  rowPressed: {
    opacity: 0.9,
  },

  locationBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  locationBtnText: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 14,
  },

  ratingBlock: {
    gap: 8,
  },

  highlightSection: {
    marginTop: 2,
  },

  sectionTitle: {
    color: Colours.text.muted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },

  highlightRow: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  highlightPressed: {
    opacity: 0.9,
  },

  highlightActiveBlue: {
    backgroundColor: "rgba(126,182,255,0.08)",
    borderColor: "rgba(126,182,255,0.3)",
  },

  highlightLeft: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },

  highlightIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  highlightIconBlue: {
    backgroundColor: "rgba(126,182,255,0.12)",
    borderColor: "rgba(126,182,255,0.22)",
  },

  highlightTitle: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 14,
  },

  highlightText: {
    color: Colours.text.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },

  actionBtn: {
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  saveActionBtn: {
    backgroundColor: "#2F8CFF",
  },

  saveBtnDisabled: {
    opacity: 0.65,
  },

  saveBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});