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
import type { CreateGigInput } from "../types/gig";

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

      const list = res._embedded?.events ?? [];
      setEvents(list);
    } catch (e: any) {
      setError(e?.message ?? "Search failed");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [city, query]);

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>Discover</Text>

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

        <PrimaryButton title="Search Ticketmaster" onPress={search} />

        {loading ? <ActivityIndicator /> : null}
        {error ? <Text style={{ color: "crimson" }}>{error}</Text> : null}
      </View>

      <FlatList
        style={{ marginTop: 14 }}
        data={events}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const date = item.dates?.start?.localDate ?? "";
          const v = pickVenue(item);

          return (
            <View
              style={{
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.1)",
                borderRadius: 14,
                padding: 12,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "800" }}>
                {item.name}
              </Text>
              <Text style={{ opacity: 0.8 }}>
                {v.venue} • {v.city}
              </Text>
              {date ? <Text style={{ opacity: 0.6 }}>{date}</Text> : null}

              <View style={{ marginTop: 10 }}>
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
