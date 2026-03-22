import React from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  AppState,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

import { OfflineBanner } from "./src/components/OfflineBanner";
import { flushGigQueue, getQueuedGigsCount } from "./src/lib/offlineQueue";
import { apiGet } from "./src/lib/api";

import { GigsScreen } from "./src/pages/GigsScreen";
import { DiscoverScreen } from "./src/pages/DiscoverScreen";
import { StatsScreen } from "./src/pages/StatsScreen";
import { ProfileScreen } from "./src/pages/ProfileScreen";
import AboutPrivacyScreen from "./src/pages/AboutPrivacyScreen";
import HelpScreen from "./src/pages/HelpScreen";
import FeedbackScreen from "./src/pages/FeedbackScreen";

import type { CreateGigInput } from "./src/shared/types/Gig";
import { Colours } from "./src/theme/colours";

type Tab = "gigs" | "discover" | "stats" | "profile";
type ProfileRoute = "home" | "about" | "help" | "feedback";

const TABS: Array<{
  key: Tab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "gigs", label: "Gigs", icon: "musical-notes" },
  { key: "discover", label: "Discover", icon: "sparkles" },
  { key: "stats", label: "Stats", icon: "bar-chart" },
  { key: "profile", label: "Profile", icon: "person" },
];

function TabItem(props: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const iconColor = props.active
    ? Colours.text.primary
    : "rgba(255,255,255,0.48)";

  const labelColor = props.active
    ? Colours.text.primary
    : "rgba(255,255,255,0.48)";

  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.tabItem,
        pressed ? { opacity: 0.72 } : null,
      ]}
      hitSlop={10}
    >
      <Ionicons
        name={props.icon}
        size={props.active ? 23 : 22}
        color={iconColor}
      />
      <Text style={[styles.tabLabel, { color: labelColor }]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export default function App() {
  const [tab, setTab] = React.useState<Tab>("gigs");
  const [profileRoute, setProfileRoute] = React.useState<ProfileRoute>("home");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [gigsResetSignal, setGigsResetSignal] = React.useState(0);
  const [prefill, setPrefill] = React.useState<Partial<CreateGigInput> | null>(
    null,
  );

  const [queuedCount, setQueuedCount] = React.useState(0);
  const [isOnline, setIsOnline] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [justSynced, setJustSynced] = React.useState(false);

  const syncInFlightRef = React.useRef(false);
  const justSyncedTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const goHome = React.useCallback(() => {
    setTab("gigs");
    setGigsResetSignal((n) => n + 1);
  }, []);

  const refreshQueuedCount = React.useCallback(async () => {
    try {
      const n = await getQueuedGigsCount();
      setQueuedCount(n);
    } catch {
      // Intentionally silent for now
    }
  }, []);

  const checkOnline = React.useCallback(async () => {
    try {
      await apiGet("/health");
      setIsOnline(true);
      return true;
    } catch {
      setIsOnline(false);
      return false;
    }
  }, []);

  const runSync = React.useCallback(async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;

    try {
      const online = await checkOnline();
      await refreshQueuedCount();
      if (!online) return;

      setSyncing(true);
      try {
        const before = await getQueuedGigsCount();
        await flushGigQueue();
        const after = await getQueuedGigsCount();
        setQueuedCount(after);

        if (before > 0 && after === 0) {
          setJustSynced(true);

          if (justSyncedTimeoutRef.current) {
            clearTimeout(justSyncedTimeoutRef.current);
          }

          justSyncedTimeoutRef.current = setTimeout(() => {
            setJustSynced(false);
          }, 1800);

          setRefreshKey((k) => k + 1);
        }
      } finally {
        setSyncing(false);
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }, [checkOnline, refreshQueuedCount]);

  React.useEffect(() => {
    void runSync();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void runSync();
    });

    return () => {
      sub.remove();

      if (justSyncedTimeoutRef.current) {
        clearTimeout(justSyncedTimeoutRef.current);
      }
    };
  }, [runSync]);

  const pressTab = React.useCallback(
    async (next: Tab) => {
      const isSameTab = next === tab;

      try {
        await Haptics.selectionAsync();
      } catch {
        // Intentionally silent for now
      }

      if (isSameTab) {
        if (next === "gigs") {
          setPrefill(null);
          setGigsResetSignal((n) => n + 1);
        }

        if (next === "profile") {
          setProfileRoute("home");
        }

        return;
      }

      if (next !== "profile") setProfileRoute("home");
      setTab(next);
    },
    [tab],
  );

  return (
    <View style={styles.app}>
      <OfflineBanner
        isOnline={isOnline}
        queuedCount={queuedCount}
        syncing={syncing}
        justSynced={justSynced}
      />

      <View style={styles.content}>
        {tab === "gigs" ? (
          <GigsScreen
            key={`gigs-${refreshKey}`}
            onPressLogo={goHome}
            resetSignal={gigsResetSignal}
            prefill={prefill}
            onPrefillUsed={() => setPrefill(null)}
            onGigCreated={() => {
              setPrefill(null);
              setRefreshKey((k) => k + 1);
              void runSync();
            }}
          />
        ) : tab === "discover" ? (
          <DiscoverScreen
            onPressLogo={goHome}
            onAddToGigs={(draft) => {
              setPrefill(draft);
              setTab("gigs");
            }}
          />
        ) : tab === "stats" ? (
          <StatsScreen key={`stats-${refreshKey}`} onPressLogo={goHome} />
        ) : profileRoute === "about" ? (
          <AboutPrivacyScreen onBack={() => setProfileRoute("home")} />
        ) : profileRoute === "help" ? (
          <HelpScreen onBack={() => setProfileRoute("home")} />
        ) : profileRoute === "feedback" ? (
          <FeedbackScreen onBack={() => setProfileRoute("home")} />
        ) : (
          <ProfileScreen
     onPressLogo={goHome}
  onGoToGigs={() => setTab("gigs")}
  onOpenAbout={() => setProfileRoute("about")}
  onOpenFeedback={() => setProfileRoute("feedback")}
          />
        )}
      </View>

      <View pointerEvents="box-none" style={styles.tabWrap}>
        <BlurView intensity={60} tint="dark" style={styles.tabBar}>
          <View style={styles.tabRow}>
            {TABS.map((t) => (
              <TabItem
                key={t.key}
                active={tab === t.key}
                label={t.label}
                icon={t.icon}
                onPress={() => void pressTab(t.key)}
              />
            ))}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: Colours.background.app,
  },

  content: {
    flex: 1,
  },

  tabWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },

  tabBar: {
    backgroundColor:
      Platform.OS === "ios"
        ? "rgba(8,8,10,0.48)"
        : "rgba(8,8,10,0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 30 : 14,
    paddingHorizontal: 8,
  },

  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 5,
  },

  tabLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.15,
  },
});