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
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { TextField } from "../components/TextField";
import { StarRating } from "../components/StarRating";
import { AppHeader } from "../components/AppHeader";
import { DateField } from "../components/DateField";
import { CitySearchInput } from "../components/CitySearchInput";
import { useToast } from "../components/ToastProvider";
import { apiPost, apiGet } from "../lib/api";
import {
  searchPastEvents,
  type AppEvent,
  getEventArtistName,
  getEventDate,
} from "../lib/events";
import { Colours } from "../theme/colours";
import type { CreateGigInput, Gig, GigsResponse } from "../shared/types/Gig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCachedGigs, setCachedGigs } from "../lib/gigsCache";
import { enqueueGig, isOfflineError } from "../lib/offlineQueue";
import { parseYmdToUtcDate } from "../lib/date";
import { addGigToCalendar } from "../lib/calendar";
import {
  createSessionToken,
  getPlaceDetails,
  searchVenues,
  type PlaceDetails,
  type PlaceSuggestion,
} from "./googlePlaces";

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

type PrefillSource = "discover" | null;

const UI_COPY = {
  artistLoading: "Looking up artists…",
  venueLoading: "Finding the venue…",
  prefilled: "Filled from Discover ✓",
  autoCity: "City found ✓",
  saving: "Locking it in…",
};

const INCLUDE_TRIBUTE_ACTS_KEY = "wegig.includeTributeActs";

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

function IconInput(props: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={[styles.iconInputWrap, props.multiline ? styles.notesWrap : null]}>
      <Ionicons
        name={props.icon}
        size={18}
        color={Colours.text.muted}
        style={props.multiline ? styles.notesIcon : undefined}
      />

      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="rgba(255,255,255,0.42)"
        autoCapitalize="words"
        autoCorrect={false}
        multiline={props.multiline}
        returnKeyType={props.multiline ? "done" : "next"}
        blurOnSubmit={props.multiline}
        onSubmitEditing={() => {
          if (props.multiline) Keyboard.dismiss();
        }}
        style={[styles.iconInput, props.multiline ? styles.notesInput : null]}
      />
    </View>
  );
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
  const suppressNextVenueSearchRef = React.useRef(false);

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
  const [gigSearchResults, setGigSearchResults] = React.useState<AppEvent[]>(
    [],
  );

  const [loading, setLoading] = React.useState(false);
  const [justPrefilled, setJustPrefilled] = React.useState(false);
  const [justAutoCity, setJustAutoCity] = React.useState(false);
  const [autoCreateAttempted, setAutoCreateAttempted] = React.useState(false);
  const [addToCalendar, setAddToCalendar] = React.useState(false);
  const [prefillSource, setPrefillSource] =
    React.useState<PrefillSource>(null);

  const isDiscoverPrefill = prefillSource === "discover";

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

    const nextIsDiscoverPrefill = Boolean(
      props.prefill.externalSource ||
        props.prefill.externalId ||
        props.prefill.ticketUrl,
    );

    setPrefillSource(nextIsDiscoverPrefill ? "discover" : null);

    suppressNextArtistSearchRef.current = true;
    suppressNextVenueSearchRef.current = true;

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

    setMbOpen(false);
    setMbResults([]);
    setMbError("");
    setMbLoading(false);

    setVenueOpen(false);
    setVenueResults([]);
    setVenueError("");
    setVenueLoading(false);

    setGigSearchOpen(false);
    setGigSearchResults([]);
    setGigSearchError("");
    setGigSearchLoading(false);

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
    if (isDiscoverPrefill) {
      setMbOpen(false);
      setMbResults([]);
      setMbLoading(false);
      setMbError("");
      return;
    }

    if (suppressNextArtistSearchRef.current) {
      suppressNextArtistSearchRef.current = false;
      setMbOpen(false);
      setMbResults([]);
      setMbLoading(false);
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
  }, [artist, runMbSearch, isDiscoverPrefill]);

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
    [venueSessionToken, city],
  );
  
    React.useEffect(() => {
    if (isDiscoverPrefill) {
      setVenueResults([]);
      setVenueOpen(false);
      setVenueLoading(false);
      setVenueError("");
      return;
    }

    if (suppressNextVenueSearchRef.current) {
      suppressNextVenueSearchRef.current = false;
      setVenueResults([]);
      setVenueOpen(false);
      setVenueLoading(false);
      return;
    }

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
  }, [venue, runVenueSearch, selectedVenuePlaceId, isDiscoverPrefill]);

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

      suppressNextVenueSearchRef.current = true;
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
      const includeTributeActs =
        (await AsyncStorage.getItem(INCLUDE_TRIBUTE_ACTS_KEY)) === "1";

      const rawResults = await searchPastEvents({
        artist: q,
        artistMbid: includeTributeActs ? undefined : artistMbid,
        city: city.trim() || undefined,
        venue: venue.trim() || undefined,
      });

      const venueQuery = venue.trim().toLowerCase();
      const cityQuery = city.trim().toLowerCase();
      const dateQuery = date.trim();

      const safeResults = Array.isArray(rawResults) ? rawResults : [];

      const filtered = safeResults.filter((item: AppEvent) => {
        const itemVenue = String(item.venueName ?? "").toLowerCase();
        const itemCity = String(item.city ?? "").toLowerCase();
        const itemDate = getEventDate(item);

        const venueOk = !venueQuery || itemVenue.includes(venueQuery);
        const cityOk = !cityQuery || itemCity.includes(cityQuery);
        const dateOk = !dateQuery || itemDate === dateQuery;

        return venueOk && cityOk && dateOk;
      });

      const nextResults = filtered.length > 0 ? filtered : safeResults;

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

  const chooseSearchedGig = (gig: AppEvent) => {
    const eventDate = getEventDate(gig);
    const artistName = getEventArtistName(gig) || artist.trim() || gig.title;

    suppressNextArtistSearchRef.current = true;
    suppressNextVenueSearchRef.current = true;

    if (artistName) setArtist(artistName);
    if (gig.venueName) setVenue(gig.venueName);
    if (gig.city) setCity(gig.city);
    if (eventDate) setDate(eventDate);

    setExternalSource(gig.source);
    setExternalId(gig.sourceEventId);
    setTicketUrl(gig.ticketUrl ?? undefined);

    setGigSearchOpen(false);
    setGigSearchResults([]);
    setGigSearchError("");

    setJustPrefilled(true);
    setTimeout(() => setJustPrefilled(false), 2500);
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
    setPrefillSource(null);

    setSelectedVenueLat(undefined);
    setSelectedVenueLng(undefined);
    setSelectedVenuePlaceName(undefined);
    setSelectedVenuePlaceId(undefined);

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
            </View>

            {justPrefilled ? (
              <Text style={styles.ok}>{UI_COPY.prefilled}</Text>
            ) : null}
          </View>

          <View style={styles.form}>
            <IconInput
  icon="person-outline"
  value={artist}
  onChangeText={(t) => {
    setArtist(t);
    setArtistMbid(undefined);
    setMbOpen(true);
  }}
  placeholder="Start typing an artist..."
/>

            {mbLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator />
                <Text style={styles.muted}>{UI_COPY.artistLoading}</Text>
              </View>
            ) : null}

            {mbError ? <Text style={styles.errorText}>{mbError}</Text> : null}

            {!isDiscoverPrefill && mbOpen && !mbLoading && mbResults.length > 0 ? (
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

            <CitySearchInput
  value={city}
  onChangeText={setCity}
  placeholder="Start typing a city…"
/>

            {justAutoCity ? (
              <Text style={styles.muted}>{UI_COPY.autoCity}</Text>
            ) : null}

            <IconInput
  icon="business-outline"
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

            {!isDiscoverPrefill &&
            venueOpen &&
            !venueLoading &&
            venueResults.length > 0 ? (
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

           <DateField
  label=""
  value={date}
  onChange={setDate}
  placeholder="Select date"
/>

            {!isDiscoverPrefill ? (
              <>
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
                    {gigSearchLoading ? "Searching…" : "Search for past gig"}
                  </Text>
                </Pressable>

                {gigSearchError ? (
                  <Text style={styles.errorText}>{gigSearchError}</Text>
                ) : null}

                {gigSearchOpen && gigSearchResults.length > 0 ? (
                  <View style={styles.suggestCard}>
                    {gigSearchResults.map((gig, index) => {
                      const gigDate = getEventDate(gig);
                      const gigVenue = gig.venueName ?? "Unknown venue";
                      const gigCity = gig.city ?? "Unknown city";

                      return (
                        <Pressable
                          key={`${gig.source}-${gig.sourceEventId}-${index}`}
                          onPress={() => chooseSearchedGig(gig)}
                          style={({ pressed }) => [
                            styles.suggestRow,
                            pressed ? styles.rowPressed : null,
                          ]}
                        >
                          <View style={styles.flex}>
                            <Text style={styles.suggestTitle}>
                              {gigDate || "Date unknown"} · {gigVenue}
                            </Text>
                            <Text style={styles.suggestMeta}>
  {[gigCity, gig.countryCode].filter(Boolean).join(" • ")}
</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </>
            ) : null}

            {isFutureGig ? (
  <Text style={styles.muted}>
    Rating available after the gig date.
  </Text>
) : (
  <View style={styles.ratingPill}>
  <StarRating value={rating} onChange={setRating} />
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

            <IconInput
  icon="create-outline"
  value={notes}
  onChangeText={setNotes}
  placeholder="Who you went with, favourite moment..."
  multiline
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
    marginBottom: 18,
  },

  form: {
    gap: 14,
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

  rowPressed: {
    opacity: 0.9,
  },

  cityLikeField: {
  minHeight: 48,
  borderRadius: 17,
  backgroundColor: "rgba(255,255,255,0.065)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.09)",
  paddingHorizontal: 14,
  color: Colours.text.primary,
  fontSize: 14,
  lineHeight: 18,
  fontWeight: "700",
  paddingVertical: Platform.OS === "ios" ? 13 : 9,
},

notesLikeField: {
  minHeight: 120,
  borderRadius: 17,
  backgroundColor: "rgba(255,255,255,0.065)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.09)",
  paddingHorizontal: 14,
  paddingTop: 14,
  color: Colours.text.primary,
  fontSize: 14,
  lineHeight: 18,
  fontWeight: "700",
  textAlignVertical: "top",
},

ratingLikeField: {
  minHeight: 48,
  borderRadius: 17,
  backgroundColor: "rgba(255,255,255,0.065)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.09)",
  paddingHorizontal: 14,
  justifyContent: "center",
},

  locationBtn: {
    height: 48,
    borderRadius: 17,
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

  iconInputWrap: {
  minHeight: 48,
  borderRadius: 17,
  backgroundColor: "rgba(255,255,255,0.065)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.09)",
  paddingHorizontal: 14,
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
},

iconInput: {
  flex: 1,
  color: Colours.text.primary,
  fontSize: 14,
  lineHeight: 18,
  fontWeight: "700",
  paddingVertical: Platform.OS === "ios" ? 13 : 9,
},

notesWrap: {
  minHeight: 110,
  alignItems: "flex-start",
  paddingTop: 14,
},

notesIcon: {
  marginTop: 2,
},

notesInput: {
  minHeight: 82,
  textAlignVertical: "top",
  paddingTop: 0,
},

ratingPill: {
  minHeight: 48,
  borderRadius: 17,
  backgroundColor: "rgba(255,255,255,0.065)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.09)",
  paddingHorizontal: 14,
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
},

});