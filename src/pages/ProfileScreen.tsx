import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { AvatarPickerModal } from "../components/AvatarPickerModal";
import { Colours } from "../theme/colours";
import { apiGet } from "../lib/api";
import type { GigsResponse, Gig } from "../shared/types/Gig";
import { avatarPresets } from "../config/avatarPresets";

const HOME_CITY_KEY = "wegig.homeCity";
const DISPLAY_NAME_KEY = "wegig.displayName";
const HAPTICS_KEY = "wegig.hapticsEnabled";
const AVATAR_PRESET_KEY = "wegig.avatarPreset";
const AVATAR_URI_KEY = "wegig.avatarUri";
const FIRST_GIG_ID_KEY = "wegig.firstGigId";
const FAVOURITE_GIG_ID_KEY = "wegig.favouriteGigId";

type BadgeChip = {
  title: string;
  icon: string;
  unlocked: boolean;
};

function statLine(label: string, value: string) {
  return (
    <View style={styles.statRow} key={label}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function computeProfileStats(gigs: Gig[]) {
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

  const cities = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.city ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const cityEntries = Object.entries(cities).sort((a, b) => b[1] - a[1]);
  const topCity = cityEntries[0]?.[0];
  const cityCount = Object.keys(cities).length;

  const venues = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.venue ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const venueEntries = Object.entries(venues).sort((a, b) => b[1] - a[1]);
  const topVenue = venueEntries[0]?.[0];
  const venueCount = Object.keys(venues).length;

  const artists = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.artist ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const artistEntries = Object.entries(artists).sort((a, b) => b[1] - a[1]);
  const topArtist = artistEntries[0]?.[0];
  const topArtistCount = artistEntries[0]?.[1] ?? 0;

  let statusLabel = "New Fan";
  let statusColor = "#6B7280";
  let statusIcon = "✨";

  if (total >= 10) {
    statusLabel = "Scene Member";
    statusColor = "#8A5BFF";
    statusIcon = "⚡";
  } else if (cityCount >= 3) {
    statusLabel = "Explorer";
    statusColor = "#C0C4CC";
    statusIcon = "🌍";
  } else if (rated.length >= 5) {
    statusLabel = "Reviewer";
    statusColor = "#2EE59D";
    statusIcon = "📝";
  } else if (total >= 5) {
    statusLabel = "Regular";
    statusColor = "#2F8CFF";
    statusIcon = "🔥";
  }

  const badges: BadgeChip[] = [
    { title: "First Gig", icon: "🎟️", unlocked: total >= 1 },
    { title: "Origin Story", icon: "🌱", unlocked: total >= 1 },
    { title: "That One Night", icon: "✨", unlocked: rated.length >= 1 },
    { title: "Regular", icon: "🔥", unlocked: total >= 5 },
    { title: "Venue Hopper", icon: "🏟️", unlocked: venueCount >= 3 },
    { title: "City Explorer", icon: "🌍", unlocked: cityCount >= 3 },
    { title: "Superfan", icon: "⭐", unlocked: topArtistCount >= 3 },
    { title: "Five-Star Night", icon: "🌟", unlocked: gigs.some((g) => g.rating === 5) },
    { title: "Critic", icon: "📝", unlocked: rated.length >= 5 },
  ];

  return {
    total,
    ratedCount: rated.length,
    avgRating,
    topCity,
    topVenue,
    topArtist,
    badges,
    statusLabel,
    statusColor,
    statusIcon,
  };
}

function ActionRow(props: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={!props.onPress}
      style={({ pressed }) => [
        styles.actionRow,
        pressed ? { opacity: 0.9 } : null,
        !props.onPress ? { opacity: 0.55 } : null,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{props.title}</Text>
        {props.subtitle ? (
          <Text style={styles.actionSubtitle}>{props.subtitle}</Text>
        ) : null}
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function SectionTitle(props: { title: string }) {
  return <Text style={styles.sectionTitle}>{props.title}</Text>;
}

function BadgeChipView(props: BadgeChip) {
  return (
    <View
      style={[
        styles.badgeChip,
        props.unlocked ? styles.badgeChipOn : styles.badgeChipOff,
      ]}
    >
      <Text style={styles.badgeChipIcon}>{props.icon}</Text>
      <Text style={styles.badgeChipText}>{props.title}</Text>
    </View>
  );
}

function PinnedGigCard(props: {
  label: string;
  gig: Gig | null;
  accent: string;
  emptyText: string;
  onChoose?: () => void;
}) {
  return (
    <View style={[styles.pinnedCard, { borderColor: props.accent }]}>
      <Text style={[styles.pinnedLabel, { color: props.accent }]}>
        {props.label}
      </Text>

      {props.gig ? (
        <>
          <Text style={styles.pinnedArtist}>{props.gig.artist}</Text>
          <Text style={styles.pinnedMeta}>
            {props.gig.venue} • {props.gig.city}
          </Text>
          <Text style={styles.pinnedDate}>{props.gig.date}</Text>
        </>
      ) : (
        <>
          <Text style={styles.pinnedEmpty}>{props.emptyText}</Text>

          {props.onChoose ? (
            <Pressable
              onPress={props.onChoose}
              style={({ pressed }) => [
                styles.chooseBtn,
                pressed ? { opacity: 0.85 } : null,
              ]}
            >
              <Text style={styles.chooseBtnText}>Choose from Gigs</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

export function ProfileScreen(props: {
  onPressLogo?: () => void;
  onGoToGigs?: () => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [stats, setStats] = React.useState<ReturnType<
    typeof computeProfileStats
  > | null>(null);

  const [gigs, setGigs] = React.useState<Gig[]>([]);
  const [firstGigId, setFirstGigId] = React.useState("");
  const [favouriteGigId, setFavouriteGigId] = React.useState("");

  const [displayName, setDisplayName] = React.useState("Nowar");
  const [homeCity, setHomeCity] = React.useState("");
  const [hapticsEnabled, setHapticsEnabled] = React.useState(true);

  const [savingPrefs, setSavingPrefs] = React.useState(false);

  const [avatarPickerVisible, setAvatarPickerVisible] = React.useState(false);
  const [avatarPreset, setAvatarPreset] = React.useState<string>("");
  const [avatarUri, setAvatarUri] = React.useState<string>("");

  const loadPrefs = React.useCallback(async () => {
    try {
      const [dn, hc, hap, preset, uri, firstId, favouriteId] = await Promise.all([
        AsyncStorage.getItem(DISPLAY_NAME_KEY),
        AsyncStorage.getItem(HOME_CITY_KEY),
        AsyncStorage.getItem(HAPTICS_KEY),
        AsyncStorage.getItem(AVATAR_PRESET_KEY),
        AsyncStorage.getItem(AVATAR_URI_KEY),
        AsyncStorage.getItem(FIRST_GIG_ID_KEY),
        AsyncStorage.getItem(FAVOURITE_GIG_ID_KEY),
      ]);

      if (dn && dn.trim()) setDisplayName(dn.trim());
      if (hc && hc.trim()) setHomeCity(hc.trim());
      if (preset && preset.trim()) setAvatarPreset(preset.trim());
      if (uri && uri.trim()) setAvatarUri(uri.trim());

      if (firstId && firstId.trim()) setFirstGigId(firstId.trim());
      else setFirstGigId("");

      if (favouriteId && favouriteId.trim()) setFavouriteGigId(favouriteId.trim());
      else setFavouriteGigId("");

      if (hap != null) {
        setHapticsEnabled(hap === "1");
      }
    } catch {}
  }, []);

  const savePrefs = React.useCallback(async () => {
    const nextName = displayName.trim();
    const nextCity = homeCity.trim();

    setSavingPrefs(true);
    try {
      if (nextName) await AsyncStorage.setItem(DISPLAY_NAME_KEY, nextName);
      else await AsyncStorage.removeItem(DISPLAY_NAME_KEY);

      if (nextCity) await AsyncStorage.setItem(HOME_CITY_KEY, nextCity);
      else await AsyncStorage.removeItem(HOME_CITY_KEY);

      await AsyncStorage.setItem(HAPTICS_KEY, hapticsEnabled ? "1" : "0");

      Alert.alert("Saved", "Preferences updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save preferences");
    } finally {
      setSavingPrefs(false);
    }
  }, [displayName, homeCity, hapticsEnabled]);

  const toggleHaptics = React.useCallback(async () => {
    const next = !hapticsEnabled;
    setHapticsEnabled(next);

    try {
      await AsyncStorage.setItem(HAPTICS_KEY, next ? "1" : "0");
    } catch {}

    if (next) {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
  }, [hapticsEnabled]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<GigsResponse>("/gigs");
      const nextGigs = res.gigs ?? [];
      setGigs(nextGigs);
      const s = computeProfileStats(nextGigs);
      setStats(s);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load profile");
      setStats(null);
      setGigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPrefs();
    void load();
  }, [load, loadPrefs]);

  const handlePickPreset = React.useCallback(async (presetId: string) => {
    setAvatarPreset(presetId);
    setAvatarUri("");
    setAvatarPickerVisible(false);

    try {
      await AsyncStorage.setItem(AVATAR_PRESET_KEY, presetId);
      await AsyncStorage.removeItem(AVATAR_URI_KEY);
    } catch {}
  }, []);

  const handleUploadAvatar = React.useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo library access to upload a profile picture.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const selected = result.assets?.[0];
      if (!selected?.uri) return;

      setAvatarUri(selected.uri);
      setAvatarPreset("");
      setAvatarPickerVisible(false);

      await AsyncStorage.setItem(AVATAR_URI_KEY, selected.uri);
      await AsyncStorage.removeItem(AVATAR_PRESET_KEY);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to upload photo");
    }
  }, []);

  const handleRemoveAvatar = React.useCallback(async () => {
    setAvatarUri("");
    setAvatarPreset("");
    setAvatarPickerVisible(false);

    try {
      await AsyncStorage.removeItem(AVATAR_URI_KEY);
      await AsyncStorage.removeItem(AVATAR_PRESET_KEY);
    } catch {}
  }, []);

  const handle = "@wegig";
  const location =
    homeCity.trim() ? homeCity.trim() : stats?.topCity ? stats.topCity : "—";

  const selectedPreset = avatarPresets.find((p) => p.id === avatarPreset);
  const firstGig = gigs.find((g) => g.id === firstGigId) ?? null;
  const favouriteGig = gigs.find((g) => g.id === favouriteGigId) ?? null;
  const metaLine =
    location && location !== "—" ? `${handle} · ${location}` : handle;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.profileHero}>
          <Pressable
            onPress={() => setAvatarPickerVisible(true)}
            style={({ pressed }) => [
              styles.avatar,
              pressed ? { opacity: 0.92 } : null,
            ]}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : selectedPreset ? (
              <Image source={selectedPreset.image} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {displayName.slice(0, 1).toUpperCase()}
              </Text>
            )}
          </Pressable>

          <View style={styles.profileHeroText}>
            <Text style={styles.name}>{displayName}</Text>

            <View
              style={[
                styles.statusPill,
                { backgroundColor: `${stats?.statusColor ?? "#6B7280"}22` },
                { borderColor: `${stats?.statusColor ?? "#6B7280"}55` },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: stats?.statusColor ?? "#6B7280" },
                ]}
              >
                {(stats?.statusIcon ?? "✨") + " " + (stats?.statusLabel ?? "New Fan")}
              </Text>
            </View>

            <Text style={styles.metaLine}>{metaLine}</Text>
          </View>
        </View>

        <View style={styles.slimRowCard}>
          <Text style={styles.slimLabel}>Total gigs</Text>
          <Text style={styles.slimValue}>{stats?.total ?? 0}</Text>
        </View>

        <SectionTitle title="Pinned gigs" />
        <View style={styles.pinnedGrid}>
          <PinnedGigCard
            label="First gig"
            gig={firstGig}
            accent="#2F8CFF"
            emptyText="Pick your first ever gig from Gigs."
            onChoose={() => props.onGoToGigs?.()}
          />

          <PinnedGigCard
            label="Favourite gig"
            gig={favouriteGig}
            accent="#8A5BFF"
            emptyText="Choose your all-time favourite from Gigs."
            onChoose={() => props.onGoToGigs?.()}
          />
        </View>

        <SectionTitle title="Preferences" />
        <View style={styles.card}>
          <View style={{ gap: 10 }}>
            <TextField
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. Fred Yacoub"
              autoCapitalize="words"
            />

            <TextField
              label="City (optional)"
              value={homeCity}
              onChangeText={setHomeCity}
              placeholder="e.g. Fleet"
              autoCapitalize="words"
            />

            <Text style={styles.muted}>
              Used to personalise Discover + “Next gig near you”.
            </Text>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Haptics</Text>
                <Text style={styles.toggleSubtitle}>
                  Vibrate on badge unlocks
                </Text>
              </View>

              <Switch
                value={hapticsEnabled}
                onValueChange={() => void toggleHaptics()}
                trackColor={{
                  false: "rgba(255,255,255,0.18)",
                  true: "rgba(46,229,157,0.35)",
                }}
                thumbColor={hapticsEnabled ? "#2EE59D" : "rgba(255,255,255,0.75)"}
                ios_backgroundColor="rgba(255,255,255,0.18)"
              />
            </View>

            <PrimaryButton
              title={savingPrefs ? "Saving…" : "Save preferences"}
              onPress={savePrefs}
              disabled={savingPrefs}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading…</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <SectionTitle title="Your stats" />
            <View style={styles.grid}>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Rated</Text>
                <Text style={styles.tileValue}>{stats?.ratedCount ?? 0}</Text>
              </View>

              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Avg rating</Text>
                <Text style={styles.tileValue}>
                  {stats?.avgRating == null ? "—" : stats.avgRating}
                </Text>
              </View>

              <View style={styles.tileWide}>
                <Text style={styles.tileLabel}>Top artist</Text>
                <Text style={styles.tileValueSmall}>
                  {stats?.topArtist ?? "—"}
                </Text>
              </View>

              <View style={styles.tileWide}>
                <Text style={styles.tileLabel}>Top venue</Text>
                <Text style={styles.tileValueSmall}>
                  {stats?.topVenue ?? "—"}
                </Text>
              </View>
            </View>

            <SectionTitle title="Highlights" />
            <View style={styles.card}>
              <View style={{ marginTop: 2 }}>
                {statLine("Top city", stats?.topCity ?? "—")}
                {statLine("Top venue", stats?.topVenue ?? "—")}
              </View>
            </View>

            <SectionTitle title="Badges" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgesScroll}
            >
              {(stats?.badges ?? []).map((badge) => (
                <BadgeChipView
                  key={badge.title}
                  title={badge.title}
                  icon={badge.icon}
                  unlocked={badge.unlocked}
                />
              ))}
            </ScrollView>

            <SectionTitle title="Account" />
            <View style={styles.card}>
              <ActionRow
                title="Sign in to sync"
                subtitle="Apple / Google / Facebook (next)"
                onPress={() => {}}
              />
              <ActionRow
                title="Export gigs"
                subtitle="CSV / share (next)"
                onPress={() => {}}
              />
              <ActionRow
                title="About WeGig"
                subtitle="Version, links (next)"
                onPress={() => {}}
              />
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <AvatarPickerModal
        visible={avatarPickerVisible}
        onClose={() => setAvatarPickerVisible(false)}
        onPickPreset={handlePickPreset}
        onUpload={handleUploadAvatar}
        onRemove={handleRemoveAvatar}
        showRemove={!!avatarPreset || !!avatarUri}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colours.background.app },

  body: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 12,
  },

  sectionTitle: {
    marginTop: 6,
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 0.2,
  },

  profileHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: Colours.background.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 16,
  },

  profileHeroText: {
    flex: 1,
    justifyContent: "center",
  },

  avatar: {
    width: 76,
    height: 76,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(47,140,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(47,140,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 28,
  },

  name: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 28,
  },
  statusPill: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.2,
  },
  metaLine: {
    marginTop: 8,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 14,
  },

  slimRowCard: {
    marginTop: 2,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slimLabel: {
    color: Colours.text.muted,
    fontWeight: "800",
  },
  slimValue: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 16,
  },

  pinnedGrid: {
    gap: 12,
  },
  pinnedCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  pinnedLabel: {
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  pinnedArtist: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 16,
  },
  pinnedMeta: {
    marginTop: 4,
    color: Colours.text.secondary,
    fontWeight: "700",
  },
  pinnedDate: {
    marginTop: 6,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  pinnedEmpty: {
    color: Colours.text.muted,
    fontWeight: "700",
    lineHeight: 20,
  },
  chooseBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },
  chooseBtnText: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 12,
  },

  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },

  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  tile: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },
  tileWide: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
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
    fontSize: 22,
  },
  tileValueSmall: {
    marginTop: 10,
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 14,
  },

  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colours.ui.divider ?? Colours.ui.border,
  },
  statLabel: {
    color: Colours.text.muted,
    fontWeight: "800",
    flex: 1,
  },
  statValue: {
    color: Colours.text.primary,
    fontWeight: "900",
  },

  badgesScroll: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  badgeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
  },
  badgeChipOn: {
    backgroundColor: "rgba(47,140,255,0.18)",
    borderColor: "rgba(47,140,255,0.45)",
  },
  badgeChipOff: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: Colours.ui.border,
    opacity: 0.5,
  },
  badgeChipIcon: {
    marginRight: 6,
    fontSize: 13,
  },
  badgeChipText: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 12,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colours.ui.divider ?? Colours.ui.border,
  },
  actionTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
  },
  actionSubtitle: {
    marginTop: 3,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  chevron: {
    color: Colours.text.muted,
    fontWeight: "900",
    fontSize: 18,
  },

  toggleRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: Platform.OS === "ios" ? 6 : 2,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  toggleTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
  },
  toggleSubtitle: {
    marginTop: 4,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
  },

  muted: { color: Colours.text.muted, fontWeight: "800" },
  error: { color: Colours.text.danger, fontWeight: "900" },
});