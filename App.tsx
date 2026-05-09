import React from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  AppState,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import type { Session } from "@supabase/supabase-js";
import { PostHogProvider } from "posthog-react-native";
import { posthog } from "./src/lib/analytics";


import { ToastProvider } from "./src/components/ToastProvider";
import { OfflineBanner } from "./src/components/OfflineBanner";
import { flushGigQueue, getQueuedGigsCount } from "./src/lib/offlineQueue";
import { apiGet } from "./src/lib/api";
import { configureNotificationBehaviour } from "./src/lib/notifications";
import { supabase } from "./src/lib/supabase";


import { GigsScreen } from "./src/pages/GigsScreen";
import { DiscoverScreen } from "./src/pages/DiscoverScreen";
import { StatsScreen } from "./src/pages/StatsScreen";
import { ProfileScreen } from "./src/pages/ProfileScreen";
import AuthScreen from "./src/pages/AuthScreen";
import AboutPrivacyScreen from "./src/pages/AboutPrivacyScreen";
import HelpScreen from "./src/pages/HelpScreen";
import FeedbackScreen from "./src/pages/FeedbackScreen";


import type { CreateGigInput } from "./src/shared/types/Gig";
import { Colours } from "./src/theme/colours";


type Tab = "gigs" | "discover" | "stats" | "profile";
type ProfileRoute = "home" | "about" | "help" | "feedback";


const HAPTICS_KEY = "wegig.hapticsEnabled";


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


async function hapticsAllowed() {
  try {
    const value = await AsyncStorage.getItem(HAPTICS_KEY);
    return value == null || value === "1";
  } catch {
    return true;
  }
}


async function selectionHaptic() {
  if (!(await hapticsAllowed())) return;


  try {
    await Haptics.selectionAsync();
  } catch {}
}


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


function AppShell() {
  const [tab, setTab] = React.useState<Tab>("gigs");
  const [profileRoute, setProfileRoute] = React.useState<ProfileRoute>("home");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [gigsResetSignal, setGigsResetSignal] = React.useState(0);


  const [gigsScrollToTopSignal, setGigsScrollToTopSignal] = React.useState(0);
  const [discoverScrollToTopSignal, setDiscoverScrollToTopSignal] =
    React.useState(0);
  const [statsScrollToTopSignal, setStatsScrollToTopSignal] =
    React.useState(0);
  const [profileScrollToTopSignal, setProfileScrollToTopSignal] =
    React.useState(0);


  const [prefill, setPrefill] = React.useState<Partial<CreateGigInput> | null>(
    null,
  );
  const [autoCreatePrefill, setAutoCreatePrefill] = React.useState(false);


  const [openGigIdFromNotification, setOpenGigIdFromNotification] =
    React.useState<string | null>(null);


  const [queuedCount, setQueuedCount] = React.useState(0);
  const [isOnline, setIsOnline] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [justSynced, setJustSynced] = React.useState(false);


  const syncInFlightRef = React.useRef(false);
  const justSyncedTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );


  const goHome = React.useCallback(() => {
    setTab("gigs");
    setProfileRoute("home");
    setGigsResetSignal((n) => n + 1);
    setGigsScrollToTopSignal((n) => n + 1);
  }, []);


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


  React.useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          type?: string;
          gigId?: string;
        };


        if (data.type === "rate_reminder" && data.gigId) {
          setPrefill(null);
          setAutoCreatePrefill(false);
          setProfileRoute("home");
          setTab("gigs");
          setOpenGigIdFromNotification(data.gigId);
          setRefreshKey((k) => k + 1);
        }
      },
    );


    return () => {
      sub.remove();
    };
  }, []);


  const pressTab = React.useCallback(
    async (next: Tab) => {
      const isSameTab = next === tab;


      await selectionHaptic();


      if (isSameTab) {
        if (next === "gigs") {
          setPrefill(null);
          setAutoCreatePrefill(false);
          setOpenGigIdFromNotification(null);
          setGigsResetSignal((n) => n + 1);
          setGigsScrollToTopSignal((n) => n + 1);
        }


        if (next === "discover") {
          setDiscoverScrollToTopSignal((n) => n + 1);
        }


        if (next === "stats") {
          posthog.capture("stats_viewed");
          void posthog.flush();
          setStatsScrollToTopSignal((n) => n + 1);
        }


        if (next === "profile") {
          posthog.capture("profile_viewed");
          void posthog.flush();
          setProfileRoute("home");
          setProfileScrollToTopSignal((n) => n + 1);
        }


        return;
      }


      if (next === "stats") {
        posthog.capture("stats_viewed");
        void posthog.flush();
      }


      if (next === "profile") {
        posthog.capture("profile_viewed");
        void posthog.flush();
      }


      if (next !== "profile") setProfileRoute("home");
      if (next !== "gigs") setOpenGigIdFromNotification(null);


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
            scrollToTopSignal={gigsScrollToTopSignal}
            prefill={prefill}
            autoCreatePrefill={autoCreatePrefill}
            openGigIdFromNotification={openGigIdFromNotification}
            onNotificationGigOpened={() => {
              setOpenGigIdFromNotification(null);
            }}
            onPrefillUsed={() => {
              setPrefill(null);
              setAutoCreatePrefill(false);
            }}
            onGigCreated={() => {
              posthog.capture("gig_created");
              void posthog.flush();


              setPrefill(null);
              setAutoCreatePrefill(false);
              setOpenGigIdFromNotification(null);
              setRefreshKey((k) => k + 1);
              void runSync();
            }}
          />
        ) : tab === "discover" ? (
          <DiscoverScreen
            onPressLogo={goHome}
            scrollToTopSignal={discoverScrollToTopSignal}
            onAddToGigs={(draft) => {
              setOpenGigIdFromNotification(null);
              setPrefill(draft);
              setAutoCreatePrefill(true);
              setTab("gigs");
            }}
          />
        ) : tab === "stats" ? (
          <StatsScreen
            key={`stats-${refreshKey}`}
            onPressLogo={goHome}
            scrollToTopSignal={statsScrollToTopSignal}
          />
        ) : profileRoute === "about" ? (
          <AboutPrivacyScreen onBack={() => setProfileRoute("home")} />
        ) : profileRoute === "help" ? (
          <HelpScreen onBack={() => setProfileRoute("home")} />
        ) : profileRoute === "feedback" ? (
          <FeedbackScreen onBack={() => setProfileRoute("home")} />
        ) : (
          <ProfileScreen
            onPressLogo={goHome}
            onGoToGigs={() => {
              setProfileRoute("home");
              setTab("gigs");
            }}
            scrollToTopSignal={profileScrollToTopSignal}
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


export default function App() {
  const [session, setSession] = React.useState<Session | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);


  React.useEffect(() => {
    configureNotificationBehaviour();


    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });


    let mounted = true;


    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;


      const nextSession = data.session ?? null;
      setSession(nextSession);
      setAuthLoading(false);


      if (nextSession?.user) {
        posthog.identify(nextSession.user.id, {
          email: nextSession.user.email ?? null,
        });
      }
    });


    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setAuthLoading(false);


      if (nextSession?.user) {
        posthog.identify(nextSession.user.id, {
          email: nextSession.user.email ?? null,
        });
      } else {
        posthog.reset();
      }
    });


    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);


  if (authLoading) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }


  if (!session) {
    return (
      <PostHogProvider client={posthog} autocapture={false}>
        <AuthScreen />
      </PostHogProvider>
    );
  }


  return (
    <PostHogProvider client={posthog} autocapture={false}>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </PostHogProvider>
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


  loadingWrap: {
    flex: 1,
    backgroundColor: Colours.background.app,
    alignItems: "center",
    justifyContent: "center",
  },


  loadingText: {
    color: Colours.text.primary,
    fontWeight: "700",
  },
});



