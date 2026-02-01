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
import { apiPost } from "../lib/api";
import type { CreateGigInput, Gig } from "../shared/types/Gig";

const COLORS = {
  bg: "#0B0B10",
  card: "#141422",
  card2: "#10101A",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.65)",
  faint: "rgba(255,255,255,0.12)",
  brand: "#FF4D6D",
  ok: "#2EE59D",
  danger: "#FF4D4D",
};

export function AddGigScreen(props: {
  onCreated?: (gig: Gig) => void;
  prefill?: Partial<CreateGigInput> | null;
  onPrefillUsed?: () => void;
}) {
  const [artist, setArtist] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [city, setCity] = React.useState("");
  const [date, setDate] = React.useState(""); // YYYY-MM-DD
  const [loading, setLoading] = React.useState(false);

  const [justPrefilled, setJustPrefilled] = React.useState(false);

  // ✅ Apply prefill when Discover sends a draft
  React.useEffect(() => {
    if (!props.prefill) return;

    if (props.prefill.artist != null) setArtist(String(props.prefill.artist));
    if (props.prefill.venue != null) setVenue(String(props.prefill.venue));
    if (props.prefill.city != null) setCity(String(props.prefill.city));
    if (props.prefill.date != null) setDate(String(props.prefill.date));

    setJustPrefilled(true);
    const t = setTimeout(() => setJustPrefilled(false), 2500);

    props.onPrefillUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => clearTimeout(t);
  }, [props.prefill]);

  const submit = async () => {
    const payload: CreateGigInput = {
      artist: artist.trim(),
      venue: venue.trim(),
      city: city.trim(),
      date: date.trim(),
    };

    if (!payload.artist || !payload.venue || !payload.city || !payload.date) {
      Alert.alert("Missing fields", "Artist, venue, city and date are required.");
      return;
    }

    setLoading(true);
    try {
      const created = await apiPost<Gig>("/gigs", payload);

      setArtist("");
      setVenue("");
      setCity("");
      setDate("");

      Alert.alert("Saved", "Gig added.");
      props.onCreated?.(created);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add gig");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 12 }}>
        {/* Header card */}
        <View
          style={{
            backgroundColor: COLORS.card,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: COLORS.faint,
          }}
        >
          <Text style={{ color: COLORS.text, fontSize: 26, fontWeight: "900" }}>
            Add Gig
          </Text>

          <Text style={{ color: COLORS.muted, marginTop: 6, lineHeight: 20 }}>
            Log a show you attended. Use <Text style={{ color: COLORS.text, fontWeight: "800" }}>Discover</Text> to
            prefill and save faster.
          </Text>

          {justPrefilled ? (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: COLORS.ok, fontWeight: "800" }}>
                Prefilled from Discover ✓
              </Text>
            </View>
          ) : null}
        </View>

        {/* Form card */}
        <View
          style={{
            backgroundColor: COLORS.card2,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: COLORS.faint,
            gap: 12,
          }}
        >
          <TextField
            label="Artist"
            value={artist}
            onChangeText={setArtist}
            placeholder="Artist"
            autoCapitalize="words"
          />

          <TextField
            label="Venue"
            value={venue}
            onChangeText={setVenue}
            placeholder="Venue"
            autoCapitalize="words"
          />

          <TextField
            label="City"
            value={city}
            onChangeText={setCity}
            placeholder="City"
            autoCapitalize="words"
          />

          <TextField
            label="Date (YYYY-MM-DD)"
            value={date}
            onChangeText={setDate}
            placeholder="2026-01-24"
            autoCapitalize="none"
          />

          <View style={{ marginTop: 4 }}>
            <PrimaryButton
              title={loading ? "Saving..." : "Save"}
              onPress={submit}
              disabled={loading}
            />
            {loading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
                <ActivityIndicator />
                <Text style={{ color: COLORS.muted, fontWeight: "600" }}>
                  Saving…
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Tiny helper */}
        <Text style={{ color: COLORS.muted, textAlign: "center" }}>
          Tip: Use{" "}
          <Text style={{ color: COLORS.text, fontWeight: "800" }}>
            Discover
          </Text>{" "}
          to import shows quickly.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
