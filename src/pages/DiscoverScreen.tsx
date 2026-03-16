import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { avatarPresets } from "../config/avatarPresets";
import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { apiGet } from "../lib/api";

import type { CreateGigInput } from "../shared/types/Gig";

import { AppHeader } from "../components/AppHeader";
import { Colours } from "../theme/colours";

const HOME_CITY_KEY = "wegig.homeCity";

type TicketmasterEvent = {
  id: string;
  name: string;
  url?: string;
  dates?: {
    start?: {
      localDate?: string;
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

type SocialAvatarKey = "guitar" | "drums" | "mic" | "piano" | "vinyl";

const AVATAR_IMAGES: Record<SocialAvatarKey, any> = {
  guitar: avatarPresets.find((p) => p.id === "guitar")?.image,
  drums: avatarPresets.find((p) => p.id === "drums")?.image,
  mic: avatarPresets.find((p) => p.id === "mic")?.image,
  piano: avatarPresets.find((p) => p.id === "piano")?.image,
  vinyl: avatarPresets.find((p) => p.id === "vinyl")?.image,
};

function getSocialSignal(seed: string) {
  const options: Array<{
    avatars: SocialAvatarKey[];
    text: string;
    extraCount?: number;
  }> = [
    {
      avatars: ["guitar", "mic", "vinyl"],
      text: "Popular with fans who saw similar artists",
      extraCount: 12,
    },
    {
      avatars: ["drums", "guitar", "mic"],
      text: "High-energy crowd pick near you",
      extraCount: 8,
    },
    {
      avatars: ["vinyl", "piano", "mic"],
      text: "Scene discovery favourite",
      extraCount: 5,
    },
    {
      avatars: ["guitar", "drums"],
      text: "Big with live-music regulars",
      extraCount: 14,
    },
    {
      avatars: ["piano", "vinyl"],
      text: "Strong match for your taste profile",
      extraCount: 6,
    },
  ];

  const hash = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return options[hash % options.length];
}

function AvatarStack(props: {
  avatars: SocialAvatarKey[];
  extraCount?: number;
}) {
  return (
    <View style={styles.socialRow}>
      <View style={styles.avatarStack}>
        {props.avatars.map((key, index) => (
          <Image
            key={`${key}-${index}`}
            source={AVATAR_IMAGES[key]}
            style={[
              styles.socialAvatar,
              index > 0 ? { marginLeft: -10 } : null,
            ]}
          />
        ))}
      </View>

      {props.extraCount ? (
        <Text style={styles.socialExtra}>+{props.extraCount}</Text>
      ) : null}
    </View>
  );
}

export function DiscoverScreen(props: {
  onAddToGigs: (draft: Partial<CreateGigInput>) => void;
  onPressLogo?: () => void;
}) {
  const [city, setCity] = React.useState("");
  const [query, setQuery] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [events, setEvents] = React.useState<TicketmasterEvent[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const saved = await AsyncStorage.getItem(HOME_CITY_KEY);
        if (cancelled) return;
        if (!city.trim() && saved?.trim()) setCity(saved.trim());
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [city]);

  const search = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (query.trim()) qs.set("keyword", query.trim());
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

  React.useEffect(() => {
    const q = query.trim();

    if (q.length < 2) {
      setEvents([]);
      return;
    }

    const t = setTimeout(() => {
      void search();
    }, 350);

    return () => clearTimeout(t);
  }, [query, search]);

  const hasResults = events.length > 0;
  const isCompact = query.trim().length > 0 || hasResults;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <AppHeader onPressLogo={props.onPressLogo} />

        <View style={styles.heroWrap}>
          <View style={[styles.heroCard, isCompact ? styles.heroCardCompact : null]}>
            <Text style={styles.screenTitle}>Discover</Text>

            {!isCompact ? (
              <Text style={styles.screenSubtitle}>
                Search Ticketmaster and prefill your gig log in one tap.
              </Text>
            ) : null}

            <View style={[styles.formBlock, isCompact ? styles.formBlockCompact : null]}>
              <TextField
                label="Search"
                value={query}
                onChangeText={setQuery}
                placeholder="e.g. Foo Fighters"
                autoCapitalize="none"
              />

              <TextField
                label="City (optional)"
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Manchester"
                autoCapitalize="words"
              />

              <View style={[styles.searchRow, isCompact ? styles.searchRowCompact : null]}>
                <PrimaryButton title="Search Ticketmaster" onPress={search} />

                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator />
                    <Text style={styles.loadingText}>Searching…</Text>
                  </View>
                ) : null}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {!loading && !error && !hasResults && !isCompact ? (
                <Text style={styles.emptyHint}>
                  Try searching an artist or band name.
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <FlatList
          style={styles.list}
          data={events}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const date = item.dates?.start?.localDate ?? "";
            const v = pickVenue(item);
            const social = getSocialSignal(`${item.id}-${item.name}`);

            return (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>{item.name}</Text>

                <Text style={styles.resultMeta}>
                  {v.venue} • {v.city}
                </Text>

                {date ? <Text style={styles.resultDate}>{date}</Text> : null}

                <View style={styles.socialBlock}>
                  <AvatarStack
                    avatars={social.avatars}
                    extraCount={social.extraCount}
                  />
                  <Text style={styles.socialText}>{social.text}</Text>
                </View>

                <View style={styles.resultActionWrap}>
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
                    style={styles.resultActionBtn}
                  />
                </View>
              </View>
            );
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  keyboardWrap: {
    flex: 1,
  },

  heroWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },

  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.faint,
  },

  heroCardCompact: {
    padding: 10,
  },

  screenTitle: {
    color: COLORS.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },

  screenSubtitle: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  formBlock: {
    marginTop: 10,
    gap: 10,
  },

  formBlockCompact: {
    marginTop: 8,
    gap: 8,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  searchRowCompact: {
    gap: 10,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  loadingText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },

  emptyHint: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  list: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  separator: {
    height: 10,
  },

  resultCard: {
    backgroundColor: COLORS.card2,
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.faint,
  },

  resultTitle: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "700",
  },

  resultMeta: {
    color: COLORS.muted,
    marginTop: 5,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },

  resultDate: {
    color: COLORS.muted,
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },

  resultActionWrap: {
    marginTop: 12,
    alignSelf: "flex-start",
  },

  resultActionBtn: {
    alignSelf: "flex-start",
  },

  socialBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  socialRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },

  socialAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#10101A",
    backgroundColor: "#10101A",
  },

  socialExtra: {
    marginLeft: 8,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  socialText: {
    marginTop: 8,
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
  },
});