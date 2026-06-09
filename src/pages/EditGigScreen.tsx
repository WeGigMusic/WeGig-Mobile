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
  Keyboard,
  TextInput,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "../components/AppHeader";
import { StarRating } from "../components/StarRating";
import { DateField } from "../components/DateField";
import { CitySearchInput } from "../components/CitySearchInput";
import { useToast } from "../components/ToastProvider";

import { apiPatch, apiDelete, apiGet } from "../lib/api";
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
  artistLoading: "Looking up artists…",
  venueLoading: "Finding the venue…",
  autoCity: "City found ✓",
  deleting: "Removing it…",
};

function IconInput(props: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  onFocus?: () => void;
}) {
  return (
    <View
      style={[
        styles.iconInputWrap,
        props.multiline ? styles.notesWrap : null,
      ]}
    >
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
        autoCapitalize={
  props.autoCapitalize ?? (props.multiline ? "sentences" : "words")
}
        autoCorrect={false}
        multiline={props.multiline}
        returnKeyType={props.multiline ? "done" : "next"}
blurOnSubmit={true}
onSubmitEditing={() => {
  Keyboard.dismiss();
}}
        onFocus={props.onFocus}
        style={[styles.iconInput, props.multiline ? styles.notesInput : null]}
      />
    </View>
  );
}

function ActionButton(props: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [
        styles.saveBtn,
        props.disabled ? styles.saveBtnDisabled : null,
        pressed && !props.disabled ? styles.saveBtnPressed : null,
      ]}
    >
      <Text style={styles.saveBtnText}>{props.title}</Text>
    </Pressable>
  );
}

