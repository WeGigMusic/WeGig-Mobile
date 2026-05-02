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
import { Ionicons, FontAwesome } from "@expo/vector-icons";

import { AppHeader } from "../components/AppHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { GigCard } from "../components/GigCard";
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

function computeArtistStats(gigs: Gig[]) {
  const total = gigs.length;

  const rated = gigs.filter((g) => typeof g.rating === "number") as Array<
    Gig & { rating: number }
  >;

  const avgRating =
    rated.length === 0
      ? null
      : Math.round(
          (rated.reduce((sum, g) => sum + g.rating, 0) / rated.length) * 10,
        ) / 10;

  const venues = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.venue ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topVenue = Object.entries(venues).sort((a, b) => b[1] - a[1])[0]?.[0];

  const cities = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.city ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topCity = Object.entries(cities).sort((a, b) => b[1] - a[1])[0]?.[0];

  return { total, avgRating, topVenue, topCity, ratedCount: rated.length };
}

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

function StatTile(props: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{props.label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>
        {props.value}
      </Text>
    </View>
  );
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
      {props.subtitle ? <View style={{ height: 8 }} /> : null}
      {!props.subtitle ? <View style={{ height: 4 }} /> : null}
      {props.children}
    </View>
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
        styles.releaseCard,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.setlistPoster}>
        <View style={styles.setlistPosterGlow} />
        <Ionicons
          name="flash-outline"
          size={16}
          color={Colours.text.primary}
          style={styles.setlistPosterIconTop}
        />
        <Ionicons
          name="musical-notes"
          size={22}
          color={Colours.text.primary}
        />
        <Text style={styles.setlistPosterText}>LIVE</Text>
      </View>

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

  const stats = computeArtistStats(gigs);
  const spotifyArtist = spotifyData?.artist ?? null;
  const topTracks = spotifyData?.topTracks ?? [];
  const releases = spotifyData?.releases ?? [];

  const handleOpenUrl = React.useCallback(async (url: string | null) => {
    const nextUrl = url?.trim();
    if (!nextUrl) return;

    try {
      await Linking.openURL(nextUrl);
    } catch {}
  }, []);

  const showSpotifyFallback = !spotifyLoading && !spotifyArtist;
  const showList = !loading && !error && gigs.length > 0;

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
        <SectionCard
          title="Recent setlists"
          subtitle={`${Math.min(setlists.length, 3)} shown`}
        >
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
        <SectionCard title="Fans also like" subtitle="From Last.fm">
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
      ) : (
        <>
          <SectionCard title="Your WeGig stats">
            <View style={styles.grid}>
              <StatTile label="Total gigs" value={String(stats.total)} />
              <StatTile label="Rated" value={String(stats.ratedCount)} />
              <StatTile
                label="Avg rating"
                value={stats.avgRating == null ? "—" : String(stats.avgRating)}
              />
              <StatTile label="Top city" value={stats.topCity ?? "—"} />
            </View>

            <View style={styles.divider} />

            <Text style={styles.metaLine}>
              Top venue:{" "}
              <Text style={styles.metaLineStrong}>{stats.topVenue ?? "—"}</Text>
            </Text>
          </SectionCard>

          <View style={styles.sectionDivider} />

          <View style={styles.gigsHeaderRow}>
            <View>
              <Text style={styles.gigsHeaderEyebrow}>Live history</Text>
              <Text style={styles.gigsHeaderTitle}>Your gigs</Text>
            </View>

            <View style={styles.ticketBadge}>
              <View style={styles.ticketNotchLeft} />
              <View style={styles.ticketNotchRight} />
              <Text style={styles.ticketBadgeText}>{gigs.length}</Text>
            </View>
          </View>
        </>
      )}
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
        data={showList ? gigs : []}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={renderHeader}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          !loading && !error && gigs.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.muted}>{UI_COPY.empty}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <GigCard gig={item} onPress={() => props.onEditGig?.(item)} />
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
    gap: 8,
    marginBottom: 8,
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

  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginTop: 0,
    marginBottom: 12,
  },

  gigsHeaderRow: {
    marginBottom: 10,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  gigsHeaderEyebrow: {
    color: Colours.text.muted,
    fontWeight: "800",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },

  gigsHeaderTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
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

  metaLine: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 18,
  },

  metaLineStrong: {
    color: Colours.text.primary,
    fontWeight: "900",
  },

  error: {
    color: Colours.text.danger,
    fontWeight: "900",
  },

  grid: {
    marginTop: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  tile: {
    width: "48%",
    backgroundColor: "rgba(0,0,0,0.16)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    paddingVertical: 9,
    paddingHorizontal: 10,
    minHeight: 70,
    justifyContent: "center",
  },

  tileLabel: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.1,
  },

  tileValue: {
    marginTop: 4,
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 17,
    letterSpacing: -0.1,
  },

  divider: {
    marginTop: 12,
    marginBottom: 10,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
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

  releaseImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },

  releaseBody: {
    flex: 1,
  },

  setlistPoster: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1A1026",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  setlistPosterGlow: {
    position: "absolute",
    top: -8,
    left: -6,
    right: -6,
    height: 24,
    backgroundColor: "rgba(255,80,80,0.22)",
    borderRadius: 999,
  },

  setlistPosterIconTop: {
    position: "absolute",
    top: 7,
    right: 7,
    opacity: 0.9,
  },

  setlistPosterText: {
    marginTop: 2,
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 9,
    letterSpacing: 1,
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