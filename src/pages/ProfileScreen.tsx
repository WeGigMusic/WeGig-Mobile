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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import ViewShot, { captureRef } from "react-native-view-shot";

import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { AvatarPickerModal } from "../components/AvatarPickerModal";
import { Colours } from "../theme/colours";
import { apiGet } from "../lib/api";
import { supabase } from "../lib/supabase";
import { posthog } from "../lib/analytics";
import { searchPlaces } from "../lib/mapbox";
import { syncGigReminderNotifications } from "../lib/notifications";
import type { GigsResponse, Gig } from "../shared/types/Gig";
import { avatarPresets } from "../config/avatarPresets";

const HOME_CITY_KEY = "wegig.homeCity";
const DISPLAY_NAME_KEY = "wegig.displayName";
const HAPTICS_KEY = "wegig.hapticsEnabled";
const AVATAR_PRESET_KEY = "wegig.avatarPreset";
const AVATAR_URI_KEY = "wegig.avatarUri";
const FIRST_GIG_ID_KEY = "wegig.firstGigId";
const FAVOURITE_GIG_ID_KEY = "wegig.favouriteGigId";
const NOTIFY_GIG_REMINDER_KEY = "wegig.notifyGigReminder";
const NOTIFY_RATE_REMINDER_KEY = "wegig.notifyRateReminder";

const WEGIG_INSTAGRAM_URL = "https://www.instagram.com/wegigmusic/";
const WEGIG_FACEBOOK_URL =
  "https://www.facebook.com/profile.php?id=61584065319390&sk=about";
const WEGIG_STORY_URL = "https://www.wegig.live/story/";
const WEGIG_PRIVACY_URL = "https://www.wegig.live/privacy/";
const WEGIG_FEEDBACK_URL = "https://www.wegig.live/feedback/";
const APP_VERSION = "v0.1.0";

type ProfileScreenProps = {
  onPressLogo?: () => void;
  onGoToGigs?: () => void;
  scrollToTopSignal?: number;
};

type MapboxPlace = {
  id: string;
  name: string;
  placeName: string;
  city?: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
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

      <Ionicons
        name="chevron-forward"
        size={16}
        color={Colours.text.muted}
      />
    </Pressable>
  );
}

function SectionTitle(props: { title: string }) {
  return <Text style={styles.sectionTitle}>{props.title}</Text>;
}

function formatUkDateForFile(date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
}

function formatDisplayDate(date = new Date()) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toFileSafePart(value: string) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

