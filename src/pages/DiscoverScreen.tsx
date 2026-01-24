import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Switch,
} from "react-native";
import { apiGet } from "../lib/api";
import type { CreateGigInput, Gig, GigsResponse } from "../types/gig";

/**
 * FULL Discover lift (mobile version):
 * - taste index from your own gigs
 * - tribute filtering toggle (hidden by default)
 * - ranking scoring
 * - sections: Search, Upcoming near you, From artists you've seen, Similar picks
 *
 * Mirrors the web approach. 
 */

const inputStyle = {
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.15)",
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 16,
} as const;

type TMAttraction = { name?: string | null };
type TMEventLike =
  | {
      // normalized style (if your API returns simplified objects)
      ticketmasterId?: string;
      id?: string;
      name?: string;
      venue?: string;
      city?: string;
      date?: string; // YYYY-MM-DD
      url?: string;
      image?: string;
      attractions?: TMAttraction[];
    }
  | any;

type TicketmasterRawResponse = any;

// Mobile-friendly DiscoverEvent (same idea as web)
type DiscoverEvent = {
  id: string;
  ticketmasterId?: string;
  artist: string;
  venue: string;
  city: string;
  date: string; // YYYY-MM-DD
  url?: string;
  image?: string;
  attractions?: TMAttraction[];
  source: "Ticketmaster";
};

function norm(s: string) {
  return (s ?? "").trim().toLowerCase();
}

function uniqBySignature(events: DiscoverEvent[]) {
  const seen = new Set<string>();
  const out: DiscoverEvent[] = [];
  for (const e of events) {
    const sig = `${norm(e.artist)}|${norm(e.venue)}|${norm(e.city)}|${e.date}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(e);
  }
  return out;
}

function daysUntil(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  const dt0 = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const now0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((dt0.getTime() - now0.getTime()) / (1000 * 60 * 60 * 24));
}

function getEventArtists(e: DiscoverEvent): string[] {
  const fromAttractions = (e.attractions ?? [])
    .map((a) => a?.name?.trim())
    .filter(Boolean) as string[];

  if (fromAttractions.length) return fromAttractions;
  return [e.artist].filter(Boolean);
}

/* ---------------------------------------
   Taste index
--------------------------------------- */
type TasteIndex = {
  artistCounts: Map<string, number>;
  venueCounts: Map<string, number>;
  artistAvgRating: Map<string, number>;
};

function buildTasteIndex(gigs: Gig[]): TasteIndex {
  const artistCounts = new Map<string, number>();
  const venueCounts = new Map<string, number>();
  const ratingSum = new Map<string, number>();
  const ratingN = new Map<string, number>();

  for (const g of gigs ?? []) {
    const artist = g.artist?.trim();
    const venue = g.venue?.trim();
    const rating = (g as any).rating;

    if (artist) artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
    if (venue) venueCounts.set(venue, (venueCounts.get(venue) ?? 0) + 1);

    if (artist && typeof rating === "number") {
      ratingSum.set(artist, (ratingSum.get(artist) ?? 0) + rating);
      ratingN.set(artist, (ratingN.get(artist) ?? 0) + 1);
    }
  }

  const artistAvgRating = new Map<string, number>();
  for (const [artist, sum] of ratingSum.entries()) {
    const n = ratingN.get(artist) ?? 0;
    if (n > 0) artistAvgRating.set(artist, sum / n);
  }

  return { artistCounts, venueCounts, artistAvgRating };
}

/* ---------------------------------------
   Tribute detection
--------------------------------------- */
function isTributeTitle(title: string) {
  const t = norm(title);
  return (
    t.includes("tribute") ||
    t.includes("tribute to") ||
    t.includes("a tribute") ||
    t.includes("tribute band") ||
    t.includes("tribute show") ||
    t.includes("leading tribute") ||
    t.includes("no 1 tribute") ||
    t.includes("no.1 tribute") ||
    t.includes("ultimate ") ||
    t.includes("celebration of") ||
    t.includes("performing the music of") ||
    t.includes("performing songs by") ||
    t.includes("plays the music of") ||
    t.includes("the music of") ||
    t.includes("music of") ||
    t.includes("music by")
  );
}

function hasTributeAttraction(e: DiscoverEvent) {
  return (e.attractions ?? []).some((a) => isTributeTitle(a?.name ?? ""));
}

function isTributeEvent(e: DiscoverEvent) {
  return isTributeTitle(e.artist) || hasTributeAttraction(e);
}

/* ---------------------------------------
   Ranking
--------------------------------------- */
function scoreEvent(e: DiscoverEvent, profileCity: string, taste: TasteIndex) {
  let s = 0;

  if (e.date) s += 2;
  if (e.venue) s += 1;
  if (e.city) s += 1;

  if (profileCity && norm(e.city) === norm(profileCity)) s += 3;

  if (e.date) {
    const d = daysUntil(e.date);
    if (d >= 0 && d <= 30) s += 2;
    if (d >= 0 && d <= 7) s += 1;
    if (d > 180) s -= 1;
  }

  // Artist match using attractions (preferred)
  const evArtists = getEventArtists(e).map(norm);
  for (const [artist, n] of taste.artistCounts.entries()) {
    const a = norm(artist);
    if (evArtists.some((ea) => ea === a || ea.includes(a) || a.includes(ea))) {
      s += 5 + Math.min(4, n);
      const avg = taste.artistAvgRating.get(artist);
      if (avg != null && avg >= 4) s += 1;
      break;
    }
  }

  // Venue familiarity
  for (const [venue, n] of taste.venueCounts.entries()) {
    if (norm(e.venue) === norm(venue)) {
      s += 2 + Math.min(2, n);
      break;
    }
  }

  // Tribute penalty
  if (isTributeEvent(e)) s -= 6;

  return s;
}

/* ---------------------------------------
   Ticketmaster mapping (tolerant)
--------------------------------------- */

function normalizeTmToDiscover(json: TicketmasterRawResponse): DiscoverEvent[] {
  // Case A: already normalized in your API: { events: [...] }
  const maybeEventsA: TMEventLike[] = Array.isArray(json?.events)
    ? json.events
    : [];

  const fromA =
    maybeEventsA.length > 0
      ? maybeEventsA
          .map((ev) => {
            const id = String(ev.ticketmasterId ?? ev.id ?? "");
            const date = String(ev.date ?? "");
            if (!id || !date) return null;

            return {
              id,
              ticketmasterId: id,
              artist: String(ev.name ?? ev.artist ?? "Unknown"),
              venue: String(ev.venue ?? "Unknown venue"),
              city: String(ev.city ?? "Unknown city"),
              date,
              url: ev.url ? String(ev.url) : undefined,
              image: ev.image ? String(ev.image) : undefined,
              attractions: Array.isArray(ev.attractions) ? ev.attractions : [],
              source: "Ticketmaster" as const,
            };
          })
          .filter(Boolean) as DiscoverEvent[]
      : [];

  if (fromA.length) return fromA;

  // Case B: raw Ticketmaster response: { _embedded: { events: [...] } }
  const rawEvents: any[] = Array.isArray(json?._embedded?.events)
    ? json._embedded.events
    : [];

  return rawEvents
    .map((ev) => {
      const id = String(ev?.id ?? "");
      const date = String(ev?.dates?.start?.localDate ?? "");
      if (!id || !date) return null;

      const venueObj = ev?._embedded?.venues?.[0];
      const venue = String(venueObj?.name ?? "Unknown venue");
      const city = String(venueObj?.city?.name ?? "Unknown city");

      const attractions: TMAttraction[] = Array.isArray(ev?._embedded?.attractions)
        ? ev._embedded.attractions.map((a: any) => ({ name: a?.name }))
        : [];

      const image = Array.isArray(ev?.images) ? ev.images?.[0]?.url : undefined;

      return {
        id,
        ticketmasterId: id,
        artist: String(ev?.name ?? "Unknown"),
        venue,
        city,
        date,
        url: ev?.url ? String(ev.url) : undefined,
        image: image ? String(image) : undefined,
        attractions,
        source: "Ticketmaster" as const,
      };
    })
    .filter(Boolean) as DiscoverEvent[];
}

function applyFilters(events: DiscoverEvent[], includeTributes: boolean) {
  let out = uniqBySignature(events);
  if (!includeTributes) out = out.filter((e) => !isTributeEvent(e));
  // filter past / missing dates
  out = out.filter((e) => {
    if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return false;
    const d = daysUntil(e.date);
    return d >= 0;
  });
  return out;
}

async function fetchGigs(): Promise<Gig[]> {
  const res = await apiGet<GigsResponse>("/gigs");
  return res.gigs ?? [];
}

async function fetchTmEvents(params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  const json = await apiGet<any>(`/tm/events/search?${qs.toString()}`);
  return normalizeTmToDiscover(json);
}

export function DiscoverScreen(props: {
  onAddFromEvent: (draft: Partial<CreateGigInput>) => void;
}) {
  const [profileCity, setProfileCity] = React.useState("London");
  const [includeTributes, setIncludeTributes] = React.useState(false);

  const [tmQuery, setTmQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string>("");

  const [gigs, setGigs] = React.useState<Gig[]>([]);
  const taste = React.useMemo(() => buildTasteIndex(gigs), [gigs]);

  const [searchedEvents, setSearchedEvents] = React.useState<DiscoverEvent[]>(
    [],
  );
  const [nearYou, setNearYou] = React.useState<DiscoverEvent[]>([]);
  const [fromArtists, setFromArtists] = React.useState<DiscoverEvent[]>([]);
  const [similarPicks, setSimilarPicks] = React.useState<DiscoverEvent[]>([]);

  // load gigs once
  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const g = await fetchGigs();
        setGigs(g);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load gigs for personalization");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Upcoming near you
  const runNearYou = React.useCallback(async () => {
    if (!profileCity.trim()) return;
    try {
      const events = await fetchTmEvents({
        size: "12",
        city: profileCity.trim(),
        q: "music",
      });
      const filtered = applyFilters(events, includeTributes);
      const ranked = filtered
        .sort((a, b) => scoreEvent(b, profileCity, taste) - scoreEvent(a, profileCity, taste))
        .slice(0, 12);
      setNearYou(ranked);
    } catch {
      setNearYou([]);
    }
  }, [profileCity, includeTributes, taste]);

  // From artists you've seen
  const runFromArtists = React.useCallback(async () => {
    const topArtists = Array.from(taste.artistCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([a]) => a)
      .slice(0, 5);

    if (!topArtists.length) {
      setFromArtists([]);
      return;
    }

    const all: DiscoverEvent[] = [];

    async function fetchArtist(artist: string, city?: string) {
      const params: Record<string, string> = { q: artist, size: "8" };
      if (city) params.city = city;
      const res = await fetchTmEvents(params);
      return res;
    }

    for (const artist of topArtists) {
      let chunk = await fetchArtist(artist, profileCity.trim() || undefined);
      if (!chunk.length && profileCity.trim()) chunk = await fetchArtist(artist);
      all.push(...chunk);
    }

    const nearIds = new Set(nearYou.map((e) => e.ticketmasterId ?? e.id));
    const merged = applyFilters(all, includeTributes).filter(
      (e) => !nearIds.has(e.ticketmasterId ?? e.id),
    );

    const ranked = merged
      .sort((a, b) => scoreEvent(b, profileCity, taste) - scoreEvent(a, profileCity, taste))
      .slice(0, 12);

    setFromArtists(ranked);
  }, [taste, profileCity, includeTributes, nearYou]);

  // Similar picks (simple heuristic: top venues + top artists combined)
  const runSimilar = React.useCallback(async () => {
    const topArtists = Array.from(taste.artistCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([a]) => a)
      .slice(0, 3);

    const topVenues = Array.from(taste.venueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v)
      .slice(0, 2);

    const seeds = [...topArtists, ...topVenues].filter(Boolean);
    if (!seeds.length) {
      setSimilarPicks([]);
      return;
    }

    const all: DiscoverEvent[] = [];
    for (const seed of seeds) {
      const chunk = await fetchTmEvents({
        q: seed,
        size: "8",
        city: profileCity.trim() || "London",
      });
      all.push(...chunk);
    }

    const already = new Set<string>(
      gigs.map((g: any) => String(g.externalId ?? g.id ?? "")),
    );

    const merged = applyFilters(all, includeTributes).filter(
      (e) => !already.has(e.ticketmasterId ?? e.id),
    );

    const ranked = merged
      .sort((a, b) => scoreEvent(b, profileCity, taste) - scoreEvent(a, profileCity, taste))
      .slice(0, 12);

    setSimilarPicks(ranked);
  }, [taste, profileCity, includeTributes, gigs]);

  // refresh derived sections when city/toggle/gigs change
  React.useEffect(() => {
    void runNearYou();
  }, [runNearYou]);

  React.useEffect(() => {
    void runFromArtists();
    void runSimilar();
  }, [runFromArtists, runSimilar]);

  // Search (debounced-ish)
  React.useEffect(() => {
    const q = tmQuery.trim();
    if (!q || q.length < 2) {
      setSearchedEvents([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        const events = await fetchTmEvents({
          q,
          size: "20",
          ...(profileCity.trim() ? { city: profileCity.trim() } : {}),
        });

        const filtered = applyFilters(events, includeTributes);
        const ranked = filtered.sort(
          (a, b) =>
            scoreEvent(b, profileCity, taste) - scoreEvent(a, profileCity, taste),
        );

        setSearchedEvents(ranked);
      } catch {
        setSearchedEvents([]);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [tmQuery, profileCity, includeTributes, taste]);

  const Section = (p: {
    title: string;
    subtitle?: string;
    data: DiscoverEvent[];
  }) => {
    if (!p.data.length) return null;

    return (
      <View style={{ marginTop: 18 }}>
        <Text style={{ fontSize: 18, fontWeight: "800" }}>{p.title}</Text>
        {p.subtitle ? (
          <Text style={{ opacity: 0.65, marginTop: 2 }}>{p.subtitle}</Text>
        ) : null}

        <FlatList
          style={{ marginTop: 10 }}
          data={p.data}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const isTribute = isTributeEvent(item);
            return (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.1)",
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700" }}>
                  {item.artist}
                  {isTribute ? " (Tribute)" : ""}
                </Text>
                <Text style={{ opacity: 0.75 }}>
                  {item.venue} • {item.city}
                </Text>
                <Text style={{ opacity: 0.6 }}>{item.date}</Text>

                <Pressable
                  onPress={() => {
                    props.onAddFromEvent({
                      artist: item.artist,
                      venue: item.venue,
                      city: item.city,
                      date: item.date,
                      ticketUrl: item.url,
                      externalSource: "Ticketmaster",
                      externalId: item.ticketmasterId ?? item.id,
                      notes: "Imported from Ticketmaster",
                    });
                  }}
                  style={{
                    marginTop: 10,
                    backgroundColor: "black",
                    padding: 10,
                    borderRadius: 12,
                    alignItems: "center",
                    alignSelf: "flex-start",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>
                    Add to gigs
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Discover</Text>

        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: "600" }}>City</Text>
          <TextInput
            value={profileCity}
            onChangeText={setProfileCity}
            placeholder="e.g. London"
            style={inputStyle}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ opacity: 0.75 }}>Include tribute acts</Text>
          <Switch value={includeTributes} onValueChange={setIncludeTributes} />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: "600" }}>Search Ticketmaster</Text>
          <TextInput
            value={tmQuery}
            onChangeText={setTmQuery}
            placeholder="e.g. Arctic Monkeys"
            style={inputStyle}
            autoCapitalize="none"
          />
          {tmQuery.trim().length > 0 && tmQuery.trim().length < 2 ? (
            <Text style={{ opacity: 0.65, marginTop: 2 }}>
              Type at least 2 characters to search.
            </Text>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", marginTop: 18 }}>
          <ActivityIndicator />
        </View>
      ) : err ? (
        <Text style={{ color: "crimson", marginTop: 12 }}>{err}</Text>
      ) : null}

      <FlatList
        style={{ marginTop: 12 }}
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View>
            {tmQuery.trim().length >= 2 ? (
              <Section
                title="Search results"
                subtitle={`Results for “${tmQuery.trim()}”`}
                data={searchedEvents}
              />
            ) : null}

            <Section
              title="Upcoming near you"
              subtitle={profileCity ? `In and around ${profileCity}` : undefined}
              data={nearYou}
            />

            <Section
              title="From artists you've seen"
              subtitle={
                gigs.length
                  ? "Based on your logged gigs"
                  : "Log gigs to personalize"
              }
              data={fromArtists}
            />

            <Section
              title="Similar picks"
              subtitle="More shows you might like"
              data={similarPicks}
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}
