import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { GigsScreen } from "./src/pages/GigsScreen";
import { AddGigScreen } from "./src/pages/AddGigScreen";
import { DiscoverScreen } from "./src/pages/DiscoverScreen";
import { StatsScreen } from "./src/pages/StatsScreen";
import { ProfileScreen } from "./src/pages/ProfileScreen";

import type { CreateGigInput } from "./src/shared/types/Gig";
import { Colours } from "./src/theme/colours";

type Tab = "gigs" | "discover" | "add" | "stats" | "profile";

function TabButton(props: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={props.onPress} style={styles.tabBtn}>
      <Ionicons
        name={props.icon}
        size={20}
        color={props.active ? Colours.text.primary : Colours.text.muted}
      />
      <Text style={[styles.tabText, props.active ? styles.tabTextActive : null]}>
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

  return (
    <View style={styles.app}>
      <View style={styles.content}>
        {tab === "gigs" ? (
          <GigsScreen key={`gigs-${refreshKey}`} />
        ) : tab === "discover" ? (
          <DiscoverScreen
            onAddToGigs={(draft) => {
              setPrefill(draft);
              setTab("add");
            }}
          />
        ) : tab === "add" ? (
          <AddGigScreen
            prefill={prefill}
            onPrefillUsed={() => setPrefill(null)}
            onCreated={() => {
              setTab("gigs");
              setRefreshKey((k) => k + 1);
            }}
          />
        ) : tab === "stats" ? (
          <StatsScreen key={`stats-${refreshKey}`} />
        ) : (
          <ProfileScreen />
        )}
      </View>

      <View style={styles.tabBar}>
        <TabButton
          active={tab === "gigs"}
          label="Gigs"
          icon="musical-note"
          onPress={() => setTab("gigs")}
        />
        <TabButton
          active={tab === "discover"}
          label="Discover"
          icon="sparkles"
          onPress={() => setTab("discover")}
        />
        <TabButton
          active={tab === "add"}
          label="Add"
          icon="add-circle"
          onPress={() => setTab("add")}
        />
        <TabButton
          active={tab === "stats"}
          label="Stats"
          icon="bar-chart"
          onPress={() => setTab("stats")}
        />
        <TabButton
          active={tab === "profile"}
          label="Profile"
          icon="person"
          onPress={() => setTab("profile")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: Colours.background.app },
  content: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colours.ui.divider,
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingBottom: 10,
    paddingTop: 10,
  },
  tabBtn: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  tabText: { fontSize: 12, fontWeight: "700", color: Colours.text.muted },
  tabTextActive: { color: Colours.text.primary },
});
