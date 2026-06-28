import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
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

type MusicBrainzRelease = {
  id: string;
  title: string;
  type?: string;
  firstReleaseDate?: string;
  coverImageUrl?: string | null;
  musicBrainzUrl: string;
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

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return value;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function formatGigDateUk(value?: string) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function ratingStars(value: number | undefined) {
  if (typeof value !== "number") return "";
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return "★".repeat(rounded);
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
          <Text style={styles.artistGigRating}>
            {ratingStars(props.gig.rating)}
          </Text>
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
  item: MusicBrainzRelease;
  onPress: (url: string | null) => void;
}) {
  return (
    <Pressable
      onPress={() => props.onPress(props.item.musicBrainzUrl)}
      style={({ pressed }) => [
        styles.releaseCard,
        pressed ? styles.pressed : null,
      ]}
    >
      {props.item.coverImageUrl ? (
        <Image
          source={{ uri: props.item.coverImageUrl }}
          style={styles.releaseImage}
        />
      ) : (
        <View style={[styles.releaseImage, styles.trackImagePlaceholder]}>
          <Image
            source={require("../../assets/logo-symbol.png")}
            style={styles.releaseFallbackLogo}
            resizeMode="cover"
          />
        </View>
      )}

      <View style={styles.releaseBody}>
        <Text style={styles.spotifyRowTitle} numberOfLines={1}>
          {props.item.title}
        </Text>
        <Text style={styles.spotifyRowMeta} numberOfLines={1}>
          {props.item.type ?? "Release"} •{" "}
          {formatReleaseDate(props.item.firstReleaseDate)}
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

      <Text style={styles.spotifyRowMeta}>
  {props.item.songCount > 0
    ? `${props.item.songCount} songs`
    : "Setlist unavailable"}
</Text>
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

    const [releasesLoading, setReleasesLoading] = React.useState(true);
const [releases, setReleases] = React.useState<MusicBrainzRelease[]>([]);
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

const loadMusicBrainzReleases = React.useCallback(async () => {
  setReleasesLoading(true);

  try {
    const artistMbid = gigs.find((gig) => gig.artistMbid)?.artistMbid;

    if (!artistMbid) {
      setReleases([]);
      return;
    }

    const res = await apiGet<{ releases: MusicBrainzRelease[] }>(
      `/mb/artists/${encodeURIComponent(artistMbid)}/releases`,
    );

    setReleases(res.releases ?? []);
  } catch {
    setReleases([]);
  } finally {
    setReleasesLoading(false);
  }
}, [gigs]);

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

React.useEffect(() => {
  void loadMusicBrainzReleases();
}, [loadMusicBrainzReleases]);

  const spotifyArtist = spotifyData?.artist ?? null;
  const topTracks = spotifyData?.topTracks ?? [];

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
  const showGigs = !loading && !error && sortedGigs.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        onPressLogo={props.onPressLogo}
        onPressBack={props.onBack}
        backLabel="Back"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.artistHero}>
          <View style={styles.artistHeroTop}>
            {spotifyLoading ? (
              <View style={[styles.artistImageWrap, styles.artistImagePlaceholder]}>
                <ActivityIndicator />
              </View>
            ) : spotifyArtist?.imageUrl ? (
              <Image
                source={{ uri: spotifyArtist.imageUrl }}
                style={styles.artistImage}
              />
            ) : (
              <View style={[styles.artistImageWrap, styles.artistImagePlaceholder]}>
                <Image
                  source={require("../../assets/logo-symbol.png")}
                  style={styles.artistImageFallbackLogo}
                  resizeMode="cover"
                />
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
            <Text style={styles.gigsHeaderTitle}>Your gigs</Text>
            <TicketBadge count={sortedGigs.length} />
          </View>

          {showGigs ? (
            <View style={styles.heroGigList}>
              {sortedGigs.map((gig) => (
                <ArtistGigRow
                  key={gig.id}
                  gig={gig}
                  onPress={() => props.onEditGig?.(gig)}
                />
              ))}
            </View>
          ) : !loading && !error ? (
            <Text style={styles.muted}>{UI_COPY.empty}</Text>
          ) : null}

          {spotifyError ? null : null}

          {showSpotifyFallback ? (
            <View style={styles.spotifyFallbackBox}>
              <Text style={styles.spotifyFallbackText}>
                No current profile for this artist can be matched.
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

        {!releasesLoading && releases.length > 0 ? (
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

        {spotifyArtist && !similarArtistsLoading && similarArtists.length > 0 ? (
          <SectionCard title="Fans also like">
            <View style={styles.similarArtistsWrap}>
              {similarArtists.slice(0, 5).map((artist) => (
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

        {similarArtistsError ? null : null}
      </ScrollView>

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
                        <Text style={styles.notesModalBody}>
  Setlist details aren't available for this show yet.
</Text>
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

  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },

  artistHero: {
    paddingHorizontal: 2,
    paddingVertical: 10,
    gap: 12,
    marginBottom: 14,
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

  artistImageFallbackLogo: {
    width: "100%",
    height: "100%",
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
    gap: 10,
    marginTop: 8,
  },

  metaPill: {
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 0,
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
    paddingVertical: 4,
    paddingRight: 18,
    position: "relative",
    justifyContent: "center",
  },

  spotifyPillIcon: {
    position: "absolute",
    right: 0,
    top: 6,
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
    marginTop: 4,
  },

  heroHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },

  heroGigList: {
    gap: 0,
  },

  gigsHeaderTitle: {
    color: Colours.text.secondary,
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.2,
    textTransform: "uppercase",
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
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
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
    color: "#FFD166",
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },

  spotifyFallbackBox: {
    paddingVertical: 6,
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
    paddingVertical: 10,
    marginBottom: 14,
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

releaseFallbackLogo: {
  width: "100%",
  height: "100%",
  borderRadius: 12,
},

  releaseBody: {
    flex: 1,
  },

  similarArtistsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  similarArtistChip: {
    paddingVertical: 6,
    paddingHorizontal: 2,
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