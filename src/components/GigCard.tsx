import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Modal,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { Colours } from "../theme/colours";
import type { Gig } from "../shared/types/Gig";
import { parseYmdToUtcDate } from "../lib/date";

type GigCardVariant =
  | "row"
  | "poster";

const HAPTICS_KEY =
  "wegig.hapticsEnabled";

async function hapticsAllowed() {
  try {
    const value =
      await AsyncStorage.getItem(
        HAPTICS_KEY,
      );

    return (
      value == null ||
      value === "1"
    );
  } catch {
    return true;
  }
}

async function selectionHaptic() {
  if (
    !(await hapticsAllowed())
  ) {
    return;
  }

  try {
    await Haptics.selectionAsync();
  } catch {}
}

function formatGigDateUk(
  value?: string,
) {
  const raw =
    String(
      value ?? "",
    ).trim();

  const match =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})$/,
    );

  if (!match) {
    return raw;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function formatPosterDate(
  value?: string,
) {
  const raw =
    String(
      value ?? "",
    ).trim();

  const d =
    parseYmdToUtcDate(raw);

  if (!d) {
    return {
      day: "--",
      month: "---",
      label:
        formatGigDateUk(
          raw,
        ),
    };
  }

  return {
    day: String(
      d.getUTCDate(),
    ).padStart(
      2,
      "0",
    ),

    month: d
      .toLocaleDateString(
        "en-GB",
        {
          month: "short",
          timeZone: "UTC",
        },
      )
      .toUpperCase(),

    label:
      d.toLocaleDateString(
        "en-GB",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        },
      ),
  };
}

function RatingStars({
  value,
}: {
  value: number;
}) {
  const scale =
    React.useRef(
      new Animated.Value(1),
    ).current;

  const fullStars =
    Math.floor(value);

  const hasHalfStar =
    value % 1 >= 0.25 &&
    value % 1 < 0.75;

  const roundedStars =
    value % 1 >= 0.75
      ? fullStars + 1
      : fullStars;

  const animate = () => {
    Animated.sequence([
      Animated.spring(
        scale,
        {
          toValue: 1.12,
          useNativeDriver:
            true,
          speed: 22,
          bounciness: 8,
        },
      ),

      Animated.spring(
        scale,
        {
          toValue: 1,
          useNativeDriver:
            true,
          speed: 20,
          bounciness: 6,
        },
      ),
    ]).start();
  };

  return (
    <Pressable
      onPress={animate}
      hitSlop={8}
    >
      <Animated.View
        style={[
          styles.ratingStars,
          {
            transform: [
              {
                scale,
              },
            ],
          },
        ]}
      >
        {Array.from({
          length: 5,
        }).map(
          (_, i) => {
            const icon =
              i <
              fullStars
                ? "star"
                : i ===
                      fullStars &&
                    hasHalfStar
                  ? "star-half"
                  : i <
                      roundedStars
                    ? "star"
                    : "star-outline";

            return (
              <Ionicons
                key={i}
                name={icon}
                size={14}
                color="#FFD166"
              />
            );
          },
        )}
      </Animated.View>
    </Pressable>
  );
}

function getGigImageUrl(
  gig: Gig,
) {
  const candidate =
    (gig as any)
      .artistImageUrl ??
    (gig as any)
      .spotifyArtistImageUrl ??
    (gig as any)
      .spotifyImageUrl ??
    (gig as any)
      .imageUrl ??
    (gig as any).artist
      ?.imageUrl ??
    (gig as any).artist
      ?.images?.[0]
      ?.url ??
    null;

  const value =
    String(
      candidate ?? "",
    ).trim();

  return value.length > 0
    ? value
    : null;
}

export function GigCard({
  gig,
  onPress,
  onPressArtist,
  onShare,
  isFavouriteGig,
  variant = "row",
}: {
  gig: Gig;
  onPress?: () => void;
  onPressArtist?: (
    artist: string,
  ) => void;
  onShare?: (
    gig: Gig,
  ) => void;
  isFavouriteGig?: boolean;
  variant?: GigCardVariant;
}) {
  const [
    notesOpen,
    setNotesOpen,
  ] =
    React.useState(false);

  const noteText =
    String(
      gig.notes ?? "",
    ).trim();

  const hasNotes =
    noteText.length > 0;

  const imageUrl =
    getGigImageUrl(gig);

  const hasRating =
    typeof gig.rating ===
    "number";

  const posterDate =
    formatPosterDate(
      gig.date,
    );

  const handlePress = () => {
    void selectionHaptic();
    onPress?.();
  };

  const handlePressArtist = (
    e?: any,
  ) => {
    if (!onPressArtist) {
      return;
    }

    try {
      e?.stopPropagation?.();
    } catch {}

    void selectionHaptic();

    onPressArtist(
      gig.artist,
    );
  };

  const handleShare = (
    e?: any,
  ) => {
    try {
      e?.stopPropagation?.();
    } catch {}

    void selectionHaptic();

    onShare?.(gig);
  };

  const handleOpenNotes = (
    e?: any,
  ) => {
    try {
      e?.stopPropagation?.();
    } catch {}

    void selectionHaptic();

    setNotesOpen(true);
  };

  const renderFallbackImage = (
    style: any,
  ) => (
    <View
      style={[
        style,
        styles.imageFallback,
      ]}
    >
      <Image
        source={require("../../assets/logo-symbol.png")}
        style={
          styles.fallbackLogo
        }
        contentFit="cover"
      />
    </View>
  );

  const modalContent = (
    <Modal
      visible={notesOpen}
      transparent
      animationType="fade"
      onRequestClose={() =>
        setNotesOpen(
          false,
        )
      }
    >
      <Pressable
        style={
          styles.modalOverlay
        }
        onPress={() =>
          setNotesOpen(
            false,
          )
        }
      >
        <Pressable
          style={
            styles.notesModalCard
          }
          onPress={(e) =>
            e.stopPropagation()
          }
        >
          <Text
            style={
              styles.notesModalTitle
            }
          >
            Notes
          </Text>

          <Text
            style={
              styles.notesModalBody
            }
          >
            {noteText}
          </Text>

          <Pressable
            onPress={() =>
              setNotesOpen(
                false,
              )
            }
            style={({
              pressed,
            }) => [
              styles.notesCloseBtn,
              pressed
                ? styles.smallBtnPressed
                : null,
            ]}
          >
            <Text
              style={
                styles.smallBtnText
              }
            >
              Close
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (
    variant === "poster"
  ) {
    return (
      <>
        <Pressable
          onPress={handlePress}
          style={({
            pressed,
          }) => [
            styles.posterCard,
            isFavouriteGig
              ? styles.favouriteGigCard
              : null,
            pressed
              ? styles.pressed
              : null,
          ]}
        >
          <View
            style={
              styles.posterImageWrap
            }
          >
            {imageUrl ? (
              <Image
                source={imageUrl}
                style={
                  styles.posterImage
                }
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
            ) : (
              renderFallbackImage(
                styles.posterImage,
              )
            )}

            <View
              style={
                styles.posterGradient
              }
            />

            <View
              style={
                styles.posterDatePill
              }
            >
              <Text
                style={
                  styles.posterMonth
                }
              >
                {
                  posterDate.month
                }
              </Text>

              <Text
                style={
                  styles.posterDay
                }
              >
                {
                  posterDate.day
                }
              </Text>
            </View>

            {onShare ? (
              <Pressable
                onPress={
                  handleShare
                }
                hitSlop={8}
                style={({
                  pressed,
                }) => [
                  styles.posterShare,
                  pressed
                    ? styles.posterSharePressed
                    : null,
                ]}
              >
                <Ionicons
                  name="share-outline"
                  size={17}
                  color="#FFFFFF"
                />
              </Pressable>
            ) : null}

            {isFavouriteGig ? (
              <View
                style={
                  styles.posterFavourite
                }
              >
                <Ionicons
                  name="star"
                  size={13}
                  color="#FFD166"
                />
              </View>
            ) : null}

            <View
              style={
                styles.posterTextWrap
              }
            >
              <Text
                style={
                  styles.posterArtist
                }
                numberOfLines={2}
              >
                {
                  gig.artist
                }
              </Text>

              <Text
                style={
                  styles.posterMeta
                }
                numberOfLines={1}
              >
                {gig.city ||
                  gig.venue}
              </Text>

              <Text
                style={
                  styles.posterDateText
                }
              >
                {
                  posterDate.label
                }
              </Text>
            </View>
          </View>
        </Pressable>

        {modalContent}
      </>
    );
  }

  return (
    <>
      <Pressable
        onPress={handlePress}
        style={({
          pressed,
        }) => [
          styles.rowCard,
          isFavouriteGig
            ? styles.favouriteGigCard
            : null,
          pressed
            ? styles.pressed
            : null,
        ]}
      >
        {imageUrl ? (
          <Image
            source={imageUrl}
            style={
              styles.rowImage
            }
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
          />
        ) : (
          renderFallbackImage(
            styles.rowImage,
          )
        )}

        <View
          style={
            styles.rowBody
          }
        >
          <View
            style={
              styles.topRow
            }
          >
            <View
              style={
                styles.titleWrap
              }
            >
              {onPressArtist ? (
                <Pressable
                  onPress={
                    handlePressArtist
                  }
                  hitSlop={6}
                  style={({
                    pressed,
                  }) => [
                    styles.artistPressable,
                    pressed
                      ? styles.artistPressablePressed
                      : null,
                  ]}
                >
                  <View
                    style={
                      styles.artistRow
                    }
                  >
                    <Text
                      style={
                        styles.artist
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {
                        gig.artist
                      }
                    </Text>

                    {isFavouriteGig ? (
                      <Ionicons
                        name="star"
                        size={13}
                        color="#FFD166"
                      />
                    ) : null}
                  </View>
                </Pressable>
              ) : (
                <View
                  style={
                    styles.artistRow
                  }
                >
                  <Text
                    style={
                      styles.artist
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {
                      gig.artist
                    }
                  </Text>

                  {isFavouriteGig ? (
                    <Ionicons
                      name="star"
                      size={13}
                      color="#FFD166"
                    />
                  ) : null}
                </View>
              )}
            </View>

            <View
              style={
                styles.topRightActions
              }
            >
              {hasNotes ? (
                <Pressable
                  onPress={
                    handleOpenNotes
                  }
                  hitSlop={8}
                  style={({
                    pressed,
                  }) => [
                    styles.topIconBtn,
                    pressed
                      ? styles.topIconBtnPressed
                      : null,
                  ]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={13}
                    color="rgba(255,255,255,0.54)"
                  />
                </Pressable>
              ) : null}

              <Pressable
                onPress={
                  handlePress
                }
                hitSlop={8}
                style={({
                  pressed,
                }) => [
                  styles.topIconBtn,
                  pressed
                    ? styles.topIconBtnPressed
                    : null,
                ]}
              >
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color="rgba(255,255,255,0.44)"
                />
              </Pressable>
            </View>
          </View>

          <Text
            style={
              styles.meta
            }
            numberOfLines={1}
          >
            {gig.venue} •{" "}
            {gig.city}
          </Text>

          <View
            style={
              styles.dateRatingRow
            }
          >
            <Text
              style={
                styles.date
              }
            >
              {formatGigDateUk(
                gig.date,
              )}
            </Text>

            {hasRating ? (
              <RatingStars
                value={
                  gig.rating as number
                }
              />
            ) : null}
          </View>
        </View>
      </Pressable>

      {modalContent}
    </>
  );
}

const styles =
  StyleSheet.create({
    rowCard: {
      flexDirection: "row",
      gap: 12,
      backgroundColor:
        Colours.background.card,
      borderRadius: 16,
      padding: 10,
      borderWidth: 0,
    },

    ratingStars: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },

    fallbackLogo: {
      width: "100%",
      height: "100%",
      opacity: 0.95,
    },

    favouriteGigCard: {
      borderWidth: 0,
      backgroundColor:
        Colours.background.card,
    },

    pressed: {
      opacity: 0.92,
    },

    rowImage: {
      width: 68,
      height: 68,
      borderRadius: 14,
      overflow: "hidden",
    },

    imageFallback: {
      backgroundColor:
        "rgba(47,140,255,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },

    rowBody: {
      flex: 1,
      minWidth: 0,
    },

    topRow: {
      flexDirection: "row",
      alignItems:
        "flex-start",
    },

    titleWrap: {
      flex: 1,
      paddingRight: 10,
      minWidth: 0,
    },

    artistPressable: {
      alignSelf:
        "flex-start",
      paddingBottom: 1,
      maxWidth: "100%",
    },

    artistPressablePressed: {
      opacity: 0.78,
    },

    artistRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      maxWidth: "100%",
    },

    artist: {
      color:
        Colours.text.primary,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "800",
      flexShrink: 1,
    },

    topRightActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: -1,
    },

    topIconBtn: {
      width: 22,
      height: 22,
      alignItems: "center",
      justifyContent:
        "center",
    },

    topIconBtnPressed: {
      opacity: 0.8,
    },

    meta: {
      marginTop: 3,
      color:
        Colours.text.secondary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "600",
    },

    dateRatingRow: {
      marginTop: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 10,
    },

    date: {
      color:
        Colours.text.muted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "500",
    },

    posterCard: {
      width: 150,
      height: 190,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor:
        Colours.background.card,
    },

    posterImageWrap: {
      flex: 1,
      position: "relative",
      overflow: "hidden",
    },

    posterImage: {
      width: "100%",
      height: "100%",
    },

    posterGradient: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor:
        "rgba(0,0,0,0.22)",
    },

    posterDatePill: {
      position: "absolute",
      left: 10,
      top: 10,
      width: 48,
      height: 58,
      alignItems: "center",
      justifyContent:
        "center",
    },

    posterMonth: {
      color:
        Colours.text.secondary,
      fontWeight: "900",
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: 0.8,
    },

    posterDay: {
      color:
        Colours.text.primary,
      fontWeight: "900",
      fontSize: 24,
      lineHeight: 27,
    },

    posterShare: {
      position: "absolute",
      right: 10,
      top: 10,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor:
        "rgba(0,0,0,0.42)",
      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.10)",
      alignItems: "center",
      justifyContent:
        "center",
    },

    posterSharePressed: {
      opacity: 0.72,
      transform: [
        {
          scale: 0.96,
        },
      ],
    },

    posterFavourite: {
      position: "absolute",
      right: 12,
      top: 48,
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent:
        "center",
    },

    posterTextWrap: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 12,
    },

    posterArtist: {
      color:
        Colours.text.primary,
      fontWeight: "900",
      fontSize: 20,
      lineHeight: 23,
      letterSpacing: -0.2,
    },

    posterMeta: {
      marginTop: 5,
      color:
        Colours.text.secondary,
      fontWeight: "700",
      fontSize: 12,
      lineHeight: 15,
    },

    posterDateText: {
      marginTop: 2,
      color:
        Colours.text.muted,
      fontWeight: "700",
      fontSize: 11,
      lineHeight: 14,
    },

    smallBtnPressed: {
      opacity: 0.9,
    },

    smallBtnText: {
      color:
        Colours.text.secondary,
      fontWeight: "600",
      fontSize: 11,
      lineHeight: 14,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor:
        "rgba(0,0,0,0.7)",
      alignItems: "center",
      justifyContent:
        "center",
      paddingHorizontal: 20,
    },

    notesModalCard: {
      width: "100%",
      maxWidth: 360,
      backgroundColor:
        Colours.background.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        Colours.ui.border,
      padding: 16,
    },

    notesModalTitle: {
      color:
        Colours.text.primary,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "700",
    },

    notesModalBody: {
      marginTop: 10,
      color:
        Colours.text.secondary,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "400",
    },

    notesCloseBtn: {
      alignSelf:
        "flex-start",
      marginTop: 14,
      backgroundColor:
        "rgba(255,255,255,0.08)",
      borderWidth: 1,
      borderColor:
        Colours.ui.border,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
  });