import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Linking,
  Alert,
  Animated,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Colours } from "../theme/colours";
import type { Gig } from "../shared/types/Gig";
import { apiGet } from "../lib/api";
import { AvatarStack } from "./AvatarStack";
import { getGigSocialSignal } from "../lib/socialSignal";
import { parseYmdToUtcDate } from "../lib/date";

type TmEventByIdResponse = {
  url?: string;
};

type GigSetlistItem = {
  id: string;
  eventDate: string;
  venueName: string;
  cityName: string;
  countryCode: string | null;
  url: string | null;
  songCount: number;
  sets: Array<{
    name: string;
    encore: number;
    songs: string[];
  }>;
};

type GigSetlistMatchResponse = {
  matched: boolean;
  confidence: number;
  setlist: GigSetlistItem | null;
};

function formatGigDateUk(value?: string) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function isFutureGigDate(value?: string) {
  const d = parseYmdToUtcDate(String(value ?? "").trim());
  if (!d) return false;

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  return d.getTime() > todayUtc.getTime();
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function GigCard({
  gig,
  onPress,
  onPressArtist,
  isFirstGig,
  isFavouriteGig,
  showFirstGigAction = true,
  showFavouriteAction = true,
  onToggleFavourite,
  onToggleFirstGig,
}: {
  gig: Gig;
  onPress?: () => void;
  onPressArtist?: (artist: string) => void;
  isFirstGig?: boolean;
  isFavouriteGig?: boolean;
  showFirstGigAction?: boolean;
  showFavouriteAction?: boolean;
  onToggleFavourite?: () => void;
  onToggleFirstGig?: () => void;
}) {
  const favouriteScaleAnim = React.useRef(new Animated.Value(1)).current;
  const firstGigScaleAnim = React.useRef(new Animated.Value(1)).current;

  const [notesOpen, setNotesOpen] = React.useState(false);
  const [setlistOpen, setSetlistOpen] = React.useState(false);
  const [setlistLoading, setSetlistLoading] = React.useState(false);
  const [setlistMatch, setSetlistMatch] =
    React.useState<GigSetlistMatchResponse | null>(null);

  const noteText = String(gig.notes ?? "").trim();
  const hasNotes = noteText.length > 0;

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

  const handleOpenNotes = async (e?: any) => {
    try {
      e?.stopPropagation?.();
    } catch {}

    try {
      await Haptics.selectionAsync();
    } catch {}

    setNotesOpen(true);
  };

  const social = getGigSocialSignal(gig.id);
  const isFutureGig = isFutureGigDate(gig.date);
  const socialText = isFutureGig ? "Also going" : "Also went";

  const canLookupSetlist = React.useMemo(() => {
    return Boolean(
      !isFutureGig &&
        String(gig.artist ?? "").trim() &&
        String(gig.venue ?? "").trim() &&
        String(gig.city ?? "").trim() &&
        String(gig.date ?? "").trim(),
    );
  }, [gig.artist, gig.city, gig.date, gig.venue, isFutureGig]);

  React.useEffect(() => {
    if (!canLookupSetlist) {
      setSetlistMatch(null);
      return;
    }

    let cancelled = false;

    const loadSetlistMatch = async () => {
      setSetlistLoading(true);

      try {
        const qs = new URLSearchParams();
        qs.set("artist", String(gig.artist ?? "").trim());
        qs.set("date", String(gig.date ?? "").trim());
        qs.set("city", String(gig.city ?? "").trim());
        qs.set("venue", String(gig.venue ?? "").trim());

        const res = await apiGet<GigSetlistMatchResponse>(
          `/setlist/gig-match?${qs.toString()}`,
        );

        if (!cancelled) {
          setSetlistMatch(res);
        }
      } catch {
        if (!cancelled) {
          setSetlistMatch(null);
        }
      } finally {
        if (!cancelled) {
          setSetlistLoading(false);
        }
      }
    };

    void loadSetlistMatch();

    return () => {
      cancelled = true;
    };
  }, [canLookupSetlist, gig.artist, gig.city, gig.date, gig.venue]);

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

  const openSetlistUrl = async () => {
    const url = setlistMatch?.setlist?.url?.trim();
    if (!url) return;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Couldn’t open link", "That setlist link looks invalid.");
    }
  };

  const handleOpenSetlist = async (e?: any) => {
    try {
      e?.stopPropagation?.();
    } catch {}

    try {
      await Haptics.selectionAsync();
    } catch {}

    if (setlistMatch?.matched && setlistMatch.setlist) {
      setSetlistOpen(true);
      return;
    }

    if (setlistLoading) {
      return;
    }

    Alert.alert("No setlist yet", "No reliable setlist match was found for this gig.");
  };

  const hasTickets =
    Boolean(((gig as any).ticketUrl as string | undefined)?.trim()) ||
    ((gig as any).externalSource === "Ticketmaster" &&
      Boolean((gig as any).externalId));

  const hasSetlist = Boolean(setlistMatch?.matched && setlistMatch.setlist);
const showSetlistChip = canLookupSetlist && !setlistLoading && hasSetlist;
  const showFirstSelector = showFirstGigAction && !isFirstGig;
  const showFavouriteSelector = showFavouriteAction && !isFavouriteGig;
  const showSelectionActions = showFirstSelector || showFavouriteSelector;
  const showPinnedMarkers = Boolean(isFirstGig || isFavouriteGig);
  const hasRating = typeof gig.rating === "number";

  return (
    <>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      >
        <View style={styles.topRow}>
          <View style={styles.titleWrap}>
            {onPressArtist ? (
              <Pressable
                onPress={handlePressArtist}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.artistPressable,
                  pressed ? styles.artistPressablePressed : null,
                ]}
              >
                <Text style={styles.artist}>{gig.artist}</Text>
              </Pressable>
            ) : (
              <Text style={styles.artist}>{gig.artist}</Text>
            )}
          </View>

          <Pressable
            onPress={handlePress}
            hitSlop={8}
            style={({ pressed }) => [
              styles.editIconBtn,
              pressed ? { opacity: 0.8 } : null,
            ]}
          >
            <Ionicons
              name="create-outline"
              size={15}
              color={Colours.text.muted}
            />
          </Pressable>
        </View>

        <Text style={styles.meta}>
          {gig.venue} • {gig.city}
        </Text>

        <View style={styles.dateRatingRow}>
          <Text style={styles.date}>{formatGigDateUk(gig.date)}</Text>
          {hasRating ? (
            <Text style={styles.ratingInline}>★ {gig.rating}/5</Text>
          ) : null}
        </View>

        {showSelectionActions ? (
          <View style={styles.topActions}>
            {showFirstSelector ? (
              <Pressable
                onPress={handleToggleFirstGig}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.actionChip,
                  pressed ? styles.actionChipPressed : null,
                ]}
              >
                <Animated.View
                  style={[
                    styles.actionIconWrap,
                    { transform: [{ scale: firstGigScaleAnim }] },
                  ]}
                >
                  <Ionicons
                    name="ticket-outline"
                    size={16}
                    color={Colours.text.muted}
                  />
                </Animated.View>
                <Text style={styles.actionChipText}>First</Text>
              </Pressable>
            ) : null}

            {showFavouriteSelector ? (
              <Pressable
                onPress={handleToggleFavourite}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.actionChip,
                  pressed ? styles.actionChipPressed : null,
                ]}
              >
                <Animated.View
                  style={[
                    styles.actionIconWrap,
                    { transform: [{ scale: favouriteScaleAnim }] },
                  ]}
                >
                  <Ionicons
                    name="star-outline"
                    size={16}
                    color={Colours.text.muted}
                  />
                </Animated.View>
                <Text style={styles.actionChipText}>Fave</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.socialInline}>
          <AvatarStack avatars={social.avatars} extraCount={social.count} />
          <Text style={styles.socialInlineText}>{socialText}</Text>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            <View style={styles.footerActionsRow}>
              {hasTickets ? (
                <Pressable
                  onPress={openTickets}
                  style={({ pressed }) => [
                    styles.smallBtn,
                    pressed ? styles.smallBtnPressed : null,
                  ]}
                  hitSlop={8}
                >
                  <Text style={styles.smallBtnText}>Tickets</Text>
                </Pressable>
              ) : null}

              {hasNotes ? (
                <Pressable
                  onPress={handleOpenNotes}
                  style={({ pressed }) => [
                    styles.notesChip,
                    pressed ? styles.smallBtnPressed : null,
                  ]}
                  hitSlop={8}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={13}
                    color={Colours.text.primary}
                  />
                  <Text style={styles.smallBtnText}>Notes</Text>
                </Pressable>
              ) : null}

              {showSetlistChip ? (
  <Pressable
    onPress={handleOpenSetlist}
    style={({ pressed }) => [
      styles.setlistChip,
      pressed ? styles.smallBtnPressed : null,
    ]}
    hitSlop={8}
  >
    <Ionicons
      name="musical-notes-outline"
      size={13}
      color={Colours.text.primary}
    />
    <Text style={styles.smallBtnText}>Setlist</Text>
  </Pressable>
) : null}
            </View>
          </View>

          {showPinnedMarkers ? (
            <View style={styles.markerRow}>
              {isFirstGig ? (
                <Pressable
                  onPress={handleToggleFirstGig}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.markerBtn,
                    styles.firstMarkerBtn,
                    pressed ? { opacity: 0.82 } : null,
                  ]}
                >
                  <Animated.View
                    style={{ transform: [{ scale: firstGigScaleAnim }] }}
                  >
                    <Ionicons name="ticket" size={12} color="#7EB6FF" />
                  </Animated.View>
                </Pressable>
              ) : null}

              {isFavouriteGig ? (
                <Pressable
                  onPress={handleToggleFavourite}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.markerBtn,
                    styles.favouriteMarkerBtn,
                    pressed ? { opacity: 0.82 } : null,
                  ]}
                >
                  <Animated.View
                    style={{ transform: [{ scale: favouriteScaleAnim }] }}
                  >
                    <Ionicons name="star" size={11} color="#FFD166" />
                  </Animated.View>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>

      <Modal
        visible={notesOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotesOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setNotesOpen(false)}
        >
          <Pressable
            style={styles.notesModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.notesModalTitle}>Notes</Text>
            <Text style={styles.notesModalBody}>{noteText}</Text>

            <Pressable
              onPress={() => setNotesOpen(false)}
              style={({ pressed }) => [
                styles.notesCloseBtn,
                pressed ? styles.smallBtnPressed : null,
              ]}
            >
              <Text style={styles.smallBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={setlistOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSetlistOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSetlistOpen(false)}
        >
          <Pressable
            style={styles.setlistModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.notesModalTitle}>Setlist</Text>

            {setlistMatch?.setlist ? (
              <>
                <Text style={styles.setlistModalMetaTitle}>
                  {setlistMatch.setlist.venueName}
                </Text>

                <Text style={styles.setlistModalMetaText}>
                  {setlistMatch.setlist.cityName} • {setlistMatch.setlist.eventDate}
                </Text>

                <Text style={styles.setlistModalMetaText}>
                  Confidence {formatConfidence(setlistMatch.confidence)} •{" "}
                  {setlistMatch.setlist.songCount} songs
                </Text>

                <ScrollView
                  style={{ maxHeight: 320, marginTop: 14 }}
                  showsVerticalScrollIndicator={false}
                >
                  {setlistMatch.setlist.sets.map((set, setIndex) => (
                    <View
                      key={`${set.name}-${setIndex}`}
                      style={styles.setBlock}
                    >
                      <Text style={styles.setBlockTitle}>
                        {set.name || (set.encore > 0 ? `Encore ${set.encore}` : "Set")}
                      </Text>

                      <View style={{ height: 8 }} />

                      {set.songs.length > 0 ? (
                        set.songs.map((song, songIndex) => (
                          <Text
                            key={`${song}-${songIndex}`}
                            style={styles.songRow}
                          >
                            {songIndex + 1}. {song}
                          </Text>
                        ))
                      ) : (
                        <Text style={styles.notesModalBody}>No songs listed.</Text>
                      )}
                    </View>
                  ))}
                </ScrollView>

                <View style={{ gap: 8, marginTop: 14 }}>
                  {setlistMatch.setlist.url ? (
                    <Pressable
                      onPress={() => void openSetlistUrl()}
                      style={({ pressed }) => [
                        styles.notesCloseBtn,
                        styles.openSetlistBtn,
                        pressed ? styles.smallBtnPressed : null,
                      ]}
                    >
                      <Text style={styles.smallBtnText}>Open on Setlist.fm</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => setSetlistOpen(false)}
                    style={({ pressed }) => [
                      styles.notesCloseBtn,
                      pressed ? styles.smallBtnPressed : null,
                    ]}
                  >
                    <Text style={styles.smallBtnText}>Close</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.notesModalBody}>
                  No matched setlist available.
                </Text>

                <Pressable
                  onPress={() => setSetlistOpen(false)}
                  style={({ pressed }) => [
                    styles.notesCloseBtn,
                    pressed ? styles.smallBtnPressed : null,
                  ]}
                >
                  <Text style={styles.smallBtnText}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },

  pressed: {
    opacity: 0.92,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  titleWrap: {
    flex: 1,
    paddingRight: 10,
  },

  artistPressable: {
    alignSelf: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.14)",
    paddingBottom: 1,
  },

  artistPressablePressed: {
    opacity: 0.78,
  },

  artist: {
    color: Colours.text.primary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },

  editIconBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  meta: {
    marginTop: 4,
    color: Colours.text.secondary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },

  dateRatingRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  date: {
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },

  ratingInline: {
    color: Colours.text.primary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },

  topActions: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  actionChip: {
    minWidth: 52,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  actionChipPressed: {
    opacity: 0.85,
  },

  actionIconWrap: {
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  actionChipText: {
    marginTop: 3,
    color: Colours.text.muted,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    letterSpacing: 0.1,
  },

  socialInline: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  socialInlineText: {
    flex: 1,
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 11,
    lineHeight: 14,
  },

  footerRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  footerLeft: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
  },

  footerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  markerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 10,
  },

  markerBtn: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  firstMarkerBtn: {
    backgroundColor: "rgba(47,140,255,0.10)",
    borderColor: "rgba(47,140,255,0.28)",
  },

  favouriteMarkerBtn: {
    backgroundColor: "rgba(255,209,102,0.10)",
    borderColor: "rgba(255,209,102,0.28)",
  },

  smallBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
  },

  notesChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
  },

  setlistChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(46,229,157,0.10)",
    borderWidth: 1,
    borderColor: "rgba(46,229,157,0.28)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
  },

  setlistChipMuted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
  },

  smallBtnPressed: {
    opacity: 0.9,
  },

  smallBtnText: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  notesModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 16,
  },

  setlistModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 16,
    maxHeight: "82%",
  },

  notesModalTitle: {
    color: Colours.text.primary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },

  notesModalBody: {
    marginTop: 10,
    color: Colours.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },

  notesCloseBtn: {
    alignSelf: "flex-start",
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
  },

  openSetlistBtn: {
    marginTop: 0,
  },

  setlistModalMetaTitle: {
    marginTop: 10,
    color: Colours.text.primary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },

  setlistModalMetaText: {
    marginTop: 4,
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  setBlock: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  setBlockTitle: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 17,
  },

  songRow: {
    color: Colours.text.secondary,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
});