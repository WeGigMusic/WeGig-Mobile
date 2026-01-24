import React from "react";
import { View, Pressable, Text } from "react-native";
import { GigsScreen } from "./src/screens/GigsScreen";
import { AddGigScreen } from "./src/screens/AddGigScreen";

type Tab = "gigs" | "add";

export default function App() {
  const [tab, setTab] = React.useState<Tab>("gigs");
  const [refreshKey, setRefreshKey] = React.useState(0);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === "gigs" ? (
          <GigsScreen key={`gigs-${refreshKey}`} />
        ) : (
          <AddGigScreen
            onCreated={() => {
              // after save, go back to gigs and refresh list
              setTab("gigs");
              setRefreshKey((k) => k + 1);
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
          <Text style={{ color: tab === "gigs" ? "white" : "black", fontWeight: "700" }}>
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
          <Text style={{ color: tab === "add" ? "white" : "black", fontWeight: "700" }}>
            Add
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
