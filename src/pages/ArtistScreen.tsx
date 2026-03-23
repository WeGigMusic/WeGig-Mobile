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

type SpotifyArtistResponse = {
  artist: {
    id: string;
    name: string;
    imageUrl: string | null;
    genres: string[];
    popularity: number | null;
    spotifyUrl: string | null;
  } | null;
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
  const [spotifyArtist, setSpotifyArtist] = React.useState<SpotifyArtistResponse["artist"]>(null);

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

  const loadSpotifyArtist = React.useCallback(async () => {
    setSpotifyLoading(true);

    try {
      const res = await apiGet<SpotifyArtistResponse>(
        `/spotify/artist?name=${encodeURIComponent(props.artist.trim())}`,
      );
      setSpotifyArtist(res.artist ?? null);
    } catch {
      setSpotifyArtist(null);
    } finally {
      setSpotifyLoading(false);
    }
  }, [props.artist]);

  React.useEffect(() => {
    void load();
    void loadSpotifyArtist();
  }, [load, loadSpotifyArtist]);

  const stats = computeArtistStats(gigs);

const handleOpenSpotify = React.useCallback(async () => {
  const url = spotifyArtist?.spotifyUrl?.trim();
  if (!url) return;

  try {
    await Linking.openURL(url);
  } catch {}
}, [spotifyArtist?.spotifyUrl]);

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader onPressLogo={props.onPressLogo} />

      <View style={styles.body}>
        <View style={styles.headerCard}>
          <PrimaryButton title="← Back" onPress={props.onBack} />
        </View>

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
                <Text style={styles.artistImageFallback}>
                  {props.artist.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.artistHeroText}>
              <Text style={styles.artistName}>{props.artist}</Text>
              <Text style={styles.artistSubline}>
                {stats.total} gig{stats.total === 1 ? "" : "s"} logged
              </Text>

              {spotifyArtist?.popularity != null ? (
                <Text style={styles.spotifyMeta}>
                  Spotify popularity: {spotifyArtist.popularity}/100
                </Text>
              ) : null}

              {spotifyArtist?.spotifyUrl ? (
                <Pressable
                  onPress={() => void handleOpenSpotify()}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.spotifyLinkBtn,
                    pressed ? { opacity: 0.86 } : null,
                  ]}
                >
                  <Text style={styles.spotifyLinkText}>Open in Spotify</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {!spotifyLoading && spotifyArtist?.genres?.length ? (
            <View style={styles.genreRow}>
              {spotifyArtist.genres.slice(0, 6).map((genre) => (
                <GenreChip key={genre} label={genre} />
              ))}
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.card}>
            <View style={styles.inlineRow}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading…</Text>
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
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Your WeGig stats</Text>

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

              <View style={{ gap: 6 }}>
                <Text style={styles.muted}>
                  Top venue:{" "}
                  <Text style={styles.mutedStrong}>{stats.topVenue ?? "—"}</Text>
                </Text>
              </View>
            </View>

            <View style={[styles.card, styles.listCard]}>
              <Text style={styles.sectionTitle}>Your gigs</Text>

              {gigs.length === 0 ? (
                <Text style={[styles.muted, { marginTop: 10 }]}>
                  No gigs logged for this artist yet.
                </Text>
              ) : (
                <FlatList
                  style={{ marginTop: 10 }}
                  data={gigs}
                  keyExtractor={(g) => g.id}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  contentContainerStyle={{ paddingBottom: 4 }}
                  renderItem={({ item }) => (
                    <GigCard
                      gig={item}
                      onPress={() => props.onEditGig?.(item)}
                    />
                  )}
                />
              )}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colours.background.app },
  body: { flex: 1, padding: 16, gap: 12, paddingBottom: 28 },

  headerCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },

  artistHero: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 16,
    gap: 14,
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
    width: 84,
    height: 84,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  artistImage: {
    width: 84,
    height: 84,
    borderRadius: 18,
  },

  artistImagePlaceholder: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },

  artistImageFallback: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 28,
  },

  artistName: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 28,
  },

  artistSubline: {
    marginTop: 6,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 18,
  },

  spotifyMeta: {
    marginTop: 6,
    color: Colours.text.secondary,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  spotifyLinkBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "rgba(29,185,84,0.16)",
    borderWidth: 1,
    borderColor: "rgba(29,185,84,0.32)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
  },

  spotifyLinkText: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  genreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  genreChip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
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

  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },

  listCard: {
    flex: 1,
  },

  sectionTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 16,
  },

  inlineRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  muted: { color: Colours.text.muted, fontWeight: "800" },
  mutedStrong: { color: Colours.text.secondary, fontWeight: "900" },
  error: { color: Colours.text.danger, fontWeight: "900" },

  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  tile: {
    width: "48%",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 12,
  },

  tileLabel: {
    color: Colours.text.muted,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  tileValue: {
    marginTop: 10,
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 18,
  },

  divider: {
    marginTop: 14,
    marginBottom: 12,
    height: 1,
    backgroundColor: Colours.ui.divider,
  },
});