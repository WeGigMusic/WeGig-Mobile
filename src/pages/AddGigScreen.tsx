import React from "react";
import {
  SafeAreaView,
  Text,
  Alert,
  ScrollView,
  View,
  ActivityIndicator,
} from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { StarRating } from "../components/StarRating";
import { AppHeader } from "../components/AppHeader";
import { apiPost } from "../lib/api";
import { Colours } from "../theme/colours";
import type { CreateGigInput, Gig } from "../shared/types/Gig";

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
  const [loading, setLoading] = React.useState(false);
  const [justPrefilled, setJustPrefilled] = React.useState(false);

  React.useEffect(() => {
    if (!props.prefill) return;

    if (props.prefill.artist) setArtist(String(props.prefill.artist));
    if (props.prefill.venue) setVenue(String(props.prefill.venue));
    if (props.prefill.city) setCity(String(props.prefill.city));
    if (props.prefill.date) setDate(String(props.prefill.date));
    if (typeof props.prefill.rating === "number")
      setRating(props.prefill.rating);

    setJustPrefilled(true);
    const t = setTimeout(() => setJustPrefilled(false), 2500);
    props.onPrefillUsed?.();

    return () => clearTimeout(t);
  }, [props.prefill]);

  const submit = async () => {
    const payload: CreateGigInput = {
      artist: artist.trim(),
      venue: venue.trim(),
      city: city.trim(),
      date: date.trim(),
      rating,
    };

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
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add gig");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colours.background.app }}>
      <AppHeader title="Add Gig" onPressLogo={props.onPressLogo} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={styles.card}>
          <Text style={styles.title}>Log a gig</Text>
          <Text style={styles.subtitle}>
            Use <Text style={styles.bold}>Discover</Text> to prefill shows faster.
          </Text>

          {justPrefilled && (
            <Text style={styles.ok}>Prefilled from Discover ✓</Text>
          )}
        </View>

        <View style={[styles.card, { gap: 12 }]}>
          <TextField label="Artist" value={artist} onChangeText={setArtist} />
          <TextField label="Venue" value={venue} onChangeText={setVenue} />
          <TextField label="City" value={city} onChangeText={setCity} />
          <TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />

          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Rating</Text>
            <StarRating value={rating} onChange={setRating} showLabel />
          </View>

          <PrimaryButton
            title={loading ? "Saving…" : "Save"}
            onPress={submit}
            disabled={loading}
          />

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.muted}>Saving…</Text>
            </View>
          )}
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
    fontSize: 26,
    fontWeight: "900",
  },
  subtitle: {
    color: Colours.text.muted,
    marginTop: 6,
  },
  bold: {
    color: Colours.text.primary,
    fontWeight: "800",
  },
  ok: {
    marginTop: 10,
    color: "#2EE59D",
    fontWeight: "800",
  },
  label: {
    color: Colours.text.secondary,
    fontWeight: "700",
    fontSize: 13,
  },
  muted: {
    color: Colours.text.muted,
    fontWeight: "700",
  },
  loadingRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 10,
  },
};