export function ProfileScreen({
  onPressLogo,
  onGoToGigs,
  scrollToTopSignal,
}: ProfileScreenProps) {
  const shareCardRef = React.useRef<ViewShot | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);

  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<ReturnType<
    typeof computeProfileStats
  > | null>(null);
  const [allGigs, setAllGigs] = React.useState<Gig[]>([]);

  const [displayName, setDisplayName] = React.useState("Nowar");
  const [homeCity, setHomeCity] = React.useState("");
  const [hapticsEnabled, setHapticsEnabled] = React.useState(true);
  const [gigReminderEnabled, setGigReminderEnabled] = React.useState(true);
  const [rateReminderEnabled, setRateReminderEnabled] = React.useState(true);

  const [savingPrefs, setSavingPrefs] = React.useState(false);
  const [sharingProfile, setSharingProfile] = React.useState(false);
  const [exportingGigs, setExportingGigs] = React.useState(false);

  const [avatarPickerVisible, setAvatarPickerVisible] = React.useState(false);
  const [avatarPreset, setAvatarPreset] = React.useState<string>("");
  const [avatarUri, setAvatarUri] = React.useState<string>("");

  const [cityLoading, setCityLoading] = React.useState(false);
  const [cityResults, setCityResults] = React.useState<MapboxPlace[]>([]);
  const [cityOpen, setCityOpen] = React.useState(false);
  const [cityError, setCityError] = React.useState("");
  const [cityTouched, setCityTouched] = React.useState(false);

  const [firstGigId, setFirstGigId] = React.useState("");
  const [favouriteGigId, setFavouriteGigId] = React.useState("");

  const loadPrefs = React.useCallback(async () => {
    try {
      const [dn, hc, hap, preset, uri, notifyGig, notifyRate] =
        await Promise.all([
          AsyncStorage.getItem(DISPLAY_NAME_KEY),
          AsyncStorage.getItem(HOME_CITY_KEY),
          AsyncStorage.getItem(HAPTICS_KEY),
          AsyncStorage.getItem(AVATAR_PRESET_KEY),
          AsyncStorage.getItem(AVATAR_URI_KEY),
          AsyncStorage.getItem(NOTIFY_GIG_REMINDER_KEY),
          AsyncStorage.getItem(NOTIFY_RATE_REMINDER_KEY),
        ]);

      if (dn && dn.trim()) setDisplayName(dn.trim());
      if (hc && hc.trim()) setHomeCity(hc.trim());
      if (preset && preset.trim()) setAvatarPreset(preset.trim());
      if (uri && uri.trim()) setAvatarUri(uri.trim());

      if (hap != null) setHapticsEnabled(hap === "1");
      if (notifyGig != null) setGigReminderEnabled(notifyGig === "1");
      if (notifyRate != null) setRateReminderEnabled(notifyRate === "1");
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
      await AsyncStorage.setItem(
        NOTIFY_GIG_REMINDER_KEY,
        gigReminderEnabled ? "1" : "0",
      );
      await AsyncStorage.setItem(
        NOTIFY_RATE_REMINDER_KEY,
        rateReminderEnabled ? "1" : "0",
      );

      Alert.alert("Saved", "Preferences updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save preferences");
    } finally {
      setSavingPrefs(false);
    }
  }, [
    displayName,
    homeCity,
    hapticsEnabled,
    gigReminderEnabled,
    rateReminderEnabled,
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

  const runCitySearch = React.useCallback(async (q: string) => {
    const query = q.trim();

    if (query.length < 2) {
      setCityResults([]);
      setCityError("");
      setCityLoading(false);
      return;
    }

    setCityLoading(true);
    setCityError("");

    try {
      const results = await searchPlaces({
        query,
        limit: 6,
      });

      const mapped = results.filter(
        (place) => !!(place.city || place.region || place.name),
      );

      setCityResults(mapped);
      setCityOpen(true);
    } catch (e: any) {
      setCityError(e?.message ?? "City search failed");
      setCityResults([]);
      setCityOpen(false);
    } finally {
      setCityLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!cityTouched) return;

    const q = homeCity.trim();
    if (q.length < 2) {
      setCityResults([]);
      setCityOpen(false);
      setCityError("");
      return;
    }

    const t = setTimeout(() => {
      void runCitySearch(q);
    }, 320);

    return () => clearTimeout(t);
  }, [homeCity, cityTouched, runCitySearch]);

  const chooseCity = React.useCallback((place: MapboxPlace) => {
    const best = place.city?.trim() || place.region?.trim() || place.name.trim();

    setHomeCity(best);
    setCityOpen(false);
    setCityResults([]);
    setCityError("");
  }, []);

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
    Alert.alert(
      "Change password",
      "This will be available once email login is set up.",
    );
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

  const handleSignIn = React.useCallback(() => {
    Alert.alert("Sign in", "Sign in to sync will be added next.");
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

      const rawName = displayName.trim() || "profile";
      const safeName = toFileSafePart(rawName) || "profile";
      const ukDate = formatUkDateForFile();
      const fileName = `wegig-profile-${safeName}-${ukDate}.png`;
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
          title: "Share your WeGig profile",
          message:
            Platform.OS === "android"
              ? `${shareMessage}\n${targetUri}`
              : shareMessage,
          url: targetUri,
        },
        {
          dialogTitle: "Share your WeGig profile",
          subject: "My WeGig profile",
        },
      );
    } catch (e: any) {
      Alert.alert("Share failed", e?.message ?? "Could not share profile.");
    } finally {
      setSharingProfile(false);
    }
  }, [displayName, sharingProfile]);

  const handle = "@wegig";
  const location = homeCity.trim() || stats?.topCity || "—";
  const totalGigs = stats?.total ?? 0;

  const selectedPreset = avatarPresets.find((p) => p.id === avatarPreset);
  const metaLine = location !== "—" ? `${handle} · ${location}` : handle;

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
                {displayName.slice(0, 1).toUpperCase()}
              </Text>
            )}
          </Pressable>

          <View style={styles.profileHeroText}>
            <View style={styles.nameWithShareRow}>
              <Text style={styles.name}>{displayName}</Text>

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

            <Text style={styles.metaLine}>{metaLine}</Text>

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
              label="Town or City (optional)"
              value={homeCity}
              onChangeText={(value) => {
                setCityTouched(true);
                setHomeCity(value);
                setCityOpen(true);
              }}
              placeholder="e.g. Fleet"
              autoCapitalize="words"
            />

            {cityLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator />
                <Text style={styles.muted}>Searching cities…</Text>
              </View>
            ) : null}

            {cityError ? <Text style={styles.errorText}>{cityError}</Text> : null}

            {cityOpen && !cityLoading && cityResults.length > 0 ? (
              <View style={styles.suggestCard}>
                {cityResults.map((place, index) => {
                  const label = place.city?.trim() || place.name.trim();

                  const meta = [place.region, place.country]
                    .filter(Boolean)
                    .join(" • ");

                  return (
                    <Pressable
                      key={place.id}
                      onPress={() => chooseCity(place)}
                      style={({ pressed }) => [
                        styles.suggestRow,
                        index === cityResults.length - 1
                          ? styles.suggestRowLast
                          : null,
                        pressed ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestTitle}>{label}</Text>
                        {meta ? (
                          <Text style={styles.suggestMeta}>{meta}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Text style={styles.muted}>
              Used to personalise Discover + “Next gig near you”.
            </Text>

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
                  trackColor={{
                    false: "rgba(255,255,255,0.18)",
                    true: "rgba(47,140,255,0.35)",
                  }}
                  thumbColor={
                    hapticsEnabled ? "#2F8CFF" : "rgba(255,255,255,0.75)"
                  }
                  ios_backgroundColor="rgba(255,255,255,0.18)"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Gig reminders</Text>
                  <Text style={styles.toggleSubtitle}>
                    Get a reminder the day before gigs you’ve logged
                  </Text>
                </View>

                <Switch
                  value={gigReminderEnabled}
                  onValueChange={() => void toggleGigReminder()}
                  trackColor={{
                    false: "rgba(255,255,255,0.18)",
                    true: "rgba(47,140,255,0.35)",
                  }}
                  thumbColor={
                    gigReminderEnabled ? "#2F8CFF" : "rgba(255,255,255,0.75)"
                  }
                  ios_backgroundColor="rgba(255,255,255,0.18)"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Rate your gigs</Text>
                  <Text style={styles.toggleSubtitle}>
                    Get a reminder the day after to log your rating
                  </Text>
                </View>

                <Switch
                  value={rateReminderEnabled}
                  onValueChange={() => void toggleRateReminder()}
                  trackColor={{
                    false: "rgba(255,255,255,0.18)",
                    true: "rgba(47,140,255,0.35)",
                  }}
                  thumbColor={
                    rateReminderEnabled ? "#2F8CFF" : "rgba(255,255,255,0.75)"
                  }
                  ios_backgroundColor="rgba(255,255,255,0.18)"
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
            subtitle="Download your gig history as CSV"
            onPress={() => void handleExportGigs()}
            isLast
          />
        </View>

        <SectionTitle title="Follow WeGig" />
        <View style={styles.card}>
          <ActionRow
            title="Instagram"
            subtitle="@wegigmusic"
            onPress={() => void openExternalLink(WEGIG_INSTAGRAM_URL)}
          />
          <ActionRow
            title="Facebook"
            subtitle="WeGig on Facebook"
            onPress={() => void openExternalLink(WEGIG_FACEBOOK_URL)}
            isLast
          />
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
    marginTop: 4,
    marginBottom: 4,
    color: Colours.text.secondary,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 19,
  },

  profileHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colours.background.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
  },

  profileHeroText: {
    flex: 1,
    minWidth: 0,
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

  nameWithShareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  name: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 24,
    flexShrink: 1,
  },

  metaLine: {
    marginTop: 6,
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 17,
  },

  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 10,
  },

  statusPillText: {
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.1,
  },

  shareButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    flexShrink: 0,
    marginTop: 1,
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

  versionText: {
    textAlign: "center",
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.7,
    marginTop: 6,
  },

  errorText: {
    color: Colours.text.danger,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 17,
  },

  suggestCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    overflow: "hidden",
  },

  suggestRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colours.ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  suggestRowLast: {
    borderBottomWidth: 0,
  },

  suggestTitle: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
  },

  suggestMeta: {
    marginTop: 2,
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 16,
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