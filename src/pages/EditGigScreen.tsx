import React from "react";
import { SafeAreaView, Alert, ScrollView, View, Text } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { TextField } from "../components/TextField";
import { StarRating } from "../components/StarRating";
import { AppHeader } from "../components/AppHeader";
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
  const [rating, setRating] = React.useState<number | undefined>(
    props.gig.rating,
  );
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

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <TextField label="Artist" value={artist} onChangeText={setArtist} />
        <TextField label="Venue" value={venue} onChangeText={setVenue} />
        <TextField label="City" value={city} onChangeText={setCity} />
        <TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />

        <View style={{ gap: 8 }}>
          <Text style={{ color: Colours.text.secondary, fontWeight: "700" }}>
            Rating
          </Text>
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
          title="Delete gig"
          onPress={confirmDelete}
          style={{ backgroundColor: Colours.text.danger }}
          disabled={loading}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
