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
  Modal,
  Linking,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "../components/AppHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { StarRating } from "../components/StarRating";
import { DateField } from "../components/DateField";
import { useToast } from "../components/ToastProvider";

import { apiPatch, apiDelete, apiGet } from "../lib/api";
import { getCachedGigs, setCachedGigs } from "../lib/gigsCache";
import {
  enqueueGigDelete,
  enqueueGigUpdate,
  isOfflineError,
} from "../lib/offlineQueue";
import { Colours } from "../theme/colours";
import type { Gig, CreateGigInput } from "../shared/types/Gig";
import { parseYmdToUtcDate } from "../lib/date";
import { addGigToCalendar } from "../lib/calendar";
import {
  createSessionToken,
  getPlaceDetails,
  searchVenues,
  type PlaceDetails,
  type PlaceSuggestion,
} from "./googlePlaces";

type GigSetlistItem = {
  id: string;
  eventDate: string;
  venueName: string;
  cityName: string;
  countryCode: string | null;
  url: string | null;
  songCount: number;
  sets: Array<{
    name: string;
    encore: number;
    songs: string[];
  }>;
};

type GigSetlistMatchResponse = {
  matched: boolean;
  confidence: number;
  setlist: GigSetlistItem | null;
};

const UI_COPY = {
  venueLoading: "Finding the venue…",
  autoCity: "City found ✓",
  saving: "Locking it in…",
  deleting: "Removing it…",
  setlistLoading: "Looking for a matching setlist…",
  setlistReady: "Matched setlist found ✓",
  setlistMissing: "No strong setlist match found yet.",
};

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

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
  const [addToCalendar, setAddToCalendar] = React.useState(false);

  const [venueLoading, setVenueLoading] = React.useState(false);
  const [venueError, setVenueError] = React.useState("");
  const [venueOpen, setVenueOpen] = React.useState(false);
  const [venueTouched, setVenueTouched] = React.useState(false);
  const [justAutoCity, setJustAutoCity] = React.useState(false);

  const [venueResults, setVenueResults] = React.useState<PlaceSuggestion[]>([]);
  const [venueSessionToken, setVenueSessionToken] = React.useState(
    createSessionToken(),
  );
  const [locationBias] = React.useState<
    | {
        latitude: number;
        longitude: number;
      }
    | undefined
  >(
    props.gig.venueLatitude != null && props.gig.venueLongitude != null
      ? {
          latitude: props.gig.venueLatitude,
          longitude: props.gig.venueLongitude,
        }
      : undefined,
  );

  const [selectedVenueLat, setSelectedVenueLat] = React.useState<
    number | undefined
  >(props.gig.venueLatitude);
  const [selectedVenueLng, setSelectedVenueLng] = React.useState<
    number | undefined
  >(props.gig.venueLongitude);
  const [selectedVenuePlaceName, setSelectedVenuePlaceName] = React.useState<
    string | undefined
  >(props.gig.venuePlaceName);
  const [selectedVenuePlaceId, setSelectedVenuePlaceId] = React.useState<
    string | undefined
  >(props.gig.venuePlaceId);

  const [setlistLoading, setSetlistLoading] = React.useState(false);
  const [setlistError, setSetlistError] = React.useState("");
  const [setlistMatch, setSetlistMatch] =
    React.useState<GigSetlistMatchResponse | null>(null);
  const [setlistModalOpen, setSetlistModalOpen] = React.useState(false);

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

  const requiredMissing =
    !artist.trim() || !venue.trim() || !city.trim() || !date.trim();

  const dateInvalid =
    date.trim().length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(date.trim());

  const canLookupSetlist = Boolean(
    artist.trim() && venue.trim() && city.trim() && date.trim() && !dateInvalid,
  );

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
    if (!venueTouched) return;

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
      return;
    }

    const t = setTimeout(() => {
      void runVenueSearch(q);
    }, 320);

    return () => clearTimeout(t);
  }, [venue, runVenueSearch, venueTouched, selectedVenuePlaceId]);

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

      setVenueOpen(false);
      setVenueResults([]);
      setVenueError("");
      setVenueLoading(false);
      setVenueSessionToken(createSessionToken());
    } catch (e: any) {
      setVenueError(e?.message ?? "Failed to load venue details");
      setVenueLoading(false);
    }
  };

  const loadSetlistMatch = React.useCallback(async () => {
    if (!canLookupSetlist) {
      setSetlistMatch(null);
      setSetlistError("");
      return;
    }

    setSetlistLoading(true);
    setSetlistError("");

    try {
      const qs = new URLSearchParams();
      qs.set("artist", artist.trim());
      qs.set("date", date.trim());
      qs.set("city", city.trim());
      qs.set("venue", venue.trim());

      const res = await apiGet<GigSetlistMatchResponse>(
        `/setlist/gig-match?${qs.toString()}`,
      );

      setSetlistMatch(res);
    } catch (e: any) {
      setSetlistError(e?.message ?? "Failed to load setlist");
      setSetlistMatch(null);
    } finally {
      setSetlistLoading(false);
    }
  }, [artist, city, date, venue, canLookupSetlist]);

  React.useEffect(() => {
    if (!canLookupSetlist) {
      setSetlistMatch(null);
      setSetlistError("");
      return;
    }

    const t = setTimeout(() => {
      void loadSetlistMatch();
    }, 400);

    return () => clearTimeout(t);
  }, [loadSetlistMatch, canLookupSetlist]);

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
      venuePlaceId: selectedVenuePlaceId,
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

      try {
        const cached = await getCachedGigs();
        const updated = cached.map((g) =>
          g.id === props.gig.id
            ? {
                ...g,
                ...payload,
              }
            : g,
        );
        await setCachedGigs(updated as Gig[]);
      } catch {}

      showToast({ message: "Saved" });

      if (addToCalendar && canAddToCalendar) {
        try {
          await addGigToCalendar({
            title: `${payload.artist!} @ ${payload.venue!}`,
            location: `${payload.venue!}, ${payload.city!}`,
            date: payload.date!,
          });
        } catch (e: any) {
          Alert.alert("Calendar", e?.message ?? "Couldn’t add to calendar");
        }
      }

      props.onDone();
    } catch (e: any) {
      if (isOfflineError(e)) {
        try {
          await enqueueGigUpdate(props.gig.id, payload);

          const cached = await getCachedGigs();
          const updated = cached.map((g) =>
            g.id === props.gig.id
              ? {
                  ...g,
                  ...payload,
                }
              : g,
          );

          await setCachedGigs(updated as Gig[]);

          Alert.alert(
            "Saved offline",
            "You’re offline. These changes were queued and will sync when you’re back online.",
          );

          props.onDone();
          return;
        } catch (qErr: any) {
          Alert.alert(
            "Offline save failed",
            qErr?.message ?? "Couldn’t queue edit.",
          );
          return;
        }
      }

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

      try {
        const cached = await getCachedGigs();
        await setCachedGigs(cached.filter((g) => g.id !== props.gig.id));
      } catch {}

      showToast({ message: "Deleted" });
      props.onDone();
    } catch (e: any) {
      if (isOfflineError(e)) {
        try {
          await enqueueGigDelete(props.gig.id);

          const cached = await getCachedGigs();
          await setCachedGigs(cached.filter((g) => g.id !== props.gig.id));

          Alert.alert(
            "Deleted offline",
            "You’re offline. This delete was queued and will sync when you’re back online.",
          );

          props.onDone();
          return;
        } catch (qErr: any) {
          Alert.alert(
            "Offline delete failed",
            qErr?.message ?? "Couldn’t queue delete.",
          );
          return;
        }
      }

      Alert.alert("Error", e?.message ?? "Failed to delete gig");
    } finally {
      setLoading(false);
    }
  };

  const openSetlistUrl = async () => {
    const url = setlistMatch?.setlist?.url?.trim();
    if (!url) return;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Couldn’t open link", "Setlist link could not be opened.");
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
                setVenueError("");
                setSelectedVenueLat(undefined);
                setSelectedVenueLng(undefined);
                setSelectedVenuePlaceName(undefined);
                setSelectedVenuePlaceId(undefined);
              }}
              placeholder="Start typing a venue…"
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

            {venueOpen && !venueLoading && venueResults.length > 0 ? (
              <View style={styles.suggestCard}>
                {venueResults.map((place) => (
                  <Pressable
                    key={place.placeId}
                    onPress={() => void chooseGoogleVenue(place)}
                    style={({ pressed }) => [
                      styles.suggestRow,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestTitle}>{place.title}</Text>
                      {place.subtitle ? (
                        <Text style={styles.suggestMeta}>{place.subtitle}</Text>
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

                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightTitle}>
                        {addToCalendar
                          ? "Will open calendar after save"
                          : "Add to calendar"}
                      </Text>
                      <Text style={styles.highlightText}>
                        Create a calendar event for this gig.
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.setlistCard}>
              <View style={styles.setlistHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.setlistTitle}>Matched setlist</Text>
                  <Text style={styles.setlistSubtitle}>
                    We try to match by artist, date, city, and venue.
                  </Text>
                </View>

                <Pressable
                  onPress={() => void loadSetlistMatch()}
                  disabled={setlistLoading || !canLookupSetlist}
                  style={({ pressed }) => [
                    styles.refreshSetlistBtn,
                    pressed ? { opacity: 0.88 } : null,
                    setlistLoading || !canLookupSetlist ? { opacity: 0.5 } : null,
                  ]}
                >
                  <Text style={styles.refreshSetlistBtnText}>Refresh</Text>
                </Pressable>
              </View>

              {setlistLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator />
                  <Text style={styles.muted}>{UI_COPY.setlistLoading}</Text>
                </View>
              ) : setlistError ? (
                <Text style={{ color: Colours.text.danger, fontWeight: "800" }}>
                  {setlistError}
                </Text>
              ) : setlistMatch?.matched && setlistMatch.setlist ? (
                <View style={{ gap: 10 }}>
                  <Text style={styles.setlistSuccess}>
                    {UI_COPY.setlistReady} • Confidence{" "}
                    {formatConfidence(setlistMatch.confidence)}
                  </Text>

                  <View style={styles.setlistMetaBox}>
                    <Text style={styles.setlistMetaTitle}>
                      {setlistMatch.setlist.venueName}
                    </Text>
                    <Text style={styles.setlistMetaText}>
                      {setlistMatch.setlist.cityName} •{" "}
                      {setlistMatch.setlist.eventDate}
                    </Text>
                    <Text style={styles.setlistMetaText}>
                      {setlistMatch.setlist.songCount} songs
                    </Text>
                  </View>

                  <View style={{ gap: 8 }}>
                    <PrimaryButton
                      title="View setlist"
                      onPress={() => setSetlistModalOpen(true)}
                    />

                    {setlistMatch.setlist.url ? (
                      <Pressable
                        onPress={() => void openSetlistUrl()}
                        style={({ pressed }) => [
                          styles.openLinkBtn,
                          pressed ? { opacity: 0.88 } : null,
                        ]}
                      >
                        <Text style={styles.openLinkBtnText}>
                          Open on Setlist.fm
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : (
                <Text style={styles.muted}>{UI_COPY.setlistMissing}</Text>
              )}
            </View>

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
                <Text style={styles.muted}>{UI_COPY.deleting}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={setlistModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSetlistModalOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSetlistModalOpen(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Setlist</Text>

            {setlistMatch?.setlist ? (
              <>
                <Text style={styles.modalSubtitle}>
                  {setlistMatch.setlist.venueName} • {setlistMatch.setlist.cityName}
                </Text>
                <Text style={styles.modalSubmeta}>
                  {setlistMatch.setlist.eventDate}
                </Text>

                <ScrollView
                  style={{ maxHeight: 360, marginTop: 14 }}
                  showsVerticalScrollIndicator={false}
                >
                  {setlistMatch.setlist.sets.map((set, setIndex) => (
                    <View key={`${set.name}-${setIndex}`} style={styles.setBlock}>
                      <Text style={styles.setBlockTitle}>
                        {set.name || (set.encore > 0 ? `Encore ${set.encore}` : "Set")}
                      </Text>

                      <View style={{ height: 8 }} />

                      {set.songs.length > 0 ? (
                        set.songs.map((song, songIndex) => (
                          <Text
                            key={`${song}-${songIndex}`}
                            style={styles.songRow}
                          >
                            {songIndex + 1}. {song}
                          </Text>
                        ))
                      ) : (
                        <Text style={styles.muted}>No songs listed.</Text>
                      )}
                    </View>
                  ))}
                </ScrollView>

                <View style={{ gap: 8, marginTop: 14 }}>
                  {setlistMatch.setlist.url ? (
                    <Pressable
                      onPress={() => void openSetlistUrl()}
                      style={({ pressed }) => [
                        styles.openLinkBtn,
                        pressed ? { opacity: 0.88 } : null,
                      ]}
                    >
                      <Text style={styles.openLinkBtnText}>Open on Setlist.fm</Text>
                    </Pressable>
                  ) : null}

                  <PrimaryButton
                    title="Close"
                    onPress={() => setSetlistModalOpen(false)}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.muted}>No matched setlist available.</Text>
                <View style={{ marginTop: 14 }}>
                  <PrimaryButton
                    title="Close"
                    onPress={() => setSetlistModalOpen(false)}
                  />
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  highlightSection: {
    marginTop: 6,
  },
  sectionTitle: {
    color: Colours.text.muted,
    fontSize: 12,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  highlightRow: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  highlightLeft: {
    flexDirection: "row" as const,
    gap: 10,
    alignItems: "center" as const,
  },
  highlightTitle: {
    color: Colours.text.primary,
    fontWeight: "800" as const,
    fontSize: 14,
  },
  highlightText: {
    color: Colours.text.muted,
    fontSize: 12,
    fontWeight: "600" as const,
    marginTop: 2,
  },
  highlightActiveBlue: {
    backgroundColor: "rgba(126,182,255,0.08)",
    borderColor: "rgba(126,182,255,0.3)",
  },
  highlightPressed: {
    opacity: 0.9,
  },
  highlightIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  highlightIconBlue: {
    backgroundColor: "rgba(126,182,255,0.12)",
    borderColor: "rgba(126,182,255,0.22)",
  },
  setlistCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 12,
    gap: 10,
  },
  setlistHeaderRow: {
    flexDirection: "row" as const,
    gap: 12,
    alignItems: "flex-start" as const,
    justifyContent: "space-between" as const,
  },
  setlistTitle: {
    color: Colours.text.primary,
    fontWeight: "900" as const,
    fontSize: 16,
  },
  setlistSubtitle: {
    marginTop: 4,
    color: Colours.text.muted,
    fontWeight: "700" as const,
    lineHeight: 18,
    fontSize: 12,
  },
  refreshSetlistBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  refreshSetlistBtnText: {
    color: Colours.text.primary,
    fontWeight: "800" as const,
    fontSize: 12,
  },
  setlistSuccess: {
    color: "#2EE59D",
    fontWeight: "800" as const,
    fontSize: 13,
    lineHeight: 18,
  },
  setlistMetaBox: {
    backgroundColor: "rgba(0,0,0,0.16)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 12,
    gap: 4,
  },
  setlistMetaTitle: {
    color: Colours.text.primary,
    fontWeight: "900" as const,
    fontSize: 14,
  },
  setlistMetaText: {
    color: Colours.text.muted,
    fontWeight: "700" as const,
    fontSize: 12,
    lineHeight: 16,
  },
  openLinkBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 12,
  },
  openLinkBtnText: {
    color: Colours.text.primary,
    fontWeight: "800" as const,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center" as const,
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 16,
    maxHeight: "82%" as const,
  },
  modalTitle: {
    color: Colours.text.primary,
    fontWeight: "900" as const,
    fontSize: 20,
  },
  modalSubtitle: {
    marginTop: 8,
    color: Colours.text.primary,
    fontWeight: "800" as const,
    fontSize: 14,
  },
  modalSubmeta: {
    marginTop: 4,
    color: Colours.text.muted,
    fontWeight: "700" as const,
    fontSize: 12,
  },
  setBlock: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  setBlockTitle: {
    color: Colours.text.primary,
    fontWeight: "900" as const,
    fontSize: 14,
  },
  songRow: {
    color: Colours.text.secondary,
    fontWeight: "700" as const,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
};