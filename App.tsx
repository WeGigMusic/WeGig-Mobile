// App.tsx
import React from "react";
import { View, Pressable, Text, StyleSheet, AppState } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
      ? Colours.text.primary     // Add = white when active
      : Colours.brand.primary    // Add = blue when inactive
    : props.active
    ? Colours.text.primary
    : Colours.text.muted;

  const labelColor = props.active ? Colours.text.primary : Colours.text.muted;

  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [styles.tabItem, pressed ? { opacity: 0.75 } : null]}
      hitSlop={10}
    >
      <Ionicons name={props.icon} size={22} color={iconColor} />
      <Text style={[styles.tabLabel, { color: labelColor }]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export default function App() {
  const [tab, setTab] = React.useState<Tab>("gigs");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [prefill, setPrefill] = React.useState<Partial<CreateGigInput> | null>(null);
console.log("App.tsx change check");
  const goHome = React.useCallback(() => setTab("gigs"), []);

  // ---- Offline sync logic (UNCHANGED) ----
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
        try { await Haptics.selectionAsync(); } catch {}
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

      {/* Bottom Navigation */}
      <View style={styles.tabWrap}>
        <View style={styles.tabPill}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: Colours.background.app },
  content: { flex: 1 },

  tabWrap: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 6,
  },

  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
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