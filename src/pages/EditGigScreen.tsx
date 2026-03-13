import React from "react";
import {
  SafeAreaView,
  Alert,
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  Pressable,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";

import { AppHeader } from "../components/AppHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { StarRating } from "../components/StarRating";

import { apiPatch, apiDelete, apiGet } from "../lib/api";
import { Colours } from "../theme/colours";
import type { Gig, CreateGigInput } from "../shared/types/Gig";

const FIRST_GIG_ID_KEY = "wegig.firstGigId";
const FAVOURITE_GIG_ID_KEY = "wegig.favouriteGigId";

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

function parseYmdToUtcDate(ymd: string): Date | null {
  const s = (ymd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toYmdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromYmdToLocalDate(ymd: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test((ymd ?? "").trim())) return new Date();
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function EditGigScreen(props: {
  gig: Gig;
  onDone: () => void;
  onPressLogo?: () => void;
}) {
  const [artist, setArtist] = React.useState(props.gig.artist);
  const [venue, setVenue] = React.useState(props.gig.venue);
  const [city, setCity] = React.useState(props.gig.city);
  const [date, setDate] = React.useState(props.gig.date);

  const [notes, setNotes] = React.useState(props.gig.notes ?? "");
  const [rating, setRating] = React.useState<number | undefined>(props.gig.rating);

  const [loading, setLoading] = React.useState(false);

  const [showDatePicker, setShowDatePicker] = React.useState(false);

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

  const [tmLoading, setTmLoading] = React.useState(false);
  const [tmResults, setTmResults] = React.useState<TmVenue[]>([]);
  const [tmError, setTmError] = React.useState("");
  const [tmOpen, setTmOpen] = React.useState(false);
  const [justAutoCity, setJustAutoCity] = React.useState(false);

  const runTmVenueSearch = React.useCallback(
    async (q: string, cityHint: string) => {
      const query = q.trim();
      if (query.length < 2) {
        setTmResults([]);
        setTmError("");
        setTmLoading(false);
        return;
      }

      setTmLoading(true);
      setTmError("");
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
        setTmOpen(true);
      } catch (e: any) {
        setTmError(e?.message ?? "Venue search failed");
        setTmResults([]);
        setTmOpen(false);
      } finally {
        setTmLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    const q = venue.trim();
    if (q.length < 2) {
      setTmResults([]);
      setTmOpen(false);
      setTmError("");
      return;
    }

    const t = setTimeout(() => {
      void runTmVenueSearch(q, city);
    }, 320);

    return () => clearTimeout(t);
  }, [venue, city, runTmVenueSearch]);

  const chooseVenue = (v: TmVenue) => {
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

    setTmOpen(false);
    setTmResults([]);
    setTmError("");
  };

  const setAsFirstGig = async () => {
    try {
      await AsyncStorage.setItem(FIRST_GIG_ID_KEY, props.gig.id);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      Alert.alert("Saved", "This gig is now your first gig.");
      props.onDone();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save first gig");
    }
  };

  const setAsFavouriteGig = async () => {
    try {
      await AsyncStorage.setItem(FAVOURITE_GIG_ID_KEY, props.gig.id);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      Alert.alert("Saved", "This gig is now your favourite gig.");
      props.onDone();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save favourite gig");
    }
  };

  const save = async () => {
    const payload: Partial<CreateGigInput> = {
      artist: artist.trim(),
      venue: venue.trim(),
      city: city.trim(),
      date: date.trim(),
      notes: notes.trim() || undefined,
      rating: isFutureGig ? undefined : rating,
    };

    if (!payload.artist || !payload.venue || !payload.city || !payload.date) {
      Alert.alert("Missing fields", "Artist, venue, city and date are required.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
      Alert.alert("Invalid date", "Date must be in YYYY-MM-DD format.");
      return;
    }

    setLoading(true);
    try {
      await apiPatch(`/gigs/${props.gig.id}`, payload);
      Alert.alert("Saved", "Gig updated.");
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
      Alert.alert("Deleted", "Gig removed.");
      props.onDone();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to delete gig");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colours.background.app }}>
      <AppHeader onPressLogo={props.onPressLogo} />

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 26 }}
        keyboardShouldPersistTaps="handled"
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
              setVenue(t);
              setTmOpen(true);
            }}
            placeholder="Start typing venue…"
            autoCapitalize="words"
          />

          {tmLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.muted}>Searching venues…</Text>
            </View>
          ) : null}

          {tmError ? (
            <Text style={{ color: Colours.text.danger, fontWeight: "800" }}>
              {tmError}
            </Text>
          ) : null}

          {tmOpen && !tmLoading && tmResults.length > 0 ? (
            <View style={styles.suggestCard}>
              {tmResults.map((v) => {
                const meta = [v.city ?? "", v.countryCode ?? ""]
                  .map((x) => String(x).trim())
                  .filter(Boolean)
                  .join(" • ");

                return (
                  <Pressable
                    key={v.id}
                    onPress={() => chooseVenue(v)}
                    style={({ pressed }) => [
                      styles.suggestRow,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestTitle}>{v.name}</Text>
                      {meta ? <Text style={styles.suggestMeta}>{meta}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <TextField label="City" value={city} onChangeText={setCity} />
          {justAutoCity ? <Text style={styles.muted}>City set from venue ✓</Text> : null}

          <Text style={styles.label}>Date</Text>

          <View style={{ gap: 10 }}>
            <PrimaryButton
              title={date ? `Selected: ${date}` : "Select date"}
              onPress={() => setShowDatePicker(true)}
            />

            {showDatePicker ? (
              <DateTimePicker
                value={fromYmdToLocalDate(date)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, selected) => {
                  if (Platform.OS !== "ios") setShowDatePicker(false);
                  if (selected) setDate(toYmdLocal(selected));
                }}
              />
            ) : null}

            {Platform.OS === "ios" && showDatePicker ? (
              <PrimaryButton title="Done" onPress={() => setShowDatePicker(false)} />
            ) : null}
          </View>

          {dateInvalid ? (
            <Text style={{ color: Colours.text.danger, fontWeight: "800" }}>
              Date must be YYYY-MM-DD.
            </Text>
          ) : null}

          {isFutureGig ? (
            <Text style={styles.muted}>Rating available after the gig date.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Rating</Text>
              <StarRating value={rating} onChange={setRating} showLabel />
            </View>
          )}

          <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />

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
            title="Set as first gig"
            onPress={setAsFirstGig}
            disabled={loading}
            style={{ backgroundColor: "#2F8CFF" }}
          />

          <PrimaryButton
            title="Set as favourite gig"
            onPress={setAsFavouriteGig}
            disabled={loading}
            style={{ backgroundColor: "#8A5BFF" }}
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
              <Text style={styles.muted}>Please wait…</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
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
};