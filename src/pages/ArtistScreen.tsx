import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Linking,
  Modal,
  ScrollView,
} from "react-native";
import { FontAwesome, Ionicons } from "@expo/vector-icons";

import { AppHeader } from "../components/AppHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { apiGet } from "../lib/api";
import { posthog } from "../lib/analytics";
import { Colours } from "../theme/colours";
import type { Gig, GigsResponse } from "../shared/types/Gig";

type SpotifyArtistPageResponse = {
  artist: {
    id: string;
    name: string;
    imageUrl: string | null;
    genres: string[];
    popularity: number | null;
    spotifyUrl: string | null;
    followers?: number | null;
  } | null;
  topTracks: Array<{
    id: string;
    name: string;
    albumName: string;
    imageUrl: string | null;
    spotifyUrl: string | null;
    durationMs: number | null;
  }>;
  releases: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    releaseDate: string | null;
    spotifyUrl: string | null;
    albumType: string | null;
  }>;
};

type SetlistItem = {
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

type SimilarArtist = {
  name: string;
  url: string | null;
};

const UI_COPY = {
  loading: "Almost there",
  empty: "No gigs logged for this artist yet.",
  noSetlist: "No setlist currently available.",
};

function formatFollowers(value: number | null | undefined) {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatDuration(durationMs: number | null | undefined) {
  if (!durationMs) return "—";
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatReleaseDate(value: string | null | undefined) {
  if (!value) return "Unknown date";
  return value;
}

function formatGigDateUk(value?: string) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function SectionCard(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{props.title}</Text>
        {props.subtitle ? (
          <Text style={styles.sectionSubtitle}>{props.subtitle}</Text>
        ) : null}
      </View>
      <View style={{ height: props.subtitle ? 8 : 4 }} />
      {props.children}
    </View>
  );
}

function TicketBadge(props: { count: number }) {
  return (
    <View style={styles.ticketBadge}>
      <View style={styles.ticketNotchLeft} />
      <View style={styles.ticketNotchRight} />
      <Text style={styles.ticketBadgeText}>{props.count}</Text>
    </View>
  );
}

function ArtistGigRow(props: { gig: Gig; onPress?: () => void }) {
  const hasRating = typeof props.gig.rating === "number";

  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.artistGigRow,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.artistGigBody}>
        <Text style={styles.artistGigTitle} numberOfLines={1}>
          {props.gig.venue}
        </Text>

        <Text style={styles.artistGigMeta} numberOfLines={1}>
          {props.gig.city} • {formatGigDateUk(props.gig.date)}
        </Text>
      </View>

      <View style={styles.artistGigRight}>
        {hasRating ? (
          <Text style={styles.artistGigRating}>★ {props.gig.rating}</Text>
        ) : null}

        <Ionicons
          name="chevron-forward"
          size={17}
          color="rgba(255,255,255,0.44)"
        />
      </View>
    </Pressable>
  );
}

function SpotifyTrackRow(props: {
  index: number;
  track: SpotifyArtistPageResponse["topTracks"][number];
  onPress: (url: string | null) => void;
}) {
  return (
    <Pressable
      onPress={() => props.onPress(props.track.spotifyUrl)}
      style={({ pressed }) => [
        styles.spotifyRow,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.spotifyRowIndexWrap}>
        <Text style={styles.spotifyRowIndex}>{props.index + 1}</Text>
      </View>

      {props.track.imageUrl ? (
        <Image source={{ uri: props.track.imageUrl }} style={styles.trackImage} />
      ) : (
        <View style={[styles.trackImage, styles.trackImagePlaceholder]} />
      )}

      <View style={styles.spotifyRowBody}>
        <Text style={styles.spotifyRowTitle} numberOfLines={1}>
          {props.track.name}
        </Text>
        <Text style={styles.spotifyRowMeta} numberOfLines={1}>
          {props.track.albumName || "Unknown release"}
        </Text>
      </View>

      <Text style={styles.spotifyRowMeta}>
        {formatDuration(props.track.durationMs)}
      </Text>
    </Pressable>
  );
}

function ReleaseCard(props: {
  item: SpotifyArtistPageResponse["releases"][number];
  onPress: (url: string | null) => void;
}) {
  return (
    <Pressable
      onPress={() => props.onPress(props.item.spotifyUrl)}
      style={({ pressed }) => [
        styles.releaseCard,
        pressed ? styles.pressed : null,
      ]}
    >
      {props.item.imageUrl ? (
        <Image source={{ uri: props.item.imageUrl }} style={styles.releaseImage} />
      ) : (
        <View style={[styles.releaseImage, styles.trackImagePlaceholder]} />
      )}

      <View style={styles.releaseBody}>
        <Text style={styles.spotifyRowTitle} numberOfLines={1}>
          {props.item.name}
        </Text>
        <Text style={styles.spotifyRowMeta} numberOfLines={1}>
          {props.item.albumType ?? "release"} •{" "}
          {formatReleaseDate(props.item.releaseDate)}
        </Text>
      </View>
    </Pressable>
  );
}

function SetlistRow(props: {
  item: SetlistItem;
  onPress: (item: SetlistItem) => void;
}) {
  return (
    <Pressable
      onPress={() => props.onPress(props.item)}
      style={({ pressed }) => [
        styles.setlistTextRow,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.releaseBody}>
        <Text style={styles.spotifyRowTitle} numberOfLines={1}>
          {props.item.venueName}
        </Text>
        <Text style={styles.spotifyRowMeta} numberOfLines={1}>
          {props.item.cityName} • {props.item.eventDate}
        </Text>
      </View>

      <Text style={styles.spotifyRowMeta}>{props.item.songCount} songs</Text>
    </Pressable>
  );
}

export function ArtistScreen(props: {
  artist: string;
  onBack: () => void;
  onEditGig?: (gig: Gig) => void;
  onPressLogo?: () => void;
  onPressSimilarArtist?: (artist: string) => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [gigs, setGigs] = React.useState<Gig[]>([]);

  const [spotifyLoading, setSpotifyLoading] = React.useState(true);
  const [spotifyError, setSpotifyError] = React.useState("");
  const [spotifyData, setSpotifyData] =
    React.useState<SpotifyArtistPageResponse | null>(null);

  const [setlistLoading, setSetlistLoading] = React.useState(true);
  const [setlists, setSetlists] = React.useState<SetlistItem[]>([]);
  const [selectedSetlist, setSelectedSetlist] =
    React.useState<SetlistItem | null>(null);

  const [similarArtistsLoading, setSimilarArtistsLoading] = React.useState(true);
  const [similarArtistsError, setSimilarArtistsError] = React.useState("");
  const [similarArtists, setSimilarArtists] = React.useState<SimilarArtist[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await apiGet<GigsResponse>("/gigs");
      const artistNorm = props.artist.trim().toLowerCase();

      const filtered = (res.gigs ?? []).filter(
        (g) => (g.artist ?? "").trim().toLowerCase() === artistNorm,
      );

      setGigs(filtered);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load artist gigs");
      setGigs([]);
    } finally {
      setLoading(false);
    }
  }, [props.artist]);

  const loadSpotifyArtistPage = React.useCallback(async () => {
    setSpotifyLoading(true);
    setSpotifyError("");

    try {
      const res = await apiGet<SpotifyArtistPageResponse>(
        `/spotify/artist-page?name=${encodeURIComponent(props.artist.trim())}`,
      );

      setSpotifyData({
        artist: res.artist ?? null,
        topTracks: res.topTracks ?? [],
        releases: res.releases ?? [],
      });
    } catch (e: any) {
      setSpotifyError(e?.message ?? "Failed to load Spotify artist page");
      setSpotifyData({
        artist: null,
        topTracks: [],
        releases: [],
      });
    } finally {
      setSpotifyLoading(false);
    }
  }, [props.artist]);

  const loadSetlists = React.useCallback(async () => {
    setSetlistLoading(true);

    try {
      const res = await apiGet<{ setlists: SetlistItem[] }>(
        `/setlist/artist?artist=${encodeURIComponent(props.artist.trim())}`,
      );

      setSetlists(res.setlists ?? []);
    } catch {
      setSetlists([]);
    } finally {
      setSetlistLoading(false);
    }
  }, [props.artist]);

  const loadSimilarArtists = React.useCallback(async () => {
    setSimilarArtistsLoading(true);
    setSimilarArtistsError("");

    try {
      const res = await apiGet<{ artists: SimilarArtist[] }>(
        `/lastfm/similar-artists?artist=${encodeURIComponent(props.artist.trim())}`,
      );

      setSimilarArtists(res.artists ?? []);
    } catch (e: any) {
      setSimilarArtistsError(e?.message ?? "Failed to load similar artists");
      setSimilarArtists([]);
    } finally {
      setSimilarArtistsLoading(false);
    }
  }, [props.artist]);

  React.useEffect(() => {
    posthog.capture("artist_page_viewed", {
      artist: props.artist,
    });

    void posthog.flush();
  }, [props.artist]);

  React.useEffect(() => {
    void load();
    void loadSpotifyArtistPage();
    void loadSetlists();
    void loadSimilarArtists();
  }, [load, loadSpotifyArtistPage, loadSetlists, loadSimilarArtists]);

  const spotifyArtist = spotifyData?.artist ?? null;
  const topTracks = spotifyData?.topTracks ?? [];
  const releases = spotifyData?.releases ?? [];

  const sortedGigs = React.useMemo(
    () =>
      [...gigs].sort((a, b) => {
        const ad = String(a.date ?? "");
        const bd = String(b.date ?? "");
        return bd.localeCompare(ad);
      }),
    [gigs],
  );

  const handleOpenUrl = React.useCallback(async (url: string | null) => {
    const nextUrl = url?.trim();
    if (!nextUrl) return;

    try {
      await Linking.openURL(nextUrl);
    } catch {}
  }, []);

  const showSpotifyFallback = !spotifyLoading && !spotifyArtist;
  const showList = !loading && !error && sortedGigs.length > 0;

  const renderHeader = () => (
    <>
      <View style={styles.artistHero}>
        <View style={styles.artistHeroTop}>
          {spotifyLoading ? (
            <View
              style={[styles.artistImageWrap, styles.artistImagePlaceholder]}
            >
              <ActivityIndicator />
            </View>
          ) : spotifyArtist?.imageUrl ? (
            <Image
              source={{ uri: spotifyArtist.imageUrl }}
              style={styles.artistImage}
            />
          ) : (
            <View
              style={[styles.artistImageWrap, styles.artistImagePlaceholder]}
            >
              <Text style={styles.artistImageFallback}>
                {props.artist.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.artistHeroText}>
            <Text style={styles.artistName}>
              {spotifyArtist?.name ?? props.artist}
            </Text>

            <View style={styles.metaRow}>
              {spotifyArtist?.popularity != null ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>
                    Popularity {spotifyArtist.popularity}/100
                  </Text>
                </View>
              ) : null}

              {spotifyArtist?.followers != null ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>
                    {formatFollowers(spotifyArtist.followers)} followers
                  </Text>
                </View>
              ) : null}
            </View>

            {spotifyArtist?.spotifyUrl ? (
              <Pressable
                onPress={() => void handleOpenUrl(spotifyArtist.spotifyUrl)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.spotifyLinkBtn,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.spotifyLinkText}>Listen</Text>

                <FontAwesome
                  name="spotify"
                  size={12}
                  color="rgba(255,255,255,0.9)"
                  style={styles.spotifyPillIcon}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroHistoryRow}>
          <View>
            <Text style={styles.gigsHeaderEyebrow}>Live history</Text>
            <Text style={styles.gigsHeaderTitle}>Your gigs</Text>
          </View>

          <TicketBadge count={sortedGigs.length} />
        </View>

        {spotifyError ? (
          <View style={styles.spotifyFallbackBox}>
            <Text style={styles.spotifyFallbackTitle}>Spotify lookup failed</Text>
            <Text style={styles.spotifyFallbackText}>{spotifyError}</Text>
          </View>
        ) : null}

        {showSpotifyFallback ? (
          <View style={styles.spotifyFallbackBox}>
            <Text style={styles.spotifyFallbackTitle}>
              No Spotify profile found yet
            </Text>
            <Text style={styles.spotifyFallbackText}>
              This artist may be local, emerging, or not matched yet.
            </Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.card}>
          <View style={styles.inlineRow}>
            <ActivityIndicator />
            <Text style={styles.muted}>{UI_COPY.loading}</Text>
          </View>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <View style={{ height: 10 }} />
          <PrimaryButton title="Try again" onPress={load} />
        </View>
      ) : null}
    </>
  );

  const renderFooter = () => (
    <>
      {!spotifyLoading && topTracks.length > 0 ? (
        <SectionCard title="Popular on Spotify">
          <View style={styles.spotifyList}>
            {topTracks.map((track, index) => (
              <SpotifyTrackRow
                key={track.id}
                index={index}
                track={track}
                onPress={handleOpenUrl}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {!spotifyLoading && releases.length > 0 ? (
        <SectionCard title="Releases">
          <View style={styles.spotifyList}>
            {releases.slice(0, 5).map((item) => (
              <ReleaseCard
                key={item.id}
                item={item}
                onPress={handleOpenUrl}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {!setlistLoading && setlists.length > 0 ? (
        <SectionCard title="Recent setlists">
          <View style={styles.spotifyList}>
            {setlists.slice(0, 3).map((item) => (
              <SetlistRow
                key={item.id}
                item={item}
                onPress={(next) => {
                  posthog.capture("setlist_opened", {
                    artist: props.artist,
                    venue: next.venueName,
                    date: next.eventDate,
                  });

                  void posthog.flush();
                  setSelectedSetlist(next);
                }}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {!setlistLoading && setlists.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.spotifyFallbackText}>{UI_COPY.noSetlist}</Text>
        </View>
      ) : null}

      {!similarArtistsLoading && similarArtists.length > 0 ? (
        <SectionCard title="Fans also like">
          <View style={styles.similarArtistsWrap}>
            {similarArtists.slice(0, 8).map((artist) => (
              <Pressable
                key={artist.name}
                onPress={() => {
                  if (props.onPressSimilarArtist) {
                    props.onPressSimilarArtist(artist.name);
                    return;
                  }

                  void handleOpenUrl(artist.url);
                }}
                style={({ pressed }) => [
                  styles.similarArtistChip,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.similarArtistChipText}>{artist.name}</Text>
              </Pressable>
            ))}
          </View>
        </SectionCard>
      ) : null}

      {similarArtistsError ? (
        <View style={styles.card}>
          <Text style={styles.spotifyFallbackText}>{similarArtistsError}</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        onPressLogo={props.onPressLogo}
        onPressBack={props.onBack}
        backLabel="Back"
      />

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={showList ? sortedGigs : []}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          !loading && !error && sortedGigs.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.muted}>{UI_COPY.empty}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <ArtistGigRow gig={item} onPress={() => props.onEditGig?.(item)} />
        )}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={!!selectedSetlist}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSetlist(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedSetlist(null)}
        >
          <Pressable
            style={styles.setlistModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.notesModalTitle}>Setlist</Text>

            {selectedSetlist ? (
              <>
                <Text style={styles.setlistModalMetaTitle}>
                  {selectedSetlist.venueName}
                </Text>

                <Text style={styles.setlistModalMetaText}>
                  {selectedSetlist.cityName} • {selectedSetlist.eventDate}
                </Text>

                <Text style={styles.setlistModalMetaText}>
                  {selectedSetlist.songCount} songs
                </Text>

                <ScrollView
                  style={{ maxHeight: 320, marginTop: 14 }}
                  showsVerticalScrollIndicator={false}
                >
                  {selectedSetlist.sets.map((set, setIndex) => (
                    <View
                      key={`${set.name}-${setIndex}`}
                      style={styles.setBlock}
                    >
                      <Text style={styles.setBlockTitle}>
                        {set.name ||
                          (set.encore > 0 ? `Encore ${set.encore}` : "Set")}
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
                  {selectedSetlist.url ? (
                    <Pressable
                      onPress={() => void handleOpenUrl(selectedSetlist.url)}
                      style={({ pressed }) => [
                        styles.notesCloseBtn,
                        styles.openSetlistBtn,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <Text style={styles.smallBtnText}>Open on Setlist.fm</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => setSelectedSetlist(null)}
                    style={({ pressed }) => [
                      styles.notesCloseBtn,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={styles.smallBtnText}>Close</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colours.background.app,
  },

  list: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },

  artistHero: {
    backgroundColor: Colours.background.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },

  artistHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  artistHeroText: {
    flex: 1,
  },

  artistImageWrap: {
    width: 92,
    height: 92,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  artistImage: {
    width: 92,
    height: 92,
    borderRadius: 22,
  },

  artistImagePlaceholder: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  artistImageFallback: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 32,
  },

  artistName: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },

  metaPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },

  metaPillText: {
    color: Colours.text.secondary,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 14,
  },

  spotifyLinkBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "rgba(29,185,84,0.12)",
    borderWidth: 1,
    borderColor: "rgba(29,185,84,0.24)",
    paddingVertical: 8,
    paddingLeft: 11,
    paddingRight: 24,
    borderRadius: 12,
    position: "relative",
    justifyContent: "center",
  },

  spotifyPillIcon: {
    position: "absolute",
    right: 8,
    top: 10,
  },

  spotifyLinkText: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  heroHistoryRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  spotifyFallbackBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },

  spotifyFallbackTitle: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 17,
  },

  spotifyFallbackText: {
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 17,
  },

  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 13,
    marginBottom: 8,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: -0.1,
  },

  sectionSubtitle: {
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 11,
  },

  gigsHeaderEyebrow: {
    color: Colours.text.muted,
    fontWeight: "800",
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },

  gigsHeaderTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.1,
  },

  ticketBadge: {
    minWidth: 42,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(47,140,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(47,140,255,0.34)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },

  ticketNotchLeft: {
    position: "absolute",
    left: -5,
    top: "50%",
    marginTop: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colours.background.app,
    borderWidth: 1,
    borderColor: "rgba(47,140,255,0.18)",
  },

  ticketNotchRight: {
    position: "absolute",
    right: -5,
    top: "50%",
    marginTop: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colours.background.app,
    borderWidth: 1,
    borderColor: "rgba(47,140,255,0.18)",
  },

  ticketBadgeText: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 14,
  },

  artistGigRow: {
    backgroundColor: Colours.background.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  artistGigBody: {
    flex: 1,
    minWidth: 0,
  },

  artistGigTitle: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 15,
    lineHeight: 19,
  },

  artistGigMeta: {
    marginTop: 3,
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
  },

  artistGigRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  artistGigRating: {
    color: Colours.text.muted,
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 16,
  },

  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  muted: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 13,
  },

  error: {
    color: Colours.text.danger,
    fontWeight: "900",
  },

  spotifyList: {
    gap: 4,
  },

  spotifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },

  spotifyRowIndexWrap: {
    width: 18,
    alignItems: "center",
  },

  spotifyRowIndex: {
    color: Colours.text.muted,
    fontWeight: "800",
    fontSize: 12,
  },

  spotifyRowBody: {
    flex: 1,
  },

  spotifyRowTitle: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 17,
  },

  spotifyRowMeta: {
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 11,
    lineHeight: 15,
  },

  trackImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },

  trackImagePlaceholder: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  releaseCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 3,
  },

  setlistTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },

  releaseImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },

  releaseBody: {
    flex: 1,
  },

  similarArtistsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  similarArtistChip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  similarArtistChipText: {
    color: Colours.text.secondary,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 14,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  setlistModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#17191C",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
  },

  openSetlistBtn: {
    marginTop: 0,
  },

  smallBtnText: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
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

  pressed: {
    opacity: 0.82,
  },
});