import React from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

import type { Gig } from "../shared/types/Gig";
import { Colours } from "../theme/colours";
import { parseYmdToUtcDate } from "../lib/date";

type Props = {
  gig: Gig | null;
  visible: boolean;
  onClose: () => void;
};

function getGigImageUrl(gig: Gig) {
  const candidate =
    (gig as any).artistImageUrl ??
    (gig as any).spotifyArtistImageUrl ??
    (gig as any).spotifyImageUrl ??
    (gig as any).imageUrl ??
    (gig as any).artist?.imageUrl ??
    (gig as any).artist?.images?.[0]?.url ??
    null;

  const value = String(candidate ?? "").trim();

  return value.length > 0 ? value : null;
}

function formatDate(value?: string) {
  const raw = String(value ?? "").trim();
  const date = parseYmdToUtcDate(raw);

  if (!date) {
    return {
      day: "",
      month: "",
      year: "",
      full: raw,
    };
  }

  return {
    day: String(date.getUTCDate()).padStart(2, "0"),

    month: date
      .toLocaleDateString("en-GB", {
        month: "short",
        timeZone: "UTC",
      })
      .toUpperCase(),

    year: String(date.getUTCFullYear()),

    full: date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

export function GigShareModal({
  gig,
  visible,
  onClose,
}: Props) {
  const cardRef = React.useRef<View>(null);

  const [sharing, setSharing] = React.useState(false);

  React.useEffect(() => {
    if (!visible) {
      setSharing(false);
    }
  }, [visible]);

  if (!gig) {
    return null;
  }

  const imageUrl = getGigImageUrl(gig);
  const hasArtistImage = Boolean(imageUrl);
  const date = formatDate(gig.date);

  const handleClose = () => {
    if (sharing) return;

    onClose();
  };

  const handleShare = async () => {
    if (!cardRef.current || sharing) {
      return;
    }

    setSharing(true);

    try {
      const available = await Sharing.isAvailableAsync();

      if (!available) {
        console.warn("Native sharing is not available on this device.");
        return;
      }

      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        width: 1080,
        height: 1920,
      });

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: `Share ${gig.artist}`,
        UTI: "public.png",
      });

      onClose();
    } catch (error) {
      console.error("Failed to share gig:", error);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          {/* Header - NOT part of exported image */}
          <View style={styles.header}>
            <Pressable
              onPress={handleClose}
              disabled={sharing}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close share preview"
              style={({ pressed }) => [
                styles.closeButton,
                pressed ? styles.closeButtonPressed : null,
                sharing ? styles.closeButtonDisabled : null,
              ]}
            >
              <Ionicons
                name="close"
                size={27}
                color={Colours.text.primary}
              />
            </Pressable>

            <Text style={styles.headerTitle}>
              Share gig
            </Text>

            <View style={styles.headerSpacer} />
          </View>

          {/* Centred preview area */}
          <View style={styles.previewArea}>
            <View style={styles.previewFrame}>
              <View
                ref={cardRef}
                collapsable={false}
                style={styles.storyCard}
              >
                {hasArtistImage ? (
                  <Image
                    source={{ uri: imageUrl as string }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.storyFallback}>
                    <View style={styles.fallbackGlowOuter} />
                    <View style={styles.fallbackGlowMiddle} />
                    <View style={styles.fallbackGlowInner} />
                  </View>
                )}

                <View
                  style={[
                    styles.overlay,
                    !hasArtistImage ? styles.fallbackOverlay : null,
                  ]}
                />

                {/* Coming up + date */}
                <View style={styles.storyTop}>
                  <Text style={styles.eyebrow}>
                    COMING UP
                  </Text>

                  <View style={styles.monthRow}>
                    <View style={styles.dateLine} />

                    <Text style={styles.storyMonth}>
                      {date.month}
                    </Text>

                    <View style={styles.dateLine} />
                  </View>

                  <Text style={styles.storyDay}>
                    {date.day}
                  </Text>

                  <View style={styles.yearDivider} />

                  <Text style={styles.storyYear}>
                    {date.year}
                  </Text>
                </View>

                {/* Main gig information */}
                <View style={styles.storyCentre}>
                  <Text
                    style={styles.artist}
                    numberOfLines={3}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {gig.artist}
                  </Text>

                  <Text
                    style={styles.location}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {gig.city || gig.venue}
                  </Text>
                </View>

                {/* Single WeGig logo block */}
                <View style={styles.brand}>
                  <Image
                    source={require("../../assets/wegig-logo.png")}
                    style={styles.brandLogo}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Footer - NOT part of exported image */}
          <View style={styles.footer}>
            <Pressable
              onPress={() => void handleShare()}
              disabled={sharing}
              accessibilityRole="button"
              accessibilityLabel="Share gig"
              style={({ pressed }) => [
                styles.shareButton,
                pressed ? styles.shareButtonPressed : null,
                sharing ? styles.shareButtonDisabled : null,
              ]}
            >
              {sharing ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color="#FFFFFF"
                  />

                  <Text style={styles.shareButtonText}>
                    Share
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colours.background.app,
  },

  screen: {
    flex: 1,
    backgroundColor: Colours.background.app,
  },

  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  closeButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.06)",
    opacity: 0.75,
  },

  closeButtonDisabled: {
    opacity: 0.4,
  },

  headerTitle: {
    color: Colours.text.primary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },

  headerSpacer: {
    width: 44,
    height: 44,
  },

  previewArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 16,
  },

  previewFrame: {
    width: "74%",
    maxWidth: 290,
    aspectRatio: 9 / 16,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: Colours.background.card,
  },

  storyCard: {
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#111111",
  },

  storyFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#081018",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  fallbackGlowOuter: {
    position: "absolute",
    width: "120%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: Colours.brand.primary,
    opacity: 0.035,
  },

  fallbackGlowMiddle: {
    position: "absolute",
    width: "82%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: Colours.brand.primary,
    opacity: 0.055,
  },

  fallbackGlowInner: {
    position: "absolute",
    width: "48%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: Colours.brand.primary,
    opacity: 0.07,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
  },

  fallbackOverlay: {
    backgroundColor: "rgba(0,0,0,0.08)",
  },

  storyTop: {
    position: "absolute",
    top: "8%",
    left: 20,
    right: 20,
    alignItems: "center",
  },

  eyebrow: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 2.1,
    textAlign: "center",
  },

  monthRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  dateLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colours.brand.primary,
  },

  storyMonth: {
    color: Colours.brand.primary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    letterSpacing: 1.2,
    textAlign: "center",
  },

  storyDay: {
    color: "#FFFFFF",
    fontSize: 42,
    lineHeight: 47,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center",
  },

  yearDivider: {
    width: 18,
    height: 2,
    borderRadius: 1,
    marginTop: 6,
    marginBottom: 7,
    backgroundColor: Colours.brand.primary,
  },

  storyYear: {
    color: Colours.brand.primary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
  },

  storyCentre: {
    position: "absolute",
    top: "43%",
    left: 18,
    right: 18,
    alignItems: "center",
  },

  artist: {
    width: "100%",
    color: "#FFFFFF",
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: -0.6,
    textAlign: "center",
  },

  location: {
    width: "100%",
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  fullDate: {
    marginTop: 5,
    color: "rgba(255,255,255,0.74)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  brand: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: "7%",
    alignItems: "center",
    justifyContent: "center",
  },

  brandLogo: {
    width: 108,
    height: 40,
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 18,
  },

  shareButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colours.brand.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  shareButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },

  shareButtonDisabled: {
    opacity: 0.65,
  },

  shareButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
});