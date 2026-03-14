import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Linking,
  Alert,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Colours } from "../theme/colours";
import type { Gig } from "../shared/types/Gig";
import { apiGet } from "../lib/api";
import { AvatarStack } from "./AvatarStack";
import { getGigSocialSignal } from "../lib/socialSignal";

type TmEventByIdResponse = {
  url?: string;
};

export function GigCard({
  gig,
  onPress,
  onPressArtist,
  isFirstGig,
  isFavouriteGig,
  onToggleFavourite,
  onToggleFirstGig,
}: {
  gig: Gig;
  onPress?: () => void;
  onPressArtist?: (artist: string) => void;
  isFirstGig?: boolean;
  isFavouriteGig?: boolean;
  onToggleFavourite?: () => void;
  onToggleFirstGig?: () => void;
}) {
  const favouriteScaleAnim = React.useRef(new Animated.Value(1)).current;
  const firstGigScaleAnim = React.useRef(new Animated.Value(1)).current;

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

  const handleToggleFavourite = async (e?: any) => {
    try {
      e?.stopPropagation?.();
    } catch {}

    try {
      await Haptics.selectionAsync();
    } catch {}

    Animated.sequence([
      Animated.spring(favouriteScaleAnim, {
        toValue: 1.35,
        useNativeDriver: true,
      }),
      Animated.spring(favouriteScaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    onToggleFavourite?.();
  };

  const handleToggleFirstGig = async (e?: any) => {
    try {
      e?.stopPropagation?.();
    } catch {}

    try {
      await Haptics.selectionAsync();
    } catch {}

    Animated.sequence([
      Animated.spring(firstGigScaleAnim, {
        toValue: 1.3,
        useNativeDriver: true,
      }),
      Animated.spring(firstGigScaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    onToggleFirstGig?.();
  };

  const social = getGigSocialSignal(gig.id);

  const openTickets = async (e?: any) => {
    try {
      e?.stopPropagation?.();
    } catch {}

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
      <View style={styles.topRow}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          {onPressArtist ? (
            <Pressable
              onPress={handlePressArtist}
              hitSlop={6}
              style={{ alignSelf: "flex-start" }}
            >
              <Text style={styles.artist}>{gig.artist}</Text>
            </Pressable>
          ) : (
            <Text style={styles.artist}>{gig.artist}</Text>
          )}
        </View>

        <View style={styles.topActions}>
          <Pressable
            onPress={handleToggleFirstGig}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed ? { opacity: 0.82 } : null,
              isFirstGig ? styles.firstGigBtnActive : null,
            ]}
          >
            <Animated.View style={{ transform: [{ scale: firstGigScaleAnim }] }}>
              <Ionicons
                name={isFirstGig ? "flag" : "flag-outline"}
                size={17}
                color={isFirstGig ? "#2F8CFF" : Colours.text.muted}
              />
            </Animated.View>
          </Pressable>

          <Pressable
            onPress={handleToggleFavourite}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed ? { opacity: 0.82 } : null,
              isFavouriteGig ? styles.favouriteBtnActive : null,
            ]}
          >
            <Animated.View style={{ transform: [{ scale: favouriteScaleAnim }] }}>
              <Ionicons
                name={isFavouriteGig ? "star" : "star-outline"}
                size={18}
                color={isFavouriteGig ? "#FFD166" : Colours.text.muted}
              />
            </Animated.View>
          </Pressable>
        </View>
      </View>

      <Text style={styles.meta}>
        {gig.venue} • {gig.city}
      </Text>

      <Text style={styles.date}>{gig.date}</Text>

      {isFirstGig || isFavouriteGig ? (
        <View style={styles.tagRow}>
          {isFirstGig ? (
            <View style={[styles.tag, styles.firstGigTag]}>
              <Text style={styles.tagText}>First gig</Text>
            </View>
          ) : null}

          {isFavouriteGig ? (
            <View style={[styles.tag, styles.favouriteTag]}>
              <Text style={styles.tagText}>Favourite</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {typeof gig.rating === "number" ? (
        <Text style={styles.rating}>★ {gig.rating}/5</Text>
      ) : null}

      {gig.notes ? <Text style={styles.notes}>{gig.notes}</Text> : null}

      <View style={styles.socialBlock}>
        <AvatarStack avatars={social.avatars} extraCount={social.count} />
        <Text style={styles.socialCaption}>Fans on WeGig also went</Text>
      </View>

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

        <Text style={styles.editHint}>Edit</Text>
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
  pressed: {
    opacity: 0.85,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  artist: {
    color: Colours.text.primary,
    fontSize: 16,
    fontWeight: "900",
  },

  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  firstGigBtnActive: {
    backgroundColor: "rgba(47,140,255,0.10)",
    borderColor: "rgba(47,140,255,0.28)",
  },

  favouriteBtnActive: {
    backgroundColor: "rgba(255,209,102,0.10)",
    borderColor: "rgba(255,209,102,0.28)",
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

  tagRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },

  tag: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },

  firstGigTag: {
    backgroundColor: "rgba(47,140,255,0.14)",
    borderColor: "rgba(47,140,255,0.35)",
  },

  favouriteTag: {
    backgroundColor: "rgba(138,91,255,0.14)",
    borderColor: "rgba(138,91,255,0.35)",
  },

  tagText: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.2,
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

  socialBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  socialCaption: {
    marginTop: 8,
    color: Colours.text.muted,
    fontWeight: "800",
    fontSize: 12,
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