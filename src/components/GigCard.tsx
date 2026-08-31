import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Linking,
  Alert,
  Modal,
  ScrollView,
  Image,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { Colours } from "../theme/colours";
import type { Gig } from "../shared/types/Gig";
import { apiGet } from "../lib/api";
import { parseYmdToUtcDate } from "../lib/date";

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
  if (!(await hapticsAllowed())) {
    return;
  }

  try {
    await Haptics.selectionAsync();
  } catch {}
}

function formatGigDateUk(
  value?: string,
) {
  const raw = String(
    value ?? "",
  ).trim();

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );

  if (!match) return raw;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function formatPosterDate(
  value?: string,
) {
  const raw = String(
    value ?? "",
  ).trim();

  const d =
    parseYmdToUtcDate(raw);

  if (!d) {
    return {
      day: "--",
      month: "---",
      label:
        formatGigDateUk(raw),
    };
  }

  return {
    day: String(
      d.getUTCDate(),
    ).padStart(2, "0"),

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

function isFutureGigDate(
  value?: string,
) {
  const d =
    parseYmdToUtcDate(
      String(
        value ?? "",
      ).trim(),
    );

  if (!d) return false;

  const today = new Date();

  const todayUtc = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  );

  return (
    d.getTime() >
    todayUtc.getTime()
  );
}

function formatConfidence(
  value: number,
) {
  return `${Math.round(
    value * 100,
  )}%`;
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
      Animated.spring(scale, {
        toValue: 1.12,
        useNativeDriver: true,
        speed: 22,
        bounciness: 8,
      }),

      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 6,
      }),
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
        }).map((_, i) => {
          const icon =
            i < fullStars
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
        })}
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
    (gig as any).imageUrl ??
    (gig as any).artist
      ?.imageUrl ??
    (gig as any).artist
      ?.images?.[0]?.url ??
    null;

  const value = String(
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
  onShare?: (gig: Gig) => void;
  isFavouriteGig?: boolean;
  variant?: GigCardVariant;
}) {
  const [
    notesOpen,
    setNotesOpen,
  ] = React.useState(false);

  const [
    setlistOpen,
    setSetlistOpen,
  ] = React.useState(false);

  const [
    setlistLoading,
    setSetlistLoading,
  ] = React.useState(false);

  const [
    setlistMatch,
    setSetlistMatch,
  ] =
    React.useState<GigSetlistMatchResponse | null>(
      null,
    );

  const noteText = String(
    gig.notes ?? "",
  ).trim();

  const hasNotes =
    noteText.length > 0;

  const imageUrl =
    getGigImageUrl(gig);

  const isFutureGig =
    isFutureGigDate(gig.date);

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

  const canLookupSetlist =
    React.useMemo(() => {
      return Boolean(
        !isFutureGig &&
          String(
            gig.artist ?? "",
          ).trim() &&
          String(
            gig.venue ?? "",
          ).trim() &&
          String(
            gig.city ?? "",
          ).trim() &&
          String(
            gig.date ?? "",
          ).trim(),
      );
    }, [
      gig.artist,
      gig.city,
      gig.date,
      gig.venue,
      isFutureGig,
    ]);

  React.useEffect(() => {
    if (!canLookupSetlist) {
      setSetlistMatch(null);
      return;
    }

    let cancelled = false;

    const loadSetlistMatch =
      async () => {
        setSetlistLoading(true);

        try {
          const qs =
            new URLSearchParams();

          qs.set(
            "artist",
            String(
              gig.artist ?? "",
            ).trim(),
          );

          qs.set(
            "date",
            String(
              gig.date ?? "",
            ).trim(),
          );

          qs.set(
            "city",
            String(
              gig.city ?? "",
            ).trim(),
          );

          qs.set(
            "venue",
            String(
              gig.venue ?? "",
            ).trim(),
          );

          const res =
            await apiGet<GigSetlistMatchResponse>(
              `/setlist/gig-match?${qs.toString()}`,
            );

          if (!cancelled) {
            setSetlistMatch(
              res,
            );
          }
        } catch {
          if (!cancelled) {
            setSetlistMatch(
              null,
            );
          }
        } finally {
          if (!cancelled) {
            setSetlistLoading(
              false,
            );
          }
        }
      };

    void loadSetlistMatch();

    return () => {
      cancelled = true;
    };
  }, [
    canLookupSetlist,
    gig.artist,
    gig.city,
    gig.date,
    gig.venue,
  ]);

  const openSetlistUrl =
    async () => {
      const url =
        setlistMatch?.setlist?.url?.trim();

      if (!url) return;

      try {
        await Linking.openURL(
          url,
        );
      } catch {
        Alert.alert(
          "Couldn’t open link",
          "That setlist link looks invalid.",
        );
      }
    };

  const handleOpenSetlist = (
    e?: any,
  ) => {
    try {
      e?.stopPropagation?.();
    } catch {}

    void selectionHaptic();

    if (
      setlistMatch?.matched &&
      setlistMatch.setlist
    ) {
      setSetlistOpen(true);
      return;
    }

    if (setlistLoading) {
      return;
    }

    Alert.alert(
      "No setlist yet",
      "No reliable setlist match was found for this gig.",
    );
  };

  const hasSetlist =
    Boolean(
      setlistMatch?.matched &&
        setlistMatch.setlist,
    );

  const showSetlistChip =
    canLookupSetlist &&
    !setlistLoading &&
    hasSetlist;

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
        resizeMode="cover"
      />
    </View>
  );

  const modalContent = (
    <>
      <Modal
        visible={notesOpen}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setNotesOpen(false)
        }
      >
        <Pressable
          style={
            styles.modalOverlay
          }
          onPress={() =>
            setNotesOpen(false)
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
                setNotesOpen(false)
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

      <Modal
        visible={setlistOpen}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setSetlistOpen(false)
        }
      >
        <Pressable
          style={
            styles.modalOverlay
          }
          onPress={() =>
            setSetlistOpen(false)
          }
        >
          <Pressable
            style={
              styles.setlistModalCard
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
              Setlist
            </Text>

            {setlistMatch?.setlist ? (
              <>
                <Text
                  style={
                    styles.setlistModalMetaTitle
                  }
                >
                  {
                    setlistMatch
                      .setlist
                      .venueName
                  }
                </Text>

                <Text
                  style={
                    styles.setlistModalMetaText
                  }
                >
                  {
                    setlistMatch
                      .setlist
                      .cityName
                  }{" "}
                  •{" "}
                  {
                    setlistMatch
                      .setlist
                      .eventDate
                  }
                </Text>

                <Text
                  style={
                    styles.setlistModalMetaText
                  }
                >
                  Confidence{" "}
                  {formatConfidence(
                    setlistMatch.confidence,
                  )}{" "}
                  •{" "}
                  {
                    setlistMatch
                      .setlist
                      .songCount
                  }{" "}
                  songs
                </Text>

                <ScrollView
                  style={{
                    maxHeight:
                      320,
                    marginTop: 14,
                  }}
                  showsVerticalScrollIndicator={
                    false
                  }
                >
                  {setlistMatch.setlist.sets.map(
                    (
                      set,
                      setIndex,
                    ) => (
                      <View
                        key={`${set.name}-${setIndex}`}
                        style={
                          styles.setBlock
                        }
                      >
                        <Text
                          style={
                            styles.setBlockTitle
                          }
                        >
                          {set.name ||
                            (set.encore >
                            0
                              ? `Encore ${set.encore}`
                              : "Set")}
                        </Text>

                        <View
                          style={{
                            height: 8,
                          }}
                        />

                        {set.songs
                          .length >
                        0 ? (
                          set.songs.map(
                            (
                              song,
                              songIndex,
                            ) => (
                              <Text
                                key={`${song}-${songIndex}`}
                                style={
                                  styles.songRow
                                }
                              >
                                {songIndex +
                                  1}
                                .{" "}
                                {song}
                              </Text>
                            ),
                          )
                        ) : (
                          <Text
                            style={
                              styles.notesModalBody
                            }
                          >
                            No songs
                            listed.
                          </Text>
                        )}
                      </View>
                    ),
                  )}
                </ScrollView>

                <View
                  style={{
                    gap: 8,
                    marginTop:
                      14,
                  }}
                >
                  {setlistMatch
                    .setlist
                    .url ? (
                    <Pressable
                      onPress={() =>
                        void openSetlistUrl()
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.notesCloseBtn,
                        styles.openSetlistBtn,
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
                        Open on
                        Setlist.fm
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() =>
                      setSetlistOpen(
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
                </View>
              </>
            ) : (
              <>
                <Text
                  style={
                    styles.notesModalBody
                  }
                >
                  No matched
                  setlist available.
                </Text>

                <Pressable
                  onPress={() =>
                    setSetlistOpen(
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
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );

  if (variant === "poster") {
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
                source={{
                  uri: imageUrl,
                }}
                style={
                  styles.posterImage
                }
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
                {posterDate.day}
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
                {gig.artist}
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
        style={({ pressed }) => [
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
            source={{
              uri: imageUrl,
            }}
            style={styles.rowImage}
          />
        ) : (
          renderFallbackImage(
            styles.rowImage,
          )
        )}

        <View
          style={styles.rowBody}
        >
          <View
            style={styles.topRow}
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
                    {gig.artist}
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
            style={styles.meta}
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
              style={styles.date}
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

          {showSetlistChip ? (
            <View
              style={
                styles.socialRow
              }
            >
              <View
                style={
                  styles.socialRight
                }
              >
                <Pressable
                  onPress={
                    handleOpenSetlist
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.inlineAction,
                    pressed
                      ? styles.smallBtnPressed
                      : null,
                  ]}
                  hitSlop={8}
                >
                  <Ionicons
                    name="musical-notes-outline"
                    size={12}
                    color={
                      Colours.text
                        .muted
                    }
                  />

                  <Text
                    style={
                      styles.inlineActionText
                    }
                  >
                    Setlist
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
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
        Colours.background
          .card,
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
        Colours.background
          .card,
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
      borderWidth: 0,
      alignItems: "center",
      justifyContent:
        "center",
    },

    rowFallbackText: {
      color:
        Colours.text
          .primary,
      fontWeight: "900",
      fontSize: 24,
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
      borderBottomWidth: 0,
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
        Colours.text
          .primary,
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
        Colours.text
          .secondary,
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
        Colours.text
          .muted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "500",
    },

    socialRow: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 8,
    },

    socialLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0,
    },

    socialInlineText: {
      flex: 1,
      color:
        Colours.text
          .muted,
      fontWeight: "500",
      fontSize: 11,
      lineHeight: 14,
    },

    socialRight: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "flex-end",
      gap: 8,
      flexShrink: 0,
    },

    inlineAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 3,
      paddingHorizontal: 0,
      borderRadius: 0,
      backgroundColor:
        "transparent",
      borderWidth: 0,
    },

    inlineActionText: {
      color:
        Colours.text
          .muted,
      fontWeight: "600",
      fontSize: 11,
      lineHeight: 14,
    },

    posterCard: {
      width: 150,
      height: 190,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor:
        Colours.background
          .card,
      borderWidth: 0,
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

    posterFallbackText: {
      color:
        Colours.text
          .primary,
      fontWeight: "900",
      fontSize: 42,
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
      borderRadius: 0,
      backgroundColor:
        "transparent",
      borderWidth: 0,
      alignItems: "center",
      justifyContent:
        "center",
    },

    posterMonth: {
      color:
        Colours.text
          .secondary,
      fontWeight: "900",
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: 0.8,
    },

    posterDay: {
      color:
        Colours.text
          .primary,
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
        Colours.text
          .primary,
      fontWeight: "900",
      fontSize: 20,
      lineHeight: 23,
      letterSpacing: -0.2,
    },

    posterMeta: {
      marginTop: 5,
      color:
        Colours.text
          .secondary,
      fontWeight: "700",
      fontSize: 12,
      lineHeight: 15,
    },

    posterDateText: {
      marginTop: 2,
      color:
        Colours.text
          .muted,
      fontWeight: "700",
      fontSize: 11,
      lineHeight: 14,
    },

    smallBtnPressed: {
      opacity: 0.9,
    },

    smallBtnText: {
      color:
        Colours.text
          .secondary,
      fontWeight: "600",
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0,
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
        Colours.background
          .card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        Colours.ui.border,
      padding: 16,
    },

    setlistModalCard: {
      width: "100%",
      maxWidth: 380,
      backgroundColor:
        Colours.background
          .card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        Colours.ui.border,
      padding: 16,
      maxHeight: "82%",
    },

    notesModalTitle: {
      color:
        Colours.text
          .primary,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "700",
    },

    notesModalBody: {
      marginTop: 10,
      color:
        Colours.text
          .secondary,
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

    openSetlistBtn: {
      marginTop: 0,
    },

    setlistModalMetaTitle: {
      marginTop: 10,
      color:
        Colours.text
          .primary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "700",
    },

    setlistModalMetaText: {
      marginTop: 4,
      color:
        Colours.text
          .muted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
    },

    setBlock: {
      marginBottom: 14,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor:
        "rgba(255,255,255,0.06)",
    },

    setBlockTitle: {
      color:
        Colours.text
          .primary,
      fontWeight: "800",
      fontSize: 13,
      lineHeight: 17,
    },

    songRow: {
      color:
        Colours.text
          .secondary,
      fontWeight: "600",
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 4,
    },
  });