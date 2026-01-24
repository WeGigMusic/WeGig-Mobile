import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { apiPost } from "../lib/api";
import type { Gig, CreateGigInput } from "../types/gig";

const inputStyle = {
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.15)",
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 16,
} as const;

export function AddGigScreen(props: {
  onCreated?: (gig: Gig) => void;
  prefill?: Partial<CreateGigInput> | null;
  onPrefillUsed?: () => void;
}) {
  const [artist, setArtist] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [city, setCity] = React.useState("");
  const [date, setDate] = React.useState(""); // YYYY-MM-DD
  const [rating, setRating] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Optional import fields
  const [externalSource, setExternalSource] = React.useState<string | undefined>(
    undefined,
  );
  const [externalId, setExternalId] = React.useState<string | undefined>(
    undefined,
  );
  const [artistMbid, setArtistMbid] = React.useState<string | undefined>(
    undefined,
  );
  const [ticketUrl, setTicketUrl] = React.useState<string | undefined>(
    undefined,
  );

  React.useEffect(() => {
    if (!props.prefill) return;

    if (props.prefill.artist != null) setArtist(String(props.prefill.artist));
    if (props.prefill.venue != null) setVenue(String(props.prefill.venue));
    if (props.prefill.city != null) setCity(String(props.prefill.city));
    if (props.prefill.date != null) setDate(String(props.prefill.date));
    if (props.prefill.notes != null) setNotes(String(props.prefill.notes));

    if (props.prefill.rating != null)
      setRating(String(props.prefill.rating ?? ""));

    // import metadata
    if (props.prefill.externalSource != null)
      setExternalSource(String(props.prefill.externalSource));
    if (props.prefill.externalId != null)
      setExternalId(String(props.prefill.externalId));
    if (props.prefill.artistMbid != null)
      setArtistMbid(String(props.prefill.artistMbid));
    if (props.prefill.ticketUrl != null)
      setTicketUrl(String(props.prefill.ticketUrl));

    props.onPrefillUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.prefill]);

  const onSave = async () => {
    const payload: CreateGigInput = {
      artist: artist.trim(),
      venue: venue.trim(),
      city: city.trim(),
      date: date.trim(),
      rating: rating.trim() ? Number(rating.trim()) : undefined,
      notes: notes.trim() ? notes.trim() : undefined,
      externalSource: externalSource?.trim() || undefined,
      externalId: externalId?.trim() || undefined,
      artistMbid: artistMbid?.trim() || undefined,
      ticketUrl: ticketUrl?.trim() || undefined,
    };

    if (!payload.artist || !payload.venue || !payload.city || !payload.date) {
      Alert.alert("Missing info", "Artist, venue, city, and date are required.");
      return;
    }

    setSaving(true);
    try {
      const created = await apiPost<Gig>("/gigs", payload);
      Alert.alert("Saved", "Gig added!");
      setArtist("");
      setVenue("");
      setCity("");
      setDate("");
      setRating("");
      setNotes("");
      setExternalSource(undefined);
      setExternalId(undefined);
      setArtistMbid(undefined);
      setTicketUrl(undefined);
      props.onCreated?.(created);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save gig");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: "700" }}>Add Gig</Text>

          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: "600" }}>Artist</Text>
            <TextInput
              value={artist}
              onChangeText={setArtist}
              placeholder="e.g. Arctic Monkeys"
              autoCapitalize="words"
              style={inputStyle}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: "600" }}>Venue</Text>
            <TextInput
              value={venue}
              onChangeText={setVenue}
              placeholder="e.g. O2 Academy Brixton"
              autoCapitalize="words"
              style={inputStyle}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: "600" }}>City</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="e.g. London"
              autoCapitalize="words"
              style={inputStyle}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: "600" }}>Date (YYYY-MM-DD)</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="2026-01-24"
              autoCapitalize="none"
              style={inputStyle}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: "600" }}>Rating (1–5, optional)</Text>
            <TextInput
              value={rating}
              onChangeText={setRating}
              placeholder="5"
              keyboardType="number-pad"
              style={inputStyle}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: "600" }}>Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any notes..."
              multiline
              style={[inputStyle, { minHeight: 90, textAlignVertical: "top" }]}
            />
          </View>

          <Pressable
            onPress={onSave}
            disabled={saving}
            style={{
              backgroundColor: saving ? "rgba(0,0,0,0.4)" : "black",
              padding: 14,
              borderRadius: 14,
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
              {saving ? "Saving..." : "Save Gig"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
