import React from "react";
import { View, Pressable, Text } from "react-native";

import { GigsScreen } from "./src/pages/GigsScreen";
import { AddGigScreen } from "./src/pages/AddGigScreen";
import { DiscoverScreen } from "./src/pages/DiscoverScreen";
import type { CreateGigInput } from "./src/shared/types/Gig";

type Tab = "gigs" | "add" | "discover";

export default function App() {
  const [tab, setTab] = React.useState<Tab>("gigs");
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [prefill, setPrefill] = React.useState<Partial<CreateGigInput> | null>(
    null,
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === "gigs" ? (
          <GigsScreen key={`gigs-${refreshKey}`} />
        ) : tab === "add" ? (
          <AddGigScreen
            prefill={prefill}
            onPrefillUsed={() => setPrefill(null)}
            onCreated={() => {
              setTab("gigs");
              setRefreshKey((k) => k + 1);
            }}
          />
        ) : (
          <DiscoverScreen
            onAddToGigs={(draft) => {
              setPrefill(draft);
              setTab("add");
            }}
          />
        )}
      </View>

      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderTopColor: "rgba(0,0,0,0.1)",
        }}
      >
        <Pressable
          onPress={() => setTab("gigs")}
          style={{
            flex: 1,
            padding: 14,
            alignItems: "center",
            backgroundColor: tab === "gigs" ? "black" : "white",
          }}
        >
          <Text
            style={{
              color: tab === "gigs" ? "white" : "black",
              fontWeight: "700",
            }}
          >
            Gigs
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setTab("add")}
          style={{
            flex: 1,
            padding: 14,
            alignItems: "center",
            backgroundColor: tab === "add" ? "black" : "white",
          }}
        >
          <Text
            style={{
              color: tab === "add" ? "white" : "black",
              fontWeight: "700",
            }}
          >
            Add
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setTab("discover")}
          style={{
            flex: 1,
            padding: 14,
            alignItems: "center",
            backgroundColor: tab === "discover" ? "black" : "white",
          }}
        >
          <Text
            style={{
              color: tab === "discover" ? "white" : "black",
              fontWeight: "700",
            }}
          >
            Discover
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
