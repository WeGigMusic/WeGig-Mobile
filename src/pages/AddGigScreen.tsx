import React from "react";
import { SafeAreaView, Text, Alert, ScrollView } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { apiPost } from "../lib/api";
import type { CreateGigInput, Gig } from "../shared/types/Gig";



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

  // ✅ Apply prefill when Discover sends a draft
  React.useEffect(() => {
    if (!props.prefill) return;

    if (props.prefill.artist != null) setArtist(String(props.prefill.artist));
    if (props.prefill.venue != null) setVenue(String(props.prefill.venue));
    if (props.prefill.city != null) setCity(String(props.prefill.city));
    if (props.prefill.date != null) setDate(String(props.prefill.date));

    props.onPrefillUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.prefill]);

  const submit = async () => {
    const payload: CreateGigInput = {
      artist: artist.trim(),
      venue: venue.trim(),
      city: city.trim(),
      date: date.trim(),
    };

    if (!payload.artist || !payload.venue || !payload.city || !payload.date) {
      Alert.alert(
        "Missing fields",
        "Artist, venue, city and date are required.",
      );
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
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: "800" }}>Add Gig</Text>

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

        <PrimaryButton
          title={loading ? "Saving..." : "Save"}
          onPress={submit}
          disabled={loading}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