export function EditGigScreen(props: {
  gig: Gig;
  onDone: () => void;
  onPressLogo?: () => void;
  onBack?: () => void;
  onPressArtist?: (artist: string) => void;
}) {
  const { showToast } = useToast();
  const scrollRef = React.useRef<any>(null);
  const suppressNextArtistSearchRef = React.useRef(false);
  const suppressNextVenueSearchRef = React.useRef(false);

  const [artist, setArtist] = React.useState(props.gig.artist);
  const [artistMbid, setArtistMbid] = React.useState<string | undefined>(
    props.gig.artistMbid,
  );

  const [mbLoading, setMbLoading] = React.useState(false);
  const [mbResults, setMbResults] = React.useState<MbArtist[]>([]);
  const [mbError, setMbError] = React.useState("");
  const [mbOpen, setMbOpen] = React.useState(false);

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
    if (!mbOpen) return;

    if (suppressNextArtistSearchRef.current) {
      suppressNextArtistSearchRef.current = false;
      setMbOpen(false);
      setMbResults([]);
      setMbLoading(false);
      return;
    }

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
  }, [artist, mbOpen, runMbSearch]);

  const chooseArtist = (a: MbArtist) => {
    suppressNextArtistSearchRef.current = true;
    setArtist(a.name);
    setArtistMbid(a.id);
    setMbOpen(false);
    setMbResults([]);
    setMbError("");
    setMbLoading(false);
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
    if (!venueTouched) return;

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

      suppressNextVenueSearchRef.current = true;
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
    const payload: Omit<Partial<CreateGigInput>, "rating"> & {
      rating?: number | null;
    } = {
      artist: artist.trim(),
      venue: venue.trim(),
      city: city.trim(),
      date: date.trim(),
      notes: notes.trim() || undefined,
      rating: isFutureGig ? null : rating ?? null,
      venueLatitude: selectedVenueLat,
      venueLongitude: selectedVenueLng,
      venuePlaceName: selectedVenuePlaceName,
      venuePlaceId: selectedVenuePlaceId,
      ticketUrl: props.gig.ticketUrl,
      externalSource: props.gig.externalSource,
      externalId: props.gig.externalId,
      artistMbid,
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <AppHeader
          onPressLogo={props.onPressLogo}
          onPressBack={props.onBack}
          backLabel="Artist"
        />

        <KeyboardAwareScrollView
          ref={scrollRef}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={130}
        >
          <View style={styles.hero}>
            <Text style={styles.title}>Edit gig</Text>
          </View>

          <View style={styles.form}>
            <IconInput
              icon="person-outline"
              value={artist}
              onChangeText={(value) => {
                setArtist(value);
                setArtistMbid(undefined);
                setMbOpen(true);
              }}
              placeholder="Start typing an artist..."
            />

            {mbLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <Text style={styles.muted}>{UI_COPY.artistLoading}</Text>
              </View>
            ) : null}

            {mbError ? <Text style={styles.errorText}>{mbError}</Text> : null}

            {mbOpen && !mbLoading && mbResults.length > 0 ? (
              <View style={styles.suggestCard}>
                {mbResults.map((a, index) => {
                  const meta = [a.country, a.disambiguation]
                    .filter(Boolean)
                    .join(" • ");

                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => chooseArtist(a)}
                      style={({ pressed }) => [
                        styles.suggestRow,
                        index === mbResults.length - 1
                          ? styles.suggestRowLast
                          : null,
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

            <CitySearchInput
              value={city}
              onChangeText={setCity}
              placeholder="Start typing a city…"
            />

            {justAutoCity ? (
              <Text style={styles.successText}>{UI_COPY.autoCity}</Text>
            ) : null}

            <IconInput
              icon="business-outline"
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
              placeholder="Start typing a venue..."
            />

            {venueLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <Text style={styles.muted}>{UI_COPY.venueLoading}</Text>
              </View>
            ) : null}

            {venueError ? (
              <Text style={styles.errorText}>{venueError}</Text>
            ) : null}

            {venueOpen && !venueLoading && venueResults.length > 0 ? (
              <View style={styles.suggestCard}>
                {venueResults.map((place, index) => (
                  <Pressable
                    key={place.placeId}
                    onPress={() => void chooseGoogleVenue(place)}
                    style={({ pressed }) => [
                      styles.suggestRow,
                      index === venueResults.length - 1
                        ? styles.suggestRowLast
                        : null,
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

            <DateField value={date} onChange={setDate} placeholder="Select date" />

            {dateInvalid ? (
              <Text style={styles.errorText}>Date must be YYYY-MM-DD.</Text>
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
                        color={
                          addToCalendar
                            ? Colours.brand.primary
                            : Colours.text.muted
                        }
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
  autoCapitalize="sentences"
  onFocus={() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true });
    }, 180);
  }}
/>

            {requiredMissing ? (
              <Text style={styles.errorText}>
                Artist, venue, city and date are required.
              </Text>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                onPress={confirmDelete}
                disabled={loading}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.deleteActionBtn,
                  pressed ? styles.saveBtnPressed : null,
                  loading ? styles.saveBtnDisabled : null,
                ]}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>

              <Pressable
                onPress={save}
                disabled={loading || requiredMissing || dateInvalid}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.saveActionBtn,
                  loading || requiredMissing || dateInvalid
                    ? styles.saveBtnDisabled
                    : null,
                  pressed && !loading ? styles.saveBtnPressed : null,
                ]}
              >
                <Text style={styles.saveBtnText}>
                  {loading ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <Text style={styles.muted}>{UI_COPY.deleting}</Text>
              </View>
            ) : null}
          </View>
        </KeyboardAwareScrollView>
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
                  {setlistMatch.setlist.venueName} •{" "}
                  {setlistMatch.setlist.cityName}
                </Text>
                <Text style={styles.modalSubmeta}>
                  {setlistMatch.setlist.eventDate}
                </Text>

                <ScrollView
                  style={styles.modalScroll}
                  showsVerticalScrollIndicator={false}
                >
                  {setlistMatch.setlist.sets.map((set, setIndex) => (
                    <View
                      key={`${set.name}-${setIndex}`}
                      style={styles.setBlock}
                    >
                      <Text style={styles.setBlockTitle}>
                        {set.name ||
                          (set.encore > 0 ? `Encore ${set.encore}` : "Set")}
                      </Text>

                      <View style={styles.smallSpacer} />

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

                <View style={styles.modalActions}>
                  {setlistMatch.setlist.url ? (
                    <Pressable
                      onPress={() => void openSetlistUrl()}
                      style={({ pressed }) => [
                        styles.openLinkBtn,
                        pressed ? styles.rowPressed : null,
                      ]}
                    >
                      <Text style={styles.openLinkBtnText}>
                        Open on Setlist.fm
                      </Text>
                    </Pressable>
                  ) : null}

                  <ActionButton
                    title="Close"
                    onPress={() => setSetlistModalOpen(false)}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.muted}>No matched setlist available.</Text>
                <View style={styles.closeOnlyWrap}>
                  <ActionButton
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
  title: {
    color: Colours.text.primary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900" as const,
    letterSpacing: -0.2,
  },
  muted: {
    color: Colours.text.muted,
    fontWeight: "800" as const,
    fontSize: 13,
    lineHeight: 18,
  },
  successText: {
    color: "#2EE59D",
    fontWeight: "800" as const,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: Colours.text.danger,
    fontWeight: "800" as const,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingRow: {
    flexDirection: "row" as const,
    gap: 10,
    alignItems: "center" as const,
    marginTop: 4,
  },
  suggestCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    overflow: "hidden" as const,
  },
  suggestRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  suggestRowLast: {
    borderBottomWidth: 0,
  },
  suggestTitle: {
    color: Colours.text.primary,
    fontWeight: "900" as const,
    fontSize: 14,
    lineHeight: 18,
  },
  suggestMeta: {
    marginTop: 2,
    color: Colours.text.muted,
    fontWeight: "700" as const,
    fontSize: 12,
    lineHeight: 16,
  },
  rowPressed: {
    opacity: 0.9,
  },
  highlightSection: {
    marginTop: 2,
  },
  sectionTitle: {
    color: Colours.text.muted,
    fontSize: 12,
    fontWeight: "800" as const,
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.2,
  },
  highlightRow: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
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
    lineHeight: 18,
  },
  highlightText: {
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
    marginTop: 2,
  },
  highlightActiveBlue: {
    backgroundColor: "rgba(47,140,255,0.12)",
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
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  highlightIconBlue: {
    backgroundColor: "rgba(47,140,255,0.14)",
  },
  saveBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#2F8CFF",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 14,
  },
  saveBtnDisabled: {
    opacity: 0.55,
  },
  saveBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  openLinkBtn: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 12,
  },
  openLinkBtnText: {
    color: Colours.text.primary,
    fontWeight: "800" as const,
    fontSize: 13,
  },
  deleteButtonText: {
    color: "#ff5a6b",
    fontSize: 14,
    fontWeight: "600" as const,
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
    lineHeight: 25,
  },
  modalSubtitle: {
    marginTop: 8,
    color: Colours.text.primary,
    fontWeight: "800" as const,
    fontSize: 14,
    lineHeight: 18,
  },
  modalSubmeta: {
    marginTop: 4,
    color: Colours.text.muted,
    fontWeight: "700" as const,
    fontSize: 12,
    lineHeight: 16,
  },
  modalScroll: {
    maxHeight: 360,
    marginTop: 14,
  },
  modalActions: {
    gap: 8,
    marginTop: 14,
  },
  closeOnlyWrap: {
    marginTop: 14,
  },
  smallSpacer: {
    height: 8,
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
    lineHeight: 18,
  },
  songRow: {
    color: Colours.text.secondary,
    fontWeight: "700" as const,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  actionRow: {
  flexDirection: "row" as const,
  gap: 10,
  marginTop: 2,
},
  actionBtn: {
  flex: 1,
  height: 48,
  borderRadius: 17,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 10,
  },
  saveActionBtn: {
    backgroundColor: "#2F8CFF",
  },
  deleteActionBtn: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  iconInputWrap: {
    minHeight: 48,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.065)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: 14,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  iconInput: {
    flex: 1,
    color: Colours.text.primary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700" as const,
    paddingVertical: Platform.OS === "ios" ? 13 : 9,
  },
  notesWrap: {
    minHeight: 110,
    alignItems: "flex-start" as const,
    paddingTop: 14,
  },
  notesIcon: {
    marginTop: 2,
  },
  notesInput: {
    minHeight: 82,
    textAlignVertical: "top" as const,
    paddingTop: 0,
  },
  ratingPill: {
    minHeight: 48,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.065)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: 14,
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
};