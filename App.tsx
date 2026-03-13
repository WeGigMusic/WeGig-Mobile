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
import { AddGigScreen } from "./src/pages/AddGigScreen";
import { DiscoverScreen } from "./src/pages/DiscoverScreen";
import { StatsScreen } from "./src/pages/StatsScreen";
import { ProfileScreen } from "./src/pages/ProfileScreen";

import type { CreateGigInput } from "./src/shared/types/Gig";
import { Colours } from "./src/theme/colours";

type Tab = "gigs" | "discover" | "add" | "stats" | "profile";

const TABS: Array<{
  key: Tab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "gigs", label: "Gigs", icon: "musical-notes" },
  { key: "discover", label: "Discover", icon: "sparkles" },
  { key: "add", label: "Add", icon: "add" },
  { key: "stats", label: "Stats", icon: "bar-chart" },
  { key: "profile", label: "Profile", icon: "person" },
];

function TabItem(props: {
  tabKey: Tab;
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const isAdd = props.tabKey === "add";

  const iconColor = isAdd
    ? props.active
      ? Colours.text.primary
      : Colours.brand.primary
    : props.active
      ? Colours.text.primary
      : "rgba(255,255,255,0.58)";

  const labelColor = props.active
    ? Colours.text.primary
    : "rgba(255,255,255,0.58)";

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
        size={props.tabKey === "add" ? 25 : 22}
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
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [prefill, setPrefill] = React.useState<Partial<CreateGigInput> | null>(
    null,
  );

  const goHome = React.useCallback(() => setTab("gigs"), []);

  const [queuedCount, setQueuedCount] = React.useState(0);
  const [isOnline, setIsOnline] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [justSynced, setJustSynced] = React.useState(false);

  const refreshQueuedCount = React.useCallback(async () => {
    try {
      const n = await getQueuedGigsCount();
      setQueuedCount(n);
    } catch {}
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
        setTimeout(() => setJustSynced(false), 1800);
      }
    } finally {
      setSyncing(false);
    }
  }, [checkOnline, refreshQueuedCount]);

  React.useEffect(() => {
    void runSync();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void runSync();
    });
    return () => sub.remove();
  }, [runSync]);

  const pressTab = React.useCallback(
    async (next: Tab) => {
      if (next === tab) {
        try {
          await Haptics.selectionAsync();
        } catch {}
        return;
      }

      try {
        if (next === "add") {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          await Haptics.selectionAsync();
        }
      } catch {}

      if (tab === "add" && next !== "add") setPrefill(null);
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
          <GigsScreen key={`gigs-${refreshKey}`} onPressLogo={goHome} />
        ) : tab === "discover" ? (
          <DiscoverScreen
            onPressLogo={goHome}
            onAddToGigs={(draft) => {
              setPrefill(draft);
              setTab("add");
            }}
          />
        ) : tab === "add" ? (
          <AddGigScreen
            onPressLogo={goHome}
            prefill={prefill}
            onPrefillUsed={() => setPrefill(null)}
            onCreated={() => {
              setPrefill(null);
              setTab("gigs");
              setRefreshKey((k) => k + 1);
              void runSync();
            }}
          />
        ) : tab === "stats" ? (
          <StatsScreen key={`stats-${refreshKey}`} onPressLogo={goHome} />
        ) : (
          <ProfileScreen onPressLogo={goHome} />
        )}
      </View>

      <View pointerEvents="box-none" style={styles.tabWrap}>
        <BlurView
          intensity={38}
          tint="dark"
          style={styles.tabBar}
        >
          <View style={styles.tabRow}>
            {TABS.map((t) => (
              <TabItem
                key={t.key}
                tabKey={t.key}
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
        ? "rgba(8,8,10,0.55)"
        : "rgba(8,8,10,0.94)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    paddingHorizontal: 10,
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
    gap: 6,
    paddingVertical: 6,
  },

  tabLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});