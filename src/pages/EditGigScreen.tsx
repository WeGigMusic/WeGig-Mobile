import React from "react";
import {
  SafeAreaView,
  Alert,
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { AppHeader } from "../components/AppHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { StarRating } from "../components/StarRating";
import { DateField } from "../components/DateField";
import { useToast } from "../components/ToastProvider";

import { apiPatch, apiDelete, apiGet } from "../lib/api";
import { searchPlaces } from "../lib/mapbox";
import { Colours } from "../theme/colours";
import type { Gig, CreateGigInput } from "../shared/types/Gig";
import { parseYmdToUtcDate } from "../lib/date";

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
  venueLoading: "Finding the venue…",
  autoCity: "City found ✓",
  saving: "Locking it in…",
  deleting: "Removing it…",
};

export function EditGigScreen(props: {
  gig: Gig;
  onDone: () => void;
  onPressLogo?: () => void;
  onBack?: () => void;
}) {
  const { showToast } = useToast();

  const [artist, setArtist] = React.useState(props.gig.artist);
  const [venue, setVenue] = React.useState(props.gig.venue);
  const [city, setCity] = React.useState(props.gig.city);
  const [date, setDate] = React.useState(props.gig.date);

  const [notes, setNotes] = React.useState(props.gig.notes ?? "");
  const [rating, setRating] = React.useState<number | undefined>(
    props.gig.rating,
  );

  const [loading, setLoading] = React.useState(false);

  const [venueLoading, setVenueLoading] = React.useState(false);
  const [venueError, setVenueError] = React.useState("");
  const [venueOpen, setVenueOpen] = React.useState(false);
  const [venueTouched, setVenueTouched] = React.useState(false);
  const [justAutoCity, setJustAutoCity] = React.useState(false);

  const [mapboxVenueResults, setMapboxVenueResults] = React.useState<
    MapboxPlace[]
  >([]);
  const [tmResults, setTmResults] = React.useState<TmVenue[]>([]);

  const [selectedVenueLat, setSelectedVenueLat] = React.useState<
    number | undefined
  >(props.gig.venueLatitude);
  const [selectedVenueLng, setSelectedVenueLng] = React.useState<
    number | undefined
  >(props.gig.venueLongitude);
  const [selectedVenuePlaceName, setSelectedVenuePlaceName] = React.useState<
    string | undefined
  >(props.gig.venuePlaceName);
  const [selectedVenueMapboxId, setSelectedVenueMapboxId] = React.useState<
    string | undefined
  >(props.gig.venueMapboxId);

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

  const requiredMissing =
    !artist.trim() || !venue.trim() || !city.trim() || !date.trim();

  const dateInvalid =
    date.trim().length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(date.trim());

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
    if (!venueTouched) return;

    setSelectedVenueLat(undefined);
    setSelectedVenueLng(undefined);
    setSelectedVenuePlaceName(undefined);
    setSelectedVenueMapboxId(undefined);

    const q = venue.trim();
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
  }, [venue, city, runVenueSearch, venueTouched]);

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

  const save = async () => {
    const payload: Partial<CreateGigInput> = {
      artist: artist.trim(),
      venue: venue.trim(),
      city: city.trim(),
      date: date.trim(),
      notes: notes.trim() || undefined,
      rating: isFutureGig ? undefined : rating,
      venueLatitude: selectedVenueLat,
      venueLongitude: selectedVenueLng,
      venuePlaceName: selectedVenuePlaceName,
      venueMapboxId: selectedVenueMapboxId,
      ticketUrl: props.gig.ticketUrl,
      externalSource: props.gig.externalSource,
      externalId: props.gig.externalId,
      artistMbid: props.gig.artistMbid,
    };

    if (!payload.artist || !payload.venue || !payload.city || !payload.date) {
      Alert.alert(
        "Missing fields",
        "Artist, venue, city and date are required.",
      );
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
      Alert.alert("Invalid date", "Date must be in YYYY-MM-DD format.");
      return;
    }

    setLoading(true);
    try {
      await apiPatch(`/gigs/${props.gig.id}`, payload);
      showToast({ message: "Saved" });
      props.onDone();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save changes");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete gig?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: deleteGig },
    ]);
  };

  const deleteGig = async () => {
    setLoading(true);
    try {
      await apiDelete(`/gigs/${props.gig.id}`);
      showToast({ message: "Deleted" });
      props.onDone();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to delete gig");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colours.background.app }}>
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
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>Update details</Text>
            <Text style={styles.subtitle}>
              Rating is only available after the gig date.
            </Text>
          </View>

          <View style={[styles.card, { gap: 12 }]}>
            <TextField label="Artist" value={artist} onChangeText={setArtist} />

            <TextField
              label="Venue"
              value={venue}
              onChangeText={(t) => {
                setVenueTouched(true);
                setVenue(t);
                setVenueOpen(true);
              }}
              placeholder="Start typing venue…"
              autoCapitalize="words"
            />

            {venueLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <Text style={styles.muted}>{UI_COPY.venueLoading}</Text>
              </View>
            ) : null}

            {venueError ? (
              <Text style={{ color: Colours.text.danger, fontWeight: "800" }}>
                {venueError}
              </Text>
            ) : null}

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
            {justAutoCity ? (
              <Text style={styles.muted}>{UI_COPY.autoCity}</Text>
            ) : null}

            <DateField
              label="Date"
              value={date}
              onChange={setDate}
              placeholder="Select date"
            />

            {dateInvalid ? (
              <Text style={{ color: Colours.text.danger, fontWeight: "800" }}>
                Date must be YYYY-MM-DD.
              </Text>
            ) : null}

            {isFutureGig ? (
              <Text style={styles.muted}>
                Rating available after the gig date.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={styles.label}>Rating</Text>
                <StarRating value={rating} onChange={setRating} showLabel />
              </View>
            )}

            <TextField
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            {requiredMissing ? (
              <Text style={{ color: Colours.text.danger, fontWeight: "800" }}>
                Artist, venue, city and date are required.
              </Text>
            ) : null}

            <PrimaryButton
              title={loading ? "Saving…" : "Save changes"}
              onPress={save}
              disabled={loading || requiredMissing || dateInvalid}
            />

            <PrimaryButton
              title={loading ? "Working…" : "Delete gig"}
              onPress={confirmDelete}
              disabled={loading}
              style={{ backgroundColor: Colours.text.danger }}
            />

            {loading ? (
              <View style={styles.loadingRow}>
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

const styles = {
  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },
  title: {
    color: Colours.text.primary,
    fontSize: 22,
    fontWeight: "900" as const,
  },
  subtitle: {
    marginTop: 8,
    color: Colours.text.muted,
    fontWeight: "700" as const,
    lineHeight: 20,
  },
  label: {
    color: Colours.text.secondary,
    fontWeight: "800" as const,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  muted: {
    color: Colours.text.muted,
    fontWeight: "800" as const,
  },
  loadingRow: {
    flexDirection: "row" as const,
    gap: 10,
    alignItems: "center" as const,
    marginTop: 10,
  },
  suggestCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    overflow: "hidden" as const,
  },
  suggestRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colours.ui.border,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  suggestTitle: {
    color: Colours.text.primary,
    fontWeight: "900" as const,
  },
  suggestMeta: {
    marginTop: 2,
    color: Colours.text.muted,
    fontWeight: "700" as const,
    fontSize: 12,
  },
  sourcePill: {
    color: Colours.text.primary,
    fontWeight: "800" as const,
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
    fontWeight: "800" as const,
    fontSize: 11,
    lineHeight: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },
};