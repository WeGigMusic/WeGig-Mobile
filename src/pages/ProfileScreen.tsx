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
  Share,
  Linking,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import ViewShot, { captureRef } from "react-native-view-shot";

import { PrimaryButton } from "../components/PrimaryButton";
import { AvatarPickerModal } from "../components/AvatarPickerModal";
import { Colours } from "../theme/colours";
import { apiGet } from "../lib/api";
import { supabase } from "../lib/supabase";
import { posthog } from "../lib/analytics";
import { syncGigReminderNotifications } from "../lib/notifications";
import type { GigsResponse, Gig } from "../shared/types/Gig";
import { avatarPresets } from "../config/avatarPresets";

const DISPLAY_NAME_KEY = "wegig.displayName";
const HAPTICS_KEY = "wegig.hapticsEnabled";
const AVATAR_PRESET_KEY = "wegig.avatarPreset";
const AVATAR_URI_KEY = "wegig.avatarUri";
const FIRST_GIG_ID_KEY = "wegig.firstGigId";
const FAVOURITE_GIG_ID_KEY = "wegig.favouriteGigId";
const NOTIFY_GIG_REMINDER_KEY = "wegig.notifyGigReminder";
const NOTIFY_RATE_REMINDER_KEY = "wegig.notifyRateReminder";
const INCLUDE_TRIBUTE_ACTS_KEY = "wegig.includeTributeActs";

const WEGIG_INSTAGRAM_URL = "https://www.instagram.com/wegigmusic/";
const WEGIG_FACEBOOK_URL =
  "https://www.facebook.com/profile.php?id=61584065319390&sk=about";
const WEGIG_STORY_URL = "https://www.wegig.live/story/";
const WEGIG_PRIVACY_URL = "https://www.wegig.live/privacy/";
const WEGIG_FEEDBACK_URL = "https://www.wegig.live/feedback/";
const APP_VERSION = "v0.1.0";

const SWITCH_TRACK_COLORS = {
  false: "rgba(255,255,255,0.20)",
  true: "rgba(47,140,255,0.35)",
};

type ProfileScreenProps = {
  onPressLogo?: () => void;
  onGoToGigs?: () => void;
  scrollToTopSignal?: number;
};

function computeProfileStats(gigs: Gig[]) {
  const total = gigs.length;

  const byArtist = gigs.reduce<Record<string, number>>((acc, gig) => {
    const key = (gig.artist ?? "").trim() || "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const byVenue = gigs.reduce<Record<string, number>>((acc, gig) => {
    const key = (gig.venue ?? "").trim() || "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const topArtist =
    Object.entries(byArtist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const topVenue =
    Object.entries(byVenue).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return {
    total,
    topArtist,
    topVenue,
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

      <Ionicons name="chevron-forward" size={16} color={Colours.text.muted} />
    </Pressable>
  );
}

function SectionTitle(props: { title: string }) {
  return <Text style={styles.sectionTitle}>{props.title}</Text>;
}

function formatDisplayDate(date = new Date()) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toSafeFileName(value: string) {
  return (
    String(value)
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "Music Fan"
  );
}

function csvCell(value: unknown) {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildGigCsv(params: {
  gigs: Gig[];
  firstGigId?: string;
  favouriteGigId?: string;
}) {
  const { gigs, firstGigId = "", favouriteGigId = "" } = params;

  const headers = [
    "Date",
    "Artist",
    "Venue",
    "City",
    "Rating",
    "Notes",
    "First Gig",
    "Favourite Gig",
    "Source",
    "External ID",
    "Ticket URL",
  ];

  const rows = gigs.map((gig) => [
    gig.date ?? "",
    gig.artist ?? "",
    gig.venue ?? "",
    gig.city ?? "",
    typeof gig.rating === "number" ? String(gig.rating) : "",
    gig.notes ?? "",
    gig.id === firstGigId ? "Yes" : "",
    gig.id === favouriteGigId ? "Yes" : "",
    gig.externalSource ?? "Manual",
    gig.externalId ?? "",
    gig.ticketUrl ?? "",
  ]);

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

export function ProfileScreen({ scrollToTopSignal }: ProfileScreenProps) {
  const shareCardRef = React.useRef<ViewShot | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);

  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<ReturnType<
    typeof computeProfileStats
  > | null>(null);
  const [allGigs, setAllGigs] = React.useState<Gig[]>([]);

  const [displayName, setDisplayName] = React.useState("Music Fan");
  const [editingDisplayName, setEditingDisplayName] = React.useState(false);
  const [draftDisplayName, setDraftDisplayName] = React.useState("");

  const [hapticsEnabled, setHapticsEnabled] = React.useState(true);
  const [gigReminderEnabled, setGigReminderEnabled] = React.useState(true);
  const [rateReminderEnabled, setRateReminderEnabled] = React.useState(true);
  const [includeTributeActs, setIncludeTributeActs] = React.useState(false);

  const [savingPrefs, setSavingPrefs] = React.useState(false);
  const [sharingProfile, setSharingProfile] = React.useState(false);
  const [exportingGigs, setExportingGigs] = React.useState(false);

  const [avatarPickerVisible, setAvatarPickerVisible] = React.useState(false);
  const [avatarPreset, setAvatarPreset] = React.useState<string>("");
  const [avatarUri, setAvatarUri] = React.useState<string>("");

  const [firstGigId, setFirstGigId] = React.useState("");
  const [favouriteGigId, setFavouriteGigId] = React.useState("");

  const loadPrefs = React.useCallback(async () => {
    try {
      const [dn, hap, preset, uri, notifyGig, notifyRate, includeTributes] =
        await Promise.all([
          AsyncStorage.getItem(DISPLAY_NAME_KEY),
          AsyncStorage.getItem(HAPTICS_KEY),
          AsyncStorage.getItem(AVATAR_PRESET_KEY),
          AsyncStorage.getItem(AVATAR_URI_KEY),
          AsyncStorage.getItem(NOTIFY_GIG_REMINDER_KEY),
          AsyncStorage.getItem(NOTIFY_RATE_REMINDER_KEY),
          AsyncStorage.getItem(INCLUDE_TRIBUTE_ACTS_KEY),
        ]);

      if (dn && dn.trim()) setDisplayName(dn.trim());

      if (preset && preset.trim()) {
        setAvatarPreset(preset.trim());
      } else if (!uri?.trim() && avatarPresets.length > 0) {
        const randomPreset =
          avatarPresets[Math.floor(Math.random() * avatarPresets.length)];

        setAvatarPreset(randomPreset.id);
        await AsyncStorage.setItem(AVATAR_PRESET_KEY, randomPreset.id).catch(
          () => {},
        );
      }

      if (uri && uri.trim()) setAvatarUri(uri.trim());

      if (hap != null) setHapticsEnabled(hap === "1");
      if (notifyGig != null) setGigReminderEnabled(notifyGig === "1");
      if (notifyRate != null) setRateReminderEnabled(notifyRate === "1");
      if (includeTributes != null) setIncludeTributeActs(includeTributes === "1");
    } catch {}
  }, []);

  const loadPinnedGigIds = React.useCallback(async () => {
    try {
      const [firstId, favouriteId] = await Promise.all([
        AsyncStorage.getItem(FIRST_GIG_ID_KEY),
        AsyncStorage.getItem(FAVOURITE_GIG_ID_KEY),
      ]);

      setFirstGigId(firstId ?? "");
      setFavouriteGigId(favouriteId ?? "");
    } catch {
      setFirstGigId("");
      setFavouriteGigId("");
    }
  }, []);

  const savePrefs = React.useCallback(async () => {
    const nextName = displayName.trim();

    setSavingPrefs(true);
    try {
      if (nextName) {
        await AsyncStorage.setItem(DISPLAY_NAME_KEY, nextName);
      } else {
        await AsyncStorage.removeItem(DISPLAY_NAME_KEY);
      }

      await AsyncStorage.setItem(HAPTICS_KEY, hapticsEnabled ? "1" : "0");
      await AsyncStorage.setItem(
        NOTIFY_GIG_REMINDER_KEY,
        gigReminderEnabled ? "1" : "0",
      );
      await AsyncStorage.setItem(
        NOTIFY_RATE_REMINDER_KEY,
        rateReminderEnabled ? "1" : "0",
      );
      await AsyncStorage.setItem(
        INCLUDE_TRIBUTE_ACTS_KEY,
        includeTributeActs ? "1" : "0",
      );

      Alert.alert("Saved", "Preferences updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save preferences");
    } finally {
      setSavingPrefs(false);
    }
  }, [
    displayName,
    hapticsEnabled,
    gigReminderEnabled,
    rateReminderEnabled,
    includeTributeActs,
  ]);

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

  const toggleGigReminder = React.useCallback(async () => {
    const next = !gigReminderEnabled;
    setGigReminderEnabled(next);

    try {
      await AsyncStorage.setItem(NOTIFY_GIG_REMINDER_KEY, next ? "1" : "0");
    } catch {}

    if (hapticsEnabled) {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
  }, [gigReminderEnabled, hapticsEnabled]);

  const toggleRateReminder = React.useCallback(async () => {
    const next = !rateReminderEnabled;
    setRateReminderEnabled(next);

    try {
      await AsyncStorage.setItem(NOTIFY_RATE_REMINDER_KEY, next ? "1" : "0");
    } catch {}

    if (hapticsEnabled) {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
  }, [rateReminderEnabled, hapticsEnabled]);

  const toggleIncludeTributeActs = React.useCallback(async () => {
    const next = !includeTributeActs;
    setIncludeTributeActs(next);

    try {
      await AsyncStorage.setItem(INCLUDE_TRIBUTE_ACTS_KEY, next ? "1" : "0");
    } catch {}

    if (hapticsEnabled) {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
  }, [includeTributeActs, hapticsEnabled]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<GigsResponse>("/gigs");
      const nextGigs = res.gigs ?? [];
      setAllGigs(nextGigs);
      setStats(computeProfileStats(nextGigs));
    } catch {
      setAllGigs([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPrefs();
    void load();
    void loadPinnedGigIds();
  }, [load, loadPinnedGigIds, loadPrefs]);

  React.useEffect(() => {
    if (scrollToTopSignal == null) return;

    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }, [scrollToTopSignal]);

  React.useEffect(() => {
    if (loading) return;
    void syncGigReminderNotifications(allGigs);
  }, [allGigs, gigReminderEnabled, rateReminderEnabled, loading]);

  const startEditingDisplayName = React.useCallback(() => {
    setDraftDisplayName(displayName);
    setEditingDisplayName(true);
  }, [displayName]);

  const saveDisplayName = React.useCallback(async () => {
    const next = draftDisplayName.trim() || "Music Fan";

    setDisplayName(next);
    setEditingDisplayName(false);

    try {
      await AsyncStorage.setItem(DISPLAY_NAME_KEY, next);
    } catch {}

    if (hapticsEnabled) {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
  }, [draftDisplayName, hapticsEnabled]);

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

  const openExternalLink = React.useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert("Unavailable", "Couldn't open that link right now.");
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("Unavailable", "Couldn't open that link right now.");
    }
  }, []);

  const handleChangePassword = React.useCallback(() => {
    Alert.alert("Change password", "This will be available soon.");
  }, []);

  const handleLogout = React.useCallback(() => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.auth.signOut();

            posthog.capture("logout_completed");
            posthog.reset();
          } catch (e: any) {
            Alert.alert("Logout failed", e?.message ?? "Please try again.");
          }
        },
      },
    ]);
  }, []);

  const handleExportGigs = React.useCallback(async () => {
    if (exportingGigs) return;

    setExportingGigs(true);
    try {
      const res = await apiGet<GigsResponse>("/gigs");
      const gigs = res.gigs ?? [];

      if (gigs.length === 0) {
        Alert.alert(
          "No gigs to export",
          "Log a gig first, then export your list.",
        );
        return;
      }

      const csv = buildGigCsv({
        gigs,
        firstGigId,
        favouriteGigId,
      });

      const exportDate = formatDisplayDate(new Date());
      const safeDate = exportDate.replace(/\s+/g, "-");
      const fileName = `wegig-attended-gigs-${safeDate}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Export attended gigs",
          UTI: "public.comma-separated-values-text",
        });
        return;
      }

      await Share.share({
        title: "Export attended gigs",
        message:
          Platform.OS === "android"
            ? `My WeGig attended gigs export\n${fileUri}`
            : "My WeGig attended gigs export",
        url: fileUri,
      });
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Could not export gigs.");
    } finally {
      setExportingGigs(false);
    }
  }, [exportingGigs, favouriteGigId, firstGigId]);

  const handleOpenStory = React.useCallback(() => {
    void openExternalLink(WEGIG_STORY_URL);
  }, [openExternalLink]);

  const handleOpenPrivacy = React.useCallback(() => {
    void openExternalLink(WEGIG_PRIVACY_URL);
  }, [openExternalLink]);

  const handleFeedback = React.useCallback(() => {
    void openExternalLink(WEGIG_FEEDBACK_URL);
  }, [openExternalLink]);

  const handleShareProfile = React.useCallback(async () => {
    if (!shareCardRef.current || sharingProfile) return;

    setSharingProfile(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Unavailable", "Sharing is not available on this device.");
        return;
      }

      const rawName = displayName.trim() || "Music Fan";
      const fileName = `${toSafeFileName(rawName)}.png`;
      const targetUri = `${FileSystem.cacheDirectory}${fileName}`;

      const tempUri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      try {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      } catch {}

      await FileSystem.copyAsync({
        from: tempUri,
        to: targetUri,
      });

      const shareMessage =
        "Check out my WeGig profile 🎶\nDownload the app: https://wegig.live";

      await Share.share(
        {
          title: `${rawName}'s gig stats`,
          message:
            Platform.OS === "android"
              ? `${shareMessage}\n${targetUri}`
              : shareMessage,
          url: targetUri,
        },
        {
          dialogTitle: `${rawName}'s gig stats`,
          subject: `${rawName}'s gig stats`,
        },
      );
    } catch (e: any) {
      Alert.alert("Share failed", e?.message ?? "Could not share profile.");
    } finally {
      setSharingProfile(false);
    }
  }, [displayName, sharingProfile]);

  const rawDisplayName = displayName.trim() || "Music Fan";
  const totalGigs = stats?.total ?? 0;
  const topArtist = stats?.topArtist ?? "—";
  const topVenue = stats?.topVenue ?? "—";
  const selectedPreset = avatarPresets.find((p) => p.id === avatarPreset);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.body}>
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
                {rawDisplayName.slice(0, 1).toUpperCase()}
              </Text>
            )}
          </Pressable>

          <View style={styles.profileHeroText}>
            <View style={styles.nameWithShareRow}>
              {editingDisplayName ? (
                <TextInput
                  value={draftDisplayName}
                  onChangeText={setDraftDisplayName}
                  autoFocus
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={() => void saveDisplayName()}
                  onBlur={() => void saveDisplayName()}
                  style={styles.nameInput}
                  placeholder="Display name"
                  placeholderTextColor={Colours.text.muted}
                />
              ) : (
                <Pressable
                  onPress={startEditingDisplayName}
                  style={({ pressed }) => [
                    styles.editNameButton,
                    pressed ? { opacity: 0.82 } : null,
                  ]}
                >
                  <Text style={styles.name}>{rawDisplayName}</Text>
                </Pressable>
              )}

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
                  size={13}
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
            <View style={styles.toggleGroup}>
              <View style={styles.toggleRowNoBorder}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Haptics</Text>
                  <Text style={styles.toggleSubtitle}>
                    Vibrate on badge unlocks
                  </Text>
                </View>

                <Switch
                  value={hapticsEnabled}
                  onValueChange={() => void toggleHaptics()}
                  trackColor={SWITCH_TRACK_COLORS}
                  thumbColor={hapticsEnabled ? "#2F8CFF" : "#FFFFFF"}
                  ios_backgroundColor={SWITCH_TRACK_COLORS.false}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Gig reminders</Text>
                  <Text style={styles.toggleSubtitle}>
                    Get a reminder the day before gigs
                  </Text>
                </View>

                <Switch
                  value={gigReminderEnabled}
                  onValueChange={() => void toggleGigReminder()}
                  trackColor={SWITCH_TRACK_COLORS}
                  thumbColor={gigReminderEnabled ? "#2F8CFF" : "#FFFFFF"}
                  ios_backgroundColor={SWITCH_TRACK_COLORS.false}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Rate your gigs</Text>
                  <Text style={styles.toggleSubtitle}>
                    Get a reminder after to log your rating
                  </Text>
                </View>

                <Switch
                  value={rateReminderEnabled}
                  onValueChange={() => void toggleRateReminder()}
                  trackColor={SWITCH_TRACK_COLORS}
                  thumbColor={rateReminderEnabled ? "#2F8CFF" : "#FFFFFF"}
                  ios_backgroundColor={SWITCH_TRACK_COLORS.false}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Include tribute acts</Text>
                  <Text style={styles.toggleSubtitle}>
                    Show tribute bands in search results
                  </Text>
                </View>

                <Switch
                  value={includeTributeActs}
                  onValueChange={() => void toggleIncludeTributeActs()}
                  trackColor={SWITCH_TRACK_COLORS}
                  thumbColor={includeTributeActs ? "#2F8CFF" : "#FFFFFF"}
                  ios_backgroundColor={SWITCH_TRACK_COLORS.false}
                />
              </View>
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
            title="Change password"
            subtitle="Email login only (coming soon)"
            onPress={handleChangePassword}
          />
          <ActionRow
            title="Log out"
            subtitle="Sign out of this device"
            onPress={handleLogout}
            isLast
          />
        </View>

        <SectionTitle title="Support" />
        <View style={styles.card}>
          <ActionRow
            title="Our story"
            subtitle="Why WeGig exists"
            onPress={handleOpenStory}
          />
          <ActionRow
            title="Privacy policy"
            subtitle="How your data is handled"
            onPress={handleOpenPrivacy}
          />
          <ActionRow
            title="Send feedback"
            subtitle="Ideas, bugs and suggestions"
            onPress={handleFeedback}
          />
          <ActionRow
            title={
              exportingGigs
                ? "Exporting attended gigs…"
                : "Export attended gigs"
            }
            subtitle="Download a CSV of your gig history"
            onPress={() => void handleExportGigs()}
            isLast
          />
        </View>

        <View style={styles.socialLinksRow}>
          <Pressable
            onPress={() => void openExternalLink(WEGIG_INSTAGRAM_URL)}
            style={({ pressed }) => [
              styles.socialIconLink,
              pressed ? { opacity: 0.75 } : null,
            ]}
            hitSlop={12}
          >
            <Ionicons
              name="logo-instagram"
              size={34}
              color={Colours.text.primary}
            />
            <Text style={styles.socialIconLabel}>@wegigmusic</Text>
          </Pressable>

          <Pressable
            onPress={() => void openExternalLink(WEGIG_FACEBOOK_URL)}
            style={({ pressed }) => [
              styles.socialIconLink,
              pressed ? { opacity: 0.75 } : null,
            ]}
            hitSlop={12}
          >
            <Ionicons
              name="logo-facebook"
              size={34}
              color={Colours.text.primary}
            />
            <Text style={styles.socialIconLabel}>@wegig</Text>
          </Pressable>
        </View>

        <Text style={styles.versionText}>WeGig {APP_VERSION}</Text>
        <View style={{ height: 20 }} />
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
                    {rawDisplayName.slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.shareCardName}>
                  {`${rawDisplayName}'s gig stats`}
                </Text>
              </View>
            </View>

            <View style={styles.shareCardStatsRow}>
              <View style={styles.shareCardStatSmall}>
                <Text style={styles.shareCardStatValue}>{totalGigs}</Text>
                <Text style={styles.shareCardStatLabel}>Gigs logged</Text>
              </View>

              <View style={styles.shareCardDivider} />

              <View style={styles.shareCardStat}>
                <Text style={styles.shareCardStatValue} numberOfLines={1}>
                  {topArtist}
                </Text>
                <Text style={styles.shareCardStatLabel}>Top artist</Text>
              </View>

              <View style={styles.shareCardDivider} />

              <View style={styles.shareCardStat}>
                <Text style={styles.shareCardStatValue} numberOfLines={1}>
                  {topVenue}
                </Text>
                <Text style={styles.shareCardStatLabel}>Top venue</Text>
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
    paddingTop: 18,
    paddingBottom: 88,
    gap: 12,
  },

  profileHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 2,
    paddingVertical: 12,
    marginBottom: 10,
  },

  profileHeroText: {
    flex: 1,
    minWidth: 0,
  },

  avatar: {
    width: 76,
    height: 76,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(47,140,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
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

  nameWithShareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  editNameButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },

  nameInput: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 25,
    lineHeight: 30,
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },

  name: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 25,
    lineHeight: 30,
    letterSpacing: -0.25,
    flexShrink: 1,
  },

  shareButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexShrink: 0,
  },

  sectionTitle: {
    marginTop: 4,
    marginBottom: 4,
    color: Colours.text.secondary,
    fontWeight: "800",
    fontSize: 15,
    lineHeight: 19,
  },

  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
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
    paddingVertical: 12,
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

  toggleGroup: {
    marginTop: 4,
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

  toggleRowNoBorder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: Platform.OS === "ios" ? 6 : 2,
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

  socialLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 34,
    paddingVertical: 10,
  },

  socialIconLink: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  socialIconLabel: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 17,
  },

  versionText: {
    textAlign: "center",
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.7,
    marginTop: 6,
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
    paddingTop: 56,
    paddingRight: 72,
    paddingBottom: 72,
    paddingLeft: 56,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  shareCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 58,
  },

  shareCardLogo: {
    width: 220,
    height: 72,
  },

  shareCardProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 30,
    marginBottom: 58,
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
    fontSize: 50,
    fontWeight: "800",
    lineHeight: 58,
    marginBottom: 10,
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

  shareCardStatSmall: {
    flex: 0.48,
    minWidth: 0,
  },

  shareCardStat: {
    flex: 1,
    minWidth: 0,
  },

  shareCardStatValue: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "800",
    lineHeight: 50,
    marginBottom: 8,
  },

  shareCardStatLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 23,
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