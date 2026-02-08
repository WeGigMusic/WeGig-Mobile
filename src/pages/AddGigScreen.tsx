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
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { StarRating } from "../components/StarRating";
import { AppHeader } from "../components/AppHeader";
import { apiPost, apiGet } from "../lib/api";
import { Colours } from "../theme/colours";
import type { CreateGigInput, Gig } from "../shared/types/Gig";

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

export function AddGigScreen(props: {
  onCreated?: (gig: Gig) => void;
  prefill?: Partial<CreateGigInput> | null;
  onPrefillUsed?: () => void;
  onPressLogo?: () => void;
}) {
  const [artist, setArtist] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [city, setCity] = React.useState("");
  const [date, setDate] = React.useState("");
  const [rating, setRating] = React.useState<number | undefined>(undefined);

  // Date picker
  const [showDatePicker, setShowDatePicker] = React.useState(false);

  // MusicBrainz
  const [artistMbid, setArtistMbid] = React.useState<string | undefined>(
    undefined,
  );
  const [mbLoading, setMbLoading] = React.useState(false);
  const [mbResults, setMbResults] = React.useState<MbArtist[]>([]);
  const [mbError, setMbError] = React.useState("");
  const [mbOpen, setMbOpen] = React.useState(false);

  // Ticketmaster venues
  const [tmLoading, setTmLoading] = React.useState(false);
  const [tmResults, setTmResults] = React.useState<TmVenue[]>([]);
  const [tmError, setTmError] = React.useState("");
  const [tmOpen, setTmOpen] = React.useState(false);

  // Import/meta
  const [notes, setNotes] = React.useState("");
  const [externalSource, setExternalSource] = React.useState<string | undefined>(
    undefined,
  );
  const [externalId, setExternalId] = React.useState<string | undefined>(
    undefined,
  );
  const [ticketUrl, setTicketUrl] = React.useState<string | undefined>(
    undefined,
  );

  const [loading, setLoading] = React.useState(false);
  const [justPrefilled, setJustPrefilled] = React.useState(false);

  const [justAutoCity, setJustAutoCity] = React.useState(false);

  // ✅ “No rating if future gig”
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
    if (typeof props.prefill.rating === "number") setRating(props.prefill.rating);

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

  // --- MusicBrainz artist autocomplete ---
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

  // --- Ticketmaster venue autocomplete ---
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

  const submit = async () => {
    const payload: CreateGigInput = {
      artist: artist.trim(),
      venue: venue.trim(),
      city: city.trim(),
      date: date.trim(),
      rating: isFutureGig ? undefined : rating,
    };

    (payload as any).notes = notes.trim() || undefined;
    (payload as any).artistMbid = artistMbid;
    (payload as any).externalSource = externalSource;
    (payload as any).externalId = externalId;
    (payload as any).ticketUrl = ticketUrl;

    if (!payload.artist || !payload.venue || !payload.city || !payload.date) {
      Alert.alert("Missing fields", "Artist, venue, city and date are required.");
      return;
    }

    setLoading(true);
    try {
      const created = await apiPost<Gig>("/gigs", payload);

      Alert.alert("Saved", "Gig added.");
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

      setMbResults([]);
      setMbOpen(false);
      setMbError("");

      setTmResults([]);
      setTmOpen(false);
      setTmError("");

      setJustAutoCity(false);
      setShowDatePicker(false);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add gig");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader title="Add Gig" onPressLogo={props.onPressLogo} />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Log a gig</Text>
          <Text style={styles.subtitle}>
            Use <Text style={styles.bold}>Discover</Text> to prefill shows faster.
          </Text>

          {justPrefilled ? (
            <Text style={styles.ok}>Prefilled from Discover ✓</Text>
          ) : null}
        </View>

        <View style={[styles.card, { gap: 12 }]}>
          <TextField
            label="Artist"
            value={artist}
            onChangeText={(t) => {
              setArtist(t);
              setMbOpen(true);
            }}
            placeholder="Start typing (e.g. Coldplay)"
            autoCapitalize="words"
          />

          {mbLoading ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator />
              <Text style={styles.muted}>Searching artists…</Text>
            </View>
          ) : null}

          {mbError ? (
            <Text style={{ color: Colours.text.danger, fontWeight: "700" }}>
              {mbError}
            </Text>
          ) : null}

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
                      {meta ? <Text style={styles.suggestMeta}>{meta}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {artistMbid ? <Text style={styles.muted}>Matched artist ✓</Text> : null}

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
            <View style={styles.inlineRow}>
              <ActivityIndicator />
              <Text style={styles.muted}>Searching venues…</Text>
            </View>
          ) : null}

          {tmError ? (
            <Text style={{ color: Colours.text.danger, fontWeight: "700" }}>
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

          {justAutoCity ? (
            <Text style={styles.muted}>City set from venue ✓</Text>
          ) : null}

          {/* ✅ Date Picker */}
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

          {/* ✅ Rating (only after gig date) */}
          {isFutureGig ? (
            <Text style={styles.muted}>Rating available after the gig date.</Text>
          ) : (
            <View style={{ gap: 8 }}>
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
              <Text style={styles.muted}>Saving…</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colours.background.app },
  body: { padding: 16, gap: 12, paddingBottom: 28 },

  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },

  title: { color: Colours.text.primary, fontSize: 26, fontWeight: "900" },
  subtitle: { color: Colours.text.muted, marginTop: 6, lineHeight: 20 },
  bold: { color: Colours.text.primary, fontWeight: "800" },
  ok: { marginTop: 10, color: "#2EE59D", fontWeight: "800" },

  label: { color: Colours.text.secondary, fontWeight: "700", fontSize: 13 },
  muted: { color: Colours.text.muted, fontWeight: "700" },

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
  },

  suggestTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
  },

  suggestMeta: {
    marginTop: 2,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
  },
});
