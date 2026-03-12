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

import { AppHeader } from "../components/AppHeader";
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
  const topCity = Object.entries(cities).sort((a, b) => b[1] - a[1])[0]?.[0];

  const venues = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.venue ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topVenue = Object.entries(venues).sort((a, b) => b[1] - a[1])[0]?.[0];

  const artists = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.artist ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topArtist =
    Object.entries(artists).sort((a, b) => b[1] - a[1])[0]?.[0];

  const badges: Array<{ title: string; subtitle: string }> = [];
  if (total >= 1) badges.push({ title: "First Gig", subtitle: "Logged 1 gig" });
  if (total >= 5) badges.push({ title: "Gig Regular", subtitle: "5+ gigs" });
  if (total >= 10) badges.push({ title: "Scene Member", subtitle: "10+ gigs" });
  if (rated.length >= 3)
    badges.push({ title: "Reviewer", subtitle: "Rated 3+ gigs" });
  if (Object.keys(cities).length >= 3)
    badges.push({ title: "Explorer", subtitle: "3+ cities" });

  return {
    total,
    ratedCount: rated.length,
    avgRating,
    topCity,
    topVenue,
    topArtist,
    badges: badges.slice(0, 6),
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

export function ProfileScreen(props: { onPressLogo?: () => void }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [stats, setStats] = React.useState<ReturnType<
    typeof computeProfileStats
  > | null>(null);

  // Preferences
  const [displayName, setDisplayName] = React.useState("Nowar");
  const [homeCity, setHomeCity] = React.useState("");
  const [hapticsEnabled, setHapticsEnabled] = React.useState(true);

  const [savingPrefs, setSavingPrefs] = React.useState(false);

  // Avatar
  const [avatarPickerVisible, setAvatarPickerVisible] = React.useState(false);
  const [avatarPreset, setAvatarPreset] = React.useState<string>("");
  const [avatarUri, setAvatarUri] = React.useState<string>("");

  const loadPrefs = React.useCallback(async () => {
    try {
      const [dn, hc, hap, preset, uri] = await Promise.all([
        AsyncStorage.getItem(DISPLAY_NAME_KEY),
        AsyncStorage.getItem(HOME_CITY_KEY),
        AsyncStorage.getItem(HAPTICS_KEY),
        AsyncStorage.getItem(AVATAR_PRESET_KEY),
        AsyncStorage.getItem(AVATAR_URI_KEY),
      ]);

      if (dn && dn.trim()) setDisplayName(dn.trim());
      if (hc && hc.trim()) setHomeCity(hc.trim());
      if (preset && preset.trim()) setAvatarPreset(preset.trim());
      if (uri && uri.trim()) setAvatarUri(uri.trim());

      if (hap != null) {
        setHapticsEnabled(hap === "1");
      }
    } catch {
      // ignore
    }
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
      const s = computeProfileStats(res.gigs ?? []);
      setStats(s);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load profile");
      setStats(null);
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
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

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

  const handle = "@wegig"; // placeholder
  const location =
    homeCity.trim() ? homeCity.trim() : stats?.topCity ? stats.topCity : "—";

  const selectedPreset = avatarPresets.find((p) => p.id === avatarPreset);

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader title="Profile" onPressLogo={props.onPressLogo} />

      <ScrollView contentContainerStyle={styles.body}>
        {/* Top summary row (Replit-ish) */}
        <View style={styles.topRow}>
          <Pressable
            onPress={() => setAvatarPickerVisible(true)}
            style={({ pressed }) => [
              styles.avatar,
              pressed ? { opacity: 0.9 } : null,
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

          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.handle}>{handle}</Text>
            <Text style={styles.location}> {location ? ` ${location}` : "—"}</Text>
          </View>
        </View>

        {/* Total gigs row (like screenshot “Total gigs … 0”) */}
        <View style={styles.slimRowCard}>
          <Text style={styles.slimLabel}>Total gigs</Text>
          <Text style={styles.slimValue}>{stats?.total ?? 0}</Text>
        </View>

        {/* Preferences */}
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
              Used to personalize Discover + “Next gig near you”.
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
            <View style={styles.card}>
              <View style={styles.badgeWrap}>
                {(stats?.badges ?? []).length === 0 ? (
                  <Text style={styles.muted}>Log a few gigs to unlock badges.</Text>
                ) : (
                  (stats?.badges ?? []).map((b) => (
                    <View style={styles.badge} key={b.title}>
                      <Text style={styles.badgeTitle}>{b.title}</Text>
                      <Text style={styles.badgeSubtitle}>{b.subtitle}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>

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

  topRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "transparent",
    alignItems: "center",
    marginTop: 2,
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(47,140,255,0.25)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
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
    fontSize: 22,
  },

  name: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 18,
  },
  handle: {
    marginTop: 3,
    color: Colours.text.muted,
    fontWeight: "800",
  },
  location: {
    marginTop: 6,
    color: Colours.text.secondary,
    fontWeight: "700",
  },

  slimRowCard: {
    marginTop: 8,
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

  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badge: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
    borderRadius: 16,
    padding: 12,
  },
  badgeTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
  },
  badgeSubtitle: {
    marginTop: 6,
    color: Colours.text.muted,
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