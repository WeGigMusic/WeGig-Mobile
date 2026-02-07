// src/pages/EditGigScreen.tsx
import React from "react";
import { SafeAreaView, Alert, ScrollView, View, Text, ActivityIndicator } from "react-native";

import { AppHeader } from "../components/AppHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { StarRating } from "../components/StarRating";

import { apiPatch, apiDelete } from "../lib/api";
import { Colours } from "../theme/colours";
import type { Gig, CreateGigInput } from "../shared/types/Gig";

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

  const save = async () => {
    const payload: Partial<CreateGigInput> = {
      artist: artist.trim(),
      venue: venue.trim(),
      city: city.trim(),
      date: date.trim(),
      notes: notes.trim() || undefined,
      rating,
    };

    if (!payload.artist || !payload.venue || !payload.city || !payload.date) {
      Alert.alert("Missing fields", "Artist, venue, city and date are required.");
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
      <AppHeader title="Edit gig" onPressLogo={props.onPressLogo} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 26 }}>
        {/* Top card */}
        <View style={styles.card}>
          <Text style={styles.title}>Update details</Text>
          <Text style={styles.subtitle}>
            Edit the fields below. Tap a star to set rating (tap same star again to clear).
          </Text>
        </View>

        {/* Form card */}
        <View style={[styles.card, { gap: 12 }]}>
          <TextField label="Artist" value={artist} onChangeText={setArtist} />
          <TextField label="Venue" value={venue} onChangeText={setVenue} />
          <TextField label="City" value={city} onChangeText={setCity} />
          <TextField
            label="Date (YYYY-MM-DD)"
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
          />

          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Rating</Text>
            <StarRating value={rating} onChange={setRating} showLabel />
          </View>

          <TextField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <PrimaryButton
            title={loading ? "Saving…" : "Save changes"}
            onPress={save}
            disabled={loading}
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

        <Text style={[styles.muted, { textAlign: "center" }]}>
          Tip: if you imported this gig, you can still edit any field.
        </Text>
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
};