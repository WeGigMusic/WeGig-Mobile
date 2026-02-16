// app.tsx
import React from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
  AppState,
} from "react-native";
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
  { key: "gigs", label: "Gigs", icon: "musical-note" },
  { key: "discover", label: "Discover", icon: "sparkles" },
  { key: "add", label: "Add", icon: "add" },
  { key: "stats", label: "Stats", icon: "bar-chart" },
  { key: "profile", label: "Profile", icon: "person" },
];

function TabItem(props: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  isAdd?: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  if (props.isAdd) {
    return (
      <View style={styles.addSlot}>
        <Pressable
          onPress={props.onPress}
          style={({ pressed }) => [
            styles.addBtn,
            pressed ? { transform: [{ scale: 0.98 }], opacity: 0.92 } : null,
          ]}
          hitSlop={10}
        >
          <Ionicons name={props.icon} size={22} color={Colours.text.primary} />
        </Pressable>

        {/* keep label, but tighter to the button */}
        <Text style={styles.addLabel}>{props.label}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={props.onPress}
      onLayout={props.onLayout}
      style={({ pressed }) => [
        styles.tabItem,
        pressed ? { opacity: 0.92 } : null,
      ]}
      hitSlop={8}
    >
      {/* Replit-style: icon + label together (not stacked) */}
      <View style={styles.tabItemInner}>
        <Ionicons
          name={props.icon}
          size={16}
          color={props.active ? Colours.text.primary : Colours.text.muted}
        />
        <Text
          style={[
            styles.tabLabel,
            props.active ? styles.tabLabelActive : null,
          ]}
          numberOfLines={1}
        >
          {props.label}
        </Text>
      </View>
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

  // --- Offline banner + sync state ---
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
    } catch {
      // silent
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

  // --- Animated indicator ---
  const indicatorX = React.useRef(new Animated.Value(0)).current;
  const indicatorW = React.useRef(new Animated.Value(0)).current;
  const indicatorO = React.useRef(new Animated.Value(0)).current;

  const layoutsRef = React.useRef<
    Partial<Record<Tab, { x: number; width: number }>>
  >({});

  const setLayout =
    (key: Tab) =>
    (e: LayoutChangeEvent): void => {
      const { x, width } = e.nativeEvent.layout;
      layoutsRef.current[key] = { x, width };

      if (tab === key && key !== "add") {
        indicatorX.setValue(x);
        indicatorW.setValue(width);
        indicatorO.setValue(1);
      }
    };

  React.useEffect(() => {
    const layout = layoutsRef.current[tab];
    const shouldShow = tab !== "add" && layout != null;

    if (!shouldShow) {
      Animated.timing(indicatorO, {
        toValue: 0,
        duration: 140,
        useNativeDriver: false,
      }).start();
      return;
    }

    Animated.parallel([
      Animated.timing(indicatorX, {
        toValue: layout!.x,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(indicatorW, {
        toValue: layout!.width,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(indicatorO, {
        toValue: 1,
        duration: 140,
        useNativeDriver: false,
      }),
    ]).start();
  }, [tab, indicatorO, indicatorW, indicatorX]);

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

      {/* Floating Replit-style pill */}
      <View style={styles.tabWrap}>
        <View style={styles.tabPill}>
          <View style={styles.tabPillInner} />

          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeIndicator,
              {
                opacity: indicatorO,
                transform: [{ translateX: indicatorX }],
                width: indicatorW,
              },
            ]}
          />

          {TABS.map((t) => (
            <TabItem
              key={t.key}
              active={tab === t.key}
              label={t.label}
              icon={t.icon}
              onPress={() => void pressTab(t.key)}
              isAdd={t.key === "add"}
              onLayout={t.key === "add" ? undefined : setLayout(t.key)}
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
    paddingBottom: 14,
    paddingTop: 6,
    backgroundColor: "transparent",
  },

  tabPill: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 22,

    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: Colours.ui.border,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,

    elevation: 18,
  },

  tabPillInner: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    height: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  // tuned for “icon + label together”
  activeIndicator: {
    position: "absolute",
    top: 10,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 16,
  },

  tabItemInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 6,
  },

  tabLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: Colours.text.muted,
    letterSpacing: 0.2,
  },

  tabLabelActive: {
    color: Colours.text.primary,
  },

  addSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },

  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colours.brand.primary,
    borderWidth: 1,
    borderColor: Colours.ui.borderStrong,
  },

  addLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: Colours.text.muted,
    letterSpacing: 0.2,
  },
});
