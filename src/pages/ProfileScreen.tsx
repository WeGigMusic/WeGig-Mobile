import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Switch,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import ViewShot, { captureRef } from "react-native-view-shot";

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

type ProfileScreenProps = {
  onPressLogo?: () => void;
  onGoToGigs?: () => void;
  onOpenAbout?: () => void;
  onOpenHelp?: () => void;
  onOpenFeedback?: () => void;
};

function computeProfileStats(gigs: Gig[]) {
  const total = gigs.length;

  const rated = gigs.filter((g) => typeof g.rating === "number") as Array<
    Gig & { rating: number }
  >;

  const cities = gigs.reduce<Record<string, number>>((acc, g) => {
    const k = (g.city ?? "").trim() || "Unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const cityEntries = Object.entries(cities).sort((a, b) => b[1] - a[1]);
  const topCity = cityEntries[0]?.[0];
  const cityCount = Object.keys(cities).length;

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

  return {
    total,
    topCity,
    statusLabel,
    statusColor,
    statusIcon,
  };
}

function ActionRow(props: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={!props.onPress}
      style={({ pressed }) => [
        styles.actionRow,
        props.isLast ? styles.actionRowLast : null,
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

export function ProfileScreen({
  onPressLogo,
  onGoToGigs,
  onOpenAbout,
  onOpenHelp,
  onOpenFeedback,
}: ProfileScreenProps) {
  const shareCardRef = React.useRef<ViewShot | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<ReturnType<
    typeof computeProfileStats
  > | null>(null);

  const [displayName, setDisplayName] = React.useState("Nowar");
  const [homeCity, setHomeCity] = React.useState("");
  const [hapticsEnabled, setHapticsEnabled] = React.useState(true);

  const [savingPrefs, setSavingPrefs] = React.useState(false);
  const [sharingProfile, setSharingProfile] = React.useState(false);

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
    } catch {}
  }, []);

  const savePrefs = React.useCallback(async () => {
    const nextName = displayName.trim();
    const nextCity = homeCity.trim();

    setSavingPrefs(true);
    try {
      if (nextName) {
        await AsyncStorage.setItem(DISPLAY_NAME_KEY, nextName);
      } else {
        await AsyncStorage.removeItem(DISPLAY_NAME_KEY);
      }

      if (nextCity) {
        await AsyncStorage.setItem(HOME_CITY_KEY, nextCity);
      } else {
        await AsyncStorage.removeItem(HOME_CITY_KEY);
      }

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
    try {
      const res = await apiGet<GigsResponse>("/gigs");
      const nextGigs = res.gigs ?? [];
      setStats(computeProfileStats(nextGigs));
    } catch {
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
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo library access to upload a profile picture."
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

  const handleChangePassword = React.useCallback(() => {
    Alert.alert(
      "Change password",
      "This will be available once email login is set up."
    );
  }, []);

  const handleLogout = React.useCallback(() => {
    Alert.alert("Log out", "Log out will be added once auth is connected.");
  }, []);

  const handleSignIn = React.useCallback(() => {
    Alert.alert("Sign in", "Sign in to sync will be added next.");
  }, []);

  const handleExportGigs = React.useCallback(() => {
    Alert.alert("Export gigs", "Gig export is planned for a future update.");
  }, []);

  const handleHelp = React.useCallback(() => {
    if (onOpenHelp) {
      onOpenHelp();
      return;
    }

    Alert.alert("Help", "Help centre coming soon.");
  }, [onOpenHelp]);

  const handleFeedback = React.useCallback(() => {
    if (onOpenFeedback) {
      onOpenFeedback();
      return;
    }

    Alert.alert("Feedback", "Feedback form coming soon.");
  }, [onOpenFeedback]);

  const handleShareProfile = React.useCallback(async () => {
    if (!shareCardRef.current || sharingProfile) return;

    setSharingProfile(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Unavailable", "Sharing is not available on this device.");
        return;
      }

      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      await Sharing.shareAsync(uri);
    } catch (e: any) {
      Alert.alert("Share failed", e?.message ?? "Could not share profile.");
    } finally {
      setSharingProfile(false);
    }
  }, [sharingProfile]);

  const handle = "@wegig";
  const location = homeCity.trim() || stats?.topCity || "—";
  const totalGigs = stats?.total ?? 0;

  const selectedPreset = avatarPresets.find((p) => p.id === avatarPreset);
  const metaLine = location !== "—" ? `${handle} · ${location}` : handle;

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
            <View style={styles.heroTopRow}>
              <View style={styles.nameAndStatus}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{displayName}</Text>

                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: `${stats?.statusColor ?? "#6B7280"}22`,
                        borderColor: `${stats?.statusColor ?? "#6B7280"}55`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: stats?.statusColor ?? "#6B7280" },
                      ]}
                    >
                      {(stats?.statusIcon ?? "✨") +
                        " " +
                        (stats?.statusLabel ?? "New Fan")}
                    </Text>
                  </View>
                </View>

                <Text style={styles.metaLine}>{metaLine}</Text>
              </View>

              <Pressable
                onPress={() => void handleShareProfile()}
                style={({ pressed }) => [
                  styles.shareButton,
                  pressed ? { opacity: 0.78 } : null,
                  sharingProfile ? { opacity: 0.5 } : null,
                ]}
                hitSlop={10}
              >
                <Ionicons
                  name="share-outline"
                  size={14}
                  color={Colours.text.muted}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading profile…</Text>
          </View>
        ) : null}

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
                thumbColor={
                  hapticsEnabled ? "#2EE59D" : "rgba(255,255,255,0.75)"
                }
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

        <SectionTitle title="Account" />
        <View style={styles.card}>
          <ActionRow
            title="Sign in to sync"
            subtitle="Apple, Google, Facebook or email"
            onPress={handleSignIn}
          />
          <ActionRow
            title="Change password"
            subtitle="Email login only (coming soon)"
            onPress={handleChangePassword}
          />
          <ActionRow
            title="Log out"
            subtitle="Coming soon"
            onPress={handleLogout}
            isLast
          />
        </View>

        <SectionTitle title="Support" />
        <View style={styles.card}>
          <ActionRow
            title="About WeGig"
            subtitle="Story, version, privacy"
            onPress={onOpenAbout}
          />
          <ActionRow
            title="Help"
            subtitle="FAQs and support"
            onPress={handleHelp}
          />
          <ActionRow
            title="Send feedback"
            subtitle="Ideas, bugs and suggestions"
            onPress={handleFeedback}
          />
          <ActionRow
            title="Export gigs"
            subtitle="CSV / share (next)"
            onPress={handleExportGigs}
            isLast
          />
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>

      <View style={styles.hiddenShareLayer} pointerEvents="none">
        <ViewShot ref={shareCardRef} options={{ format: "png", quality: 1 }}>
          <View style={styles.shareCard}>
            <View style={styles.shareCardHeader}>
              <Image
                source={require("../../assets/wegig-logo.png")}
                style={styles.shareCardLogo}
                resizeMode="contain"
              />
              <Text style={styles.shareCardTag}>Live music memories</Text>
            </View>

            <View style={styles.shareCardProfileRow}>
              <View style={styles.shareCardAvatar}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.shareCardAvatarImage}
                  />
                ) : selectedPreset ? (
                  <Image
                    source={selectedPreset.image}
                    style={styles.shareCardAvatarImage}
                  />
                ) : (
                  <Text style={styles.shareCardAvatarText}>
                    {displayName.slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.shareCardName}>{displayName}</Text>
                <Text style={styles.shareCardMeta}>{metaLine}</Text>
                <Text
                  style={[
                    styles.shareCardStatus,
                    { color: stats?.statusColor ?? "#6B7280" },
                  ]}
                >
                  {(stats?.statusIcon ?? "✨") +
                    " " +
                    (stats?.statusLabel ?? "New Fan")}
                </Text>
              </View>
            </View>

            <View style={styles.shareCardStatsRow}>
              <View style={styles.shareCardStat}>
                <Text style={styles.shareCardStatValue}>{totalGigs}</Text>
                <Text style={styles.shareCardStatLabel}>Gigs logged</Text>
              </View>

              <View style={styles.shareCardDivider} />

              <View style={styles.shareCardStat}>
                <Text style={styles.shareCardStatValue}>
                  {stats?.topCity ?? "—"}
                </Text>
                <Text style={styles.shareCardStatLabel}>Top city</Text>
              </View>
            </View>

            <Text style={styles.shareCardFooter}>Tracked with WeGig</Text>
          </View>
        </ViewShot>
      </View>

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
  safe: {
    flex: 1,
    backgroundColor: Colours.background.app,
  },

  body: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 88,
    gap: 12,
  },

  sectionTitle: {
    marginTop: 2,
    marginBottom: 2,
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: 0.2,
  },

  profileHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colours.background.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },

  profileHeroText: {
    flex: 1,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  nameAndStatus: {
    flex: 1,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  avatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
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
    fontWeight: "800",
    fontSize: 24,
    lineHeight: 28,
  },

  name: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 22,
    lineHeight: 26,
    flexShrink: 1,
    paddingRight: 10,
  },

  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 8,
  },

  statusPillText: {
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.1,
  },

  metaLine: {
    marginTop: 8,
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 17,
  },

  shareButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginTop: 3,
  },

  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },

  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colours.ui.divider ?? Colours.ui.border,
  },

  actionRowLast: {
    borderBottomWidth: 0,
  },

  actionTitle: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
  },

  actionSubtitle: {
    marginTop: 3,
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 17,
  },

  chevron: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 17,
    lineHeight: 20,
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
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
  },

  toggleSubtitle: {
    marginTop: 4,
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 16,
  },

  muted: {
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 18,
  },

  hiddenShareLayer: {
    position: "absolute",
    left: -9999,
    top: -9999,
    opacity: 0,
  },

  shareCard: {
    width: 1080,
    backgroundColor: "#0B0B0F",
    padding: 72,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  shareCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 56,
  },

  shareCardLogo: {
    width: 220,
    height: 72,
  },

  shareCardTag: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 28,
    fontWeight: "600",
  },

  shareCardProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    marginBottom: 56,
  },

  shareCardAvatar: {
    width: 132,
    height: 132,
    borderRadius: 36,
    overflow: "hidden",
    backgroundColor: "rgba(47,140,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(47,140,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  shareCardAvatarImage: {
    width: "100%",
    height: "100%",
  },

  shareCardAvatarText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 46,
  },

  shareCardName: {
    color: "#fff",
    fontSize: 56,
    fontWeight: "800",
    lineHeight: 62,
    marginBottom: 10,
  },

  shareCardMeta: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 12,
  },

  shareCardStatus: {
    fontSize: 30,
    fontWeight: "700",
  },

  shareCardStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 32,
    paddingVertical: 34,
    paddingHorizontal: 38,
    marginBottom: 42,
  },

  shareCardStat: {
    flex: 1,
  },

  shareCardStatValue: {
    color: "#fff",
    fontSize: 44,
    fontWeight: "800",
    lineHeight: 50,
    marginBottom: 8,
  },

  shareCardStatLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 24,
    fontWeight: "600",
  },

  shareCardDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 24,
  },

  shareCardFooter: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 24,
    fontWeight: "600",
  },
});