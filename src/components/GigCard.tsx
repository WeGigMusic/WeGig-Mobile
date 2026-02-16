import React from "react";
import { Pressable, Text, StyleSheet, View, Linking, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { Colours } from "../theme/colours";
import type { Gig } from "../shared/types/Gig";
import { apiGet } from "../lib/api";

type TmEventByIdResponse = {
  url?: string;
};

export function GigCard({
  gig,
  onPress,
  onPressArtist,
}: {
  gig: Gig;
  onPress?: () => void;
  onPressArtist?: (artist: string) => void;
}) {
  const handlePress = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
    onPress?.();
  };

const handlePressArtist = async (e?: any) => {
  if (!onPressArtist) return;
  try {
    e?.stopPropagation?.();
  } catch {}
  try {
    await Haptics.selectionAsync();
  } catch {}
  onPressArtist(gig.artist);
};

  const openTickets = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}

    const ticketUrl = (gig as any).ticketUrl as string | undefined;
    if (ticketUrl && ticketUrl.trim()) {
      try {
        await Linking.openURL(ticketUrl.trim());
        return;
      } catch {
        Alert.alert("Couldn’t open link", "That ticket link looks invalid.");
        return;
      }
    }

    const externalSource = (gig as any).externalSource as string | undefined;
    const externalId = (gig as any).externalId as string | undefined;

    if (externalSource === "Ticketmaster" && externalId) {
      try {
        const res = await apiGet<TmEventByIdResponse>(`/tm/events/${externalId}`);
        if (res?.url) {
          await Linking.openURL(res.url);
          return;
        }
        Alert.alert("No ticket link", "Ticketmaster didn’t return a ticket URL.");
        return;
      } catch (e: any) {
        Alert.alert("Tickets error", e?.message ?? "Couldn’t load tickets.");
        return;
      }
    }

    Alert.alert("No tickets", "No ticket link found for this gig yet.");
  };

  const hasTickets =
    Boolean(((gig as any).ticketUrl as string | undefined)?.trim()) ||
    ((gig as any).externalSource === "Ticketmaster" &&
      Boolean((gig as any).externalId));

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      {onPressArtist ? (
        <Pressable onPress={handlePressArtist} hitSlop={6} style={{ alignSelf: "flex-start" }}>
          <Text style={styles.artist}>{gig.artist}</Text>
        </Pressable>
      ) : (
        <Text style={styles.artist}>{gig.artist}</Text>
      )}

      <Text style={styles.meta}>
        {gig.venue} • {gig.city}
      </Text>

      <Text style={styles.date}>{gig.date}</Text>

      {typeof gig.rating === "number" ? (
        <Text style={styles.rating}>★ {gig.rating}/5</Text>
      ) : null}

      {gig.notes ? <Text style={styles.notes}>{gig.notes}</Text> : null}

      <View style={styles.actionsRow}>
        {hasTickets ? (
          <Pressable
            onPress={openTickets}
            style={({ pressed }) => [styles.smallBtn, pressed ? { opacity: 0.9 } : null]}
            hitSlop={8}
          >
            <Text style={styles.smallBtnText}>Tickets</Text>
          </Pressable>
        ) : (
          <View />
        )}

        <Text style={styles.editHint}>Tap card to edit</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },
  pressed: { opacity: 0.85 },
  artist: {
    color: Colours.text.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  meta: {
    marginTop: 4,
    color: Colours.text.secondary,
    fontWeight: "600",
  },
  date: {
    marginTop: 4,
    color: Colours.text.muted,
    fontWeight: "600",
  },
  rating: {
    marginTop: 10,
    color: Colours.text.primary,
    fontWeight: "800",
  },
  notes: {
    marginTop: 8,
    color: Colours.text.secondary,
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  smallBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  smallBtnText: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  editHint: {
    color: Colours.text.muted,
    fontWeight: "800",
    fontSize: 12,
  },
});
