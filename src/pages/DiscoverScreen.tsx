import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { apiGet } from "../lib/api";
import type { CreateGigInput } from "../shared/types/Gig";

type TicketmasterEvent = {
  id: string;
  name: string;
  url?: string;
  dates?: {
    start?: {
      localDate?: string; // YYYY-MM-DD
    };
  };
  _embedded?: {
    venues?: Array<{
      name?: string;
      city?: { name?: string };
    }>;
  };
};

type TicketmasterResponse = {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
};

const COLORS = {
  bg: "#0B0B10",
  card: "#141422",
  card2: "#10101A",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.65)",
  faint: "rgba(255,255,255,0.12)",
  danger: "#FF4D4D",
};

function pickVenue(e: TicketmasterEvent) {
  const v = e._embedded?.venues?.[0];
  return {
    venue: v?.name ?? "Unknown venue",
    city: v?.city?.name ?? "Unknown city",
  };
}

export function DiscoverScreen(props: {
  onAddToGigs: (draft: Partial<CreateGigInput>) => void;
}) {
  const [city, setCity] = React.useState("London");
  const [query, setQuery] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [events, setEvents] = React.useState<TicketmasterEvent[]>([]);

  const search = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (query.trim()) qs.set("q", query.trim());
      if (city.trim()) qs.set("city", city.trim());
      qs.set("size", "20");

      const res = await apiGet<TicketmasterResponse>(
        `/tm/events/search?${qs.toString()}`,
      );

      setEvents(res._embedded?.events ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Search failed");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [city, query]);

  const hasResults = events.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header + Search */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
        <View
          style={{
            backgroundColor: COLORS.card,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: COLORS.faint,
          }}
        >
          <Text style={{ color: COLORS.text, fontSize: 26, fontWeight: "900" }}>
            Discover
          </Text>

          <Text style={{ color: COLORS.muted, marginTop: 6, lineHeight: 20 }}>
            Search Ticketmaster and prefill your gig log in one tap.
          </Text>

          <View style={{ marginTop: 12, gap: 12 }}>
            <TextField
              label="City"
              value={city}
              onChangeText={setCity}
              placeholder="e.g. London"
              autoCapitalize="words"
            />

            <TextField
              label="Search"
              value={query}
              onChangeText={setQuery}
              placeholder="e.g. Arctic Monkeys"
              autoCapitalize="none"
            />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <PrimaryButton title="Search Ticketmaster" onPress={search} />
              {loading ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator />
                  <Text style={{ color: COLORS.muted, fontWeight: "600" }}>
                    Searching…
                  </Text>
                </View>
              ) : null}
            </View>

            {error ? (
              <Text style={{ color: COLORS.danger, fontWeight: "700" }}>
                {error}
              </Text>
            ) : null}

            {!loading && !error && !hasResults ? (
              <Text style={{ color: COLORS.muted }}>
                Try searching an artist or band name (e.g. “Coldplay”).
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Results */}
      <FlatList
        style={{ flex: 1 }}
        data={events}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 24,
        }}
        renderItem={({ item }) => {
          const date = item.dates?.start?.localDate ?? "";
          const v = pickVenue(item);

          return (
            <View
              style={{
                backgroundColor: COLORS.card2,
                borderRadius: 18,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.faint,
              }}
            >
              <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "900" }}>
                {item.name}
              </Text>

              <Text style={{ color: COLORS.muted, marginTop: 6, fontWeight: "600" }}>
                {v.venue} • {v.city}
              </Text>

              {date ? (
                <Text style={{ color: COLORS.muted, marginTop: 4 }}>
                  {date}
                </Text>
              ) : null}

              <View style={{ marginTop: 12, alignSelf: "flex-start" }}>
                <PrimaryButton
                  title="Add to gigs"
                  onPress={() => {
                    props.onAddToGigs({
                      artist: item.name,
                      venue: v.venue,
                      city: v.city || city,
                      date: date || new Date().toISOString().slice(0, 10),
                      externalSource: "Ticketmaster",
                      externalId: item.id,
                      ticketUrl: item.url,
                      notes: "Imported from Ticketmaster",
                    });
                  }}
                  style={{ alignSelf: "flex-start" }}
                />
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
