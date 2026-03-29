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
} from "react-native";

import { AppHeader } from "../components/AppHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { GigCard } from "../components/GigCard";
import { apiGet } from "../lib/api";
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

const UI_COPY = {
  loading: "Almost there",
  empty: "No gigs logged for this artist yet.",
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

function GenreChip(props: { label: string }) {
  return (
    <View style={styles.genreChip}>
      <Text style={styles.genreChipText}>{props.label}</Text>
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
      <View style={{ height: 10 }} />
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

export function ArtistScreen(props: {
  artist: string;
  onBack: () => void;
  onEditGig?: (gig: Gig) => void;
  onPressLogo?: () => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [gigs, setGigs] = React.useState<Gig[]>([]);

  const [spotifyLoading, setSpotifyLoading] = React.useState(true);
  const [spotifyError, setSpotifyError] = React.useState("");
  const [spotifyData, setSpotifyData] =
    React.useState<SpotifyArtistPageResponse | null>(null);

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

  React.useEffect(() => {
    void load();
    void loadSpotifyArtistPage();
  }, [load, loadSpotifyArtistPage]);

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
  const heroGenres = spotifyArtist?.genres?.slice(0, 4) ?? [];
  const showList = !loading && !error && gigs.length > 0;

  const renderHeader = () => (
    <>
      <View style={styles.headerCard}>
        <PrimaryButton title="← Back" onPress={props.onBack} />
      </View>

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

            <Text style={styles.artistSubline}>
              {stats.total} gig{stats.total === 1 ? "" : "s"} logged
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
                <Text style={styles.spotifyLinkText}>Open in Spotify</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {!spotifyLoading && heroGenres.length > 0 ? (
          <View style={styles.genreSection}>
            <Text style={styles.miniHeading}>Genres</Text>
            <View style={styles.genreRow}>
              {heroGenres.map((genre) => (
                <GenreChip key={genre} label={genre} />
              ))}
            </View>
          </View>
        ) : null}

        {!spotifyLoading && spotifyArtist ? (
          <Text style={styles.aboutText}>
            Music metadata is pulled from Spotify. Your WeGig stats and personal
            gig history stay separate below.
          </Text>
        ) : null}

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
              This artist may be local, emerging, or not matched yet. Your
              WeGig stats and gig history are still available below.
            </Text>
          </View>
        ) : null}
      </View>

      {!spotifyLoading && topTracks.length > 0 ? (
        <SectionCard title="Popular on Spotify" subtitle={`${topTracks.length} tracks`}>
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
        <SectionCard title="Releases" subtitle={`${releases.length} shown`}>
          <View style={styles.spotifyList}>
            {releases.slice(0, 6).map((item) => (
              <ReleaseCard
                key={item.id}
                item={item}
                onPress={handleOpenUrl}
              />
            ))}
          </View>
        </SectionCard>
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

            <View style={styles.gigsHeaderBadge}>
              <Text style={styles.gigsHeaderBadgeText}>{gigs.length}</Text>
            </View>
          </View>
        </>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader onPressLogo={props.onPressLogo} />

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

  headerCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
    marginBottom: 10,
  },

  artistHero: {
    backgroundColor: Colours.background.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
    gap: 12,
    marginBottom: 12,
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
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.4,
  },

  artistSubline: {
    marginTop: 4,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 18,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  metaPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  metaPillText: {
    color: Colours.text.secondary,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 14,
  },

  spotifyLinkBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "rgba(29,185,84,0.16)",
    borderWidth: 1,
    borderColor: "rgba(29,185,84,0.34)",
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 12,
  },

  spotifyLinkText: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 16,
  },

  genreSection: {
    gap: 8,
  },

  miniHeading: {
    color: Colours.text.muted,
    fontWeight: "800",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  genreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  genreChip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  genreChipText: {
    color: Colours.text.secondary,
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 14,
  },

  aboutText: {
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 18,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    marginBottom: 12,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: -0.1,
  },

  sectionSubtitle: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
  },

  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginTop: 2,
    marginBottom: 14,
  },

  gigsHeaderRow: {
    marginBottom: 12,
    paddingHorizontal: 4,
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
    marginBottom: 3,
  },

  gigsHeaderTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
  },

  gigsHeaderBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  gigsHeaderBadgeText: {
    color: Colours.text.secondary,
    fontWeight: "900",
    fontSize: 13,
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
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  tile: {
    width: "48%",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 11,
    paddingHorizontal: 12,
    minHeight: 86,
    justifyContent: "space-between",
  },

  tileLabel: {
    color: Colours.text.muted,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.15,
  },

  tileValue: {
    marginTop: 8,
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 20,
    letterSpacing: -0.2,
  },

  divider: {
    marginTop: 14,
    marginBottom: 12,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  spotifyList: {
    gap: 8,
  },

  spotifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
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
    fontWeight: "800",
    fontSize: 14,
    lineHeight: 18,
  },

  spotifyRowMeta: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
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
    paddingVertical: 4,
  },

  releaseImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },

  releaseBody: {
    flex: 1,
  },

  pressed: {
    opacity: 0.82,
  },
});