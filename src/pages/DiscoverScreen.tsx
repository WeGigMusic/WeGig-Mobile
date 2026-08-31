import React from "react";
import {
  SafeAreaView,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Pressable,
  Keyboard,
  TextInput,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { apiGet } from "../lib/api";
import {
  searchFutureEvents,
  type AppEvent,
  getEventArtistName,
  getEventDate,
} from "../lib/events";
import { AppHeader } from "../components/AppHeader";
import { CitySearchInput } from "../components/CitySearchInput";
import { Colours } from "../theme/colours";
import type { CreateGigInput } from "../shared/types/Gig";

// City search should reset when leaving/reopening Discover.

const AnimatedScrollView =
  Animated.createAnimatedComponent(ScrollView);

type DiscoverEvent = AppEvent & {
  id?: string;
  name?: string;
  url?: string;
  _embedded?: {
    venues?: Array<{
      name?: string;
      city?: { name?: string };
    }>;
    attractions?: Array<{
      name?: string;
      type?: string;
      subType?: string;
      classifications?: Array<{
        segment?: { name?: string };
        genre?: { name?: string };
        subGenre?: { name?: string };
      }>;
    }>;
  };
};

type MbArtist = {
  id: string;
  name: string;
  disambiguation?: string;
  country?: string;
};

type MbArtistSearchResponse =
  | {
      artists?: MbArtist[];
    }
  | any;

type ArtistPageResponse = {
  artist?: {
    id?: string;
    name?: string;
    imageUrl?: string | null;
  } | null;
};

type GigDraftWithArtistImage =
  Partial<CreateGigInput> & {
    artistImageUrl?: string;
  };

const UI_COPY = {
  searching: "Searching gigs…",
  artistLoading: "Looking up artists…",
  emptySearch:
    "No gigs found. Try another artist, band or city.",
};

const artistImageCache =
  new Map<string, string | null>();

const artistImageRequests =
  new Map<string, Promise<string | null>>();

function getEventName(item: DiscoverEvent) {
  return item.title ?? item.name ?? "Untitled event";
}

function pickVenue(e: DiscoverEvent) {
  const v = e._embedded?.venues?.[0];

  return {
    venue:
      e.venueName ??
      v?.name ??
      "Unknown venue",
    city:
      e.city ??
      v?.city?.name ??
      "Unknown city",
  };
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameText(a?: string, b?: string) {
  if (!a || !b) {
    return false;
  }

  return (
    normalizeSearchText(a) ===
    normalizeSearchText(b)
  );
}

function artistNamesMatch(
  a?: string,
  b?: string,
) {
  if (!a || !b) {
    return false;
  }

  const left =
    normalizeSearchText(a);

  const right =
    normalizeSearchText(b);

  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const stripLeadingThe = (
    value: string,
  ) =>
    value.replace(/^the\s+/, "");

  return (
    stripLeadingThe(left) ===
    stripLeadingThe(right)
  );
}

function isTributeEvent(event: DiscoverEvent) {
  const venue = pickVenue(event);

  const attractionText =
    event._embedded?.attractions
      ?.map((a) => {
        const classifications =
          a.classifications
            ?.map((c) =>
              [
                c.segment?.name,
                c.genre?.name,
                c.subGenre?.name,
              ]
                .filter(Boolean)
                .join(" "),
            )
            .join(" ") ?? "";

        return [
          a.name,
          a.type,
          a.subType,
          classifications,
        ]
          .filter(Boolean)
          .join(" ");
      })
      .join(" ") ?? "";

  const text = normalizeSearchText(
    [
      event.name,
      event.title,
      event.venueName,
      venue.venue,
      venue.city,
      attractionText,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const tributeTerms = [
    "tribute",
    "tributes",
    "tribute to",
    "tribute band",
    "tribute act",
    "live tribute",
    "uk tribute",
    "celebration of",
    "celebrating",
    "the music of",
    "music of",
    "songs of",
    "performed by",
    "performed live by",
    "presents",
    "reimagined",
    "orchestra performs",
    "by candlelight",
    "experience",
    "legacy",
    "story of",
    "the story of",
    "a night of",
    "an evening of",
    "homage",
  ].map(normalizeSearchText);

  const knownTributeActs = [
    "definitely oasis",
    "noasis",
    "oasish",
    "the smyths",
    "wrong jovi",
    "uk foo fighters",
    "forever queen",
    "queen extravaganza",
    "killer queen",
    "abba mania",
    "abba reunion",
    "abba stars",
    "abba forever",
    "bootleg beatles",
    "the counterfactuals",
    "fleetwood bac",
    "rumours of fleetwood mac",
    "the total stone roses",
    "the clone roses",
    "kazabian",
    "the fillas",
    "scam fender",
    "the phonics",
    "stereotonics",
    "the bon jovi experience",
    "ultimate coldplay",
    "coldplace",
    "guns 2 roses",
    "green date",
    "nearly dan",
    "t rexstasy",
    "the rolling clones",
    "the doors alive",
    "the elvis years",
  ].map(normalizeSearchText);

  return [
    ...tributeTerms,
    ...knownTributeActs,
  ].some((term) => text.includes(term));
}

function filterTributeEvents(
  events: DiscoverEvent[],
  includeTributeActs: boolean,
) {
  if (includeTributeActs) {
    return events;
  }

  return events.filter(
    (event) => !isTributeEvent(event),
  );
}

function getEventKey(
  item: DiscoverEvent,
  index: number,
) {
  return `${item.source ?? "event"}-${
    item.sourceEventId ??
    item.id ??
    item.title ??
    item.name ??
    index
  }`;
}

function getResultArtistName(
  item: DiscoverEvent,
) {
  const directArtist =
    getEventArtistName(item)?.trim();

  if (directArtist) {
    return directArtist;
  }

  const attractionArtist =
    item._embedded?.attractions?.[0]?.name?.trim();

  if (attractionArtist) {
    return attractionArtist;
  }

  return getEventName(item).trim();
}

function eventMatchesArtistSearch(
  event: DiscoverEvent,
  searchArtist: string,
) {
  if (!searchArtist.trim()) {
    return true;
  }

  const candidates = [
    getEventArtistName(event),
    event._embedded?.attractions?.[0]?.name,
    event.title,
    event.name,
  ].filter(
    (value): value is string =>
      Boolean(value?.trim()),
  );

  return candidates.some((candidate) =>
    artistNamesMatch(
      candidate,
      searchArtist,
    ),
  );
}

async function fetchArtistImage(
  artistName: string,
): Promise<string | null> {
  const trimmed = artistName.trim();

  if (!trimmed) {
    return null;
  }

  const cacheKey =
    normalizeSearchText(trimmed);

  if (artistImageCache.has(cacheKey)) {
    return (
      artistImageCache.get(cacheKey) ??
      null
    );
  }

  const existingRequest =
    artistImageRequests.get(cacheKey);

  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    try {
      const response =
        await apiGet<ArtistPageResponse>(
          `/spotify/artist-page?name=${encodeURIComponent(
            trimmed,
          )}`,
        );

      const returnedArtistName =
        response.artist?.name?.trim() ?? "";

      const isMatchingArtist =
        artistNamesMatch(
          trimmed,
          returnedArtistName,
        );

      if (!isMatchingArtist) {
        artistImageCache.set(
          cacheKey,
          null,
        );

        return null;
      }

      const imageUrl =
        response.artist?.imageUrl?.trim() ||
        null;

      artistImageCache.set(
        cacheKey,
        imageUrl,
      );

      return imageUrl;
    } catch (error) {
      console.warn(
        "[discover] artist image lookup failed",
        {
          artistName: trimmed,
          message:
            error instanceof Error
              ? error.message
              : String(error),
        },
      );

      artistImageCache.set(
        cacheKey,
        null,
      );

      return null;
    } finally {
      artistImageRequests.delete(
        cacheKey,
      );
    }
  })();

  artistImageRequests.set(
    cacheKey,
    request,
  );

  return request;
}

function useArtistImage(
  artistName: string,
) {
  const [imageUrl, setImageUrl] =
    React.useState<string | null>(
      null,
    );

  const [loading, setLoading] =
    React.useState(
      artistName.trim().length > 0,
    );

  React.useEffect(() => {
    let active = true;

    const trimmed =
      artistName.trim();

    if (!trimmed) {
      setImageUrl(null);
      setLoading(false);

      return () => {
        active = false;
      };
    }

    setImageUrl(null);
    setLoading(true);

    void fetchArtistImage(
      trimmed,
    ).then((resolved) => {
      if (!active) {
        return;
      }

      setImageUrl(resolved);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [artistName]);

  return {
    imageUrl,
    loading,
  };
}

function SectionTitle(props: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>
        {props.title}
      </Text>

      {props.subtitle ? (
        <Text style={styles.sectionSubtitle}>
          {props.subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function SearchInput(props: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?:
    | "none"
    | "sentences"
    | "words"
    | "characters";
}) {
  const [focused, setFocused] =
    React.useState(false);

  return (
    <View
      style={[
        styles.searchInputWrap,
        focused
          ? styles.searchInputWrapFocused
          : null,
      ]}
    >
      <Ionicons
        name={props.icon}
        size={17}
        color={
          focused
            ? "#7EB6FF"
            : Colours.text.muted
        }
      />

      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="rgba(255,255,255,0.42)"
        autoCapitalize={props.autoCapitalize}
        autoCorrect={false}
        returnKeyType="search"
        style={styles.searchInput}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />

      {props.value.trim() ? (
        <Pressable
          onPress={() =>
            props.onChangeText("")
          }
          hitSlop={10}
          style={({ pressed }) =>
            pressed
              ? styles.clearPressed
              : null
          }
        >
          <Ionicons
            name="close-circle"
            size={18}
            color="rgba(255,255,255,0.32)"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function EventCard(props: {
  item: DiscoverEvent;
  cityFallback: string;
  onAddToGigs: (
    draft: Partial<CreateGigInput>,
  ) => void;
}) {
  const eventName =
    getEventName(props.item);

  const date =
    getEventDate(props.item);

  const displayDate =
    date &&
    /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? `${date.slice(
          8,
          10,
        )}-${date.slice(
          5,
          7,
        )}-${date.slice(0, 4)}`
      : date;

  const v = pickVenue(props.item);

  const artistName =
    getResultArtistName(
      props.item,
    );

  const {
    imageUrl: artistImageUrl,
    loading: artistImageLoading,
  } = useArtistImage(
    artistName,
  );

  const city =
    v.city &&
    v.city !== "Unknown city"
      ? v.city
      : props.cityFallback;

  const handleAddGig = () => {
    Keyboard.dismiss();

    const draft: GigDraftWithArtistImage =
      {
        artist: artistName,
        venue: v.venue,
        city:
          city || "Unknown city",
        date:
          date ||
          new Date()
            .toISOString()
            .slice(0, 10),
        externalSource:
          props.item.source,
        externalId:
          props.item.sourceEventId,
        ticketUrl:
          props.item.ticketUrl ??
          props.item.url,
      };

    if (artistImageUrl) {
      draft.artistImageUrl =
        artistImageUrl;
    }

    props.onAddToGigs(draft);
  };

  return (
    <View style={styles.resultCard}>
      <View style={styles.resultTopRow}>
        {artistImageUrl ? (
          <Image
            source={{
              uri: artistImageUrl,
            }}
            style={
              styles.resultArtistImage
            }
            resizeMode="cover"
          />
        ) : (
          <View style={styles.resultIcon}>
            {artistImageLoading ? (
              <ActivityIndicator
                size="small"
                color="#7EB6FF"
              />
            ) : (
              <Ionicons
                name="musical-notes"
                size={17}
                color="#7EB6FF"
              />
            )}
          </View>
        )}

        <View
          style={styles.resultTitleWrap}
        >
          <Text
            style={styles.resultTitle}
          >
            {eventName}
          </Text>

          <Text
            style={styles.resultMeta}
          >
            {v.venue} •{" "}
            {city || "Unknown city"}
          </Text>
        </View>
      </View>

      {date ? (
        <View style={styles.datePill}>
          <Ionicons
            name="calendar-outline"
            size={13}
            color={Colours.text.muted}
          />

          <Text
            style={styles.resultDate}
          >
            {displayDate}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleAddGig}
        style={({ pressed }) => [
          styles.addBtn,
          pressed
            ? styles.addBtnPressed
            : null,
        ]}
      >
        <Text style={styles.addBtnText}>
          Add gig
        </Text>
      </Pressable>
    </View>
  );
}

export function DiscoverScreen(props: {
  onAddToGigs: (
    draft: Partial<CreateGigInput>,
  ) => void;
  onPressLogo?: () => void;
  scrollToTopSignal?: number;
}) {
  const scrollY =
    React.useRef(
      new Animated.Value(0),
    ).current;

  const scrollRef =
    React.useRef<ScrollView>(null);

  const suppressNextArtistSearchRef =
    React.useRef(false);

  const artistSearchSeqRef =
    React.useRef(0);

  const selectedArtistNameRef =
    React.useRef<string | undefined>(
      undefined,
    );

  const [cityInput, setCityInput] =
    React.useState("");

  const [query, setQuery] =
    React.useState("");

  const includeTributeActs = false;

  const [
    artistMbid,
    setArtistMbid,
  ] = React.useState<
    string | undefined
  >();

  const [
    selectedArtistName,
    setSelectedArtistName,
  ] = React.useState<
    string | undefined
  >();

  const [mbLoading, setMbLoading] =
    React.useState(false);

  const [mbResults, setMbResults] =
    React.useState<MbArtist[]>([]);

  const [mbError, setMbError] =
    React.useState("");

  const [mbOpen, setMbOpen] =
    React.useState(false);

  const [
    searchLoading,
    setSearchLoading,
  ] = React.useState(false);

  const [
    searchError,
    setSearchError,
  ] = React.useState("");

  const [
    searchEvents,
    setSearchEvents,
  ] = React.useState<
    DiscoverEvent[]
  >([]);

  const activeCity =
    cityInput.trim();

  const trimmedQuery =
    query.trim();

  const showingSearchResults =
    trimmedQuery.length >= 2 ||
    activeCity.length >= 2;

  React.useEffect(() => {
    if (
      props.scrollToTopSignal ==
      null
    ) {
      return;
    }

    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }, [props.scrollToTopSignal]);

  const runMbSearch =
    React.useCallback(
      async (q: string) => {
        const queryValue =
          q.trim();

        const searchSeq =
          ++artistSearchSeqRef.current;

        if (queryValue.length < 2) {
          setMbResults([]);
          setMbError("");
          setMbLoading(false);
          setMbOpen(false);
          return;
        }

        const selected =
          selectedArtistNameRef.current;

        if (
          selected &&
          sameText(
            queryValue,
            selected,
          )
        ) {
          setMbResults([]);
          setMbError("");
          setMbLoading(false);
          setMbOpen(false);
          return;
        }

        setMbLoading(true);
        setMbError("");

        try {
          const baseQuery = queryValue
  .replace(/[’']/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const queryVariants = Array.from(
  new Set([
    queryValue,
    baseQuery,
    baseQuery.replace(
      /\bn\b/gi,
      "'n'",
    ),
    baseQuery.replace(
      /\bn\b/gi,
      "’n’",
    ),
  ]),
);

          let artists: MbArtist[] = [];

          for (
            const variant of
            queryVariants
          ) {
            try {
              const res =
                await apiGet<MbArtistSearchResponse>(
                  `/mb/artists/search?q=${encodeURIComponent(
                    variant,
                  )}`,
                );

              if (
                searchSeq !==
                artistSearchSeqRef.current
              ) {
                return;
              }

              const foundArtists:
                MbArtist[] =
                (res?.artists as MbArtist[]) ??
                (res?._embedded
                  ?.artists as MbArtist[]) ??
                [];

              if (
                Array.isArray(
                  foundArtists,
                ) &&
                foundArtists.length > 0
              ) {
                artists =
                  foundArtists;
                break;
              }
            } catch (error) {
              console.warn(
                "[discover] MusicBrainz variant lookup failed",
                {
                  query: variant,
                  message:
                    error instanceof Error
                      ? error.message
                      : String(
                          error,
                        ),
                },
              );
            }
          }

          if (
            searchSeq !==
            artistSearchSeqRef.current
          ) {
            return;
          }

          const currentSelected =
            selectedArtistNameRef.current;

          const currentQuery =
            query.trim();

          if (
            currentSelected &&
            sameText(
              currentQuery,
              currentSelected,
            )
          ) {
            setMbResults([]);
            setMbOpen(false);
            return;
          }

          setMbResults(
            artists.slice(0, 8),
          );

          setMbOpen(
            artists.length > 0,
          );
        } catch (e: any) {
          if (
            searchSeq !==
            artistSearchSeqRef.current
          ) {
            return;
          }

          console.warn(
            "[discover] MusicBrainz artist lookup failed",
            {
              query: queryValue,
              message:
                e?.message ??
                "Artist search failed",
            },
          );

          setMbError("");
          setMbResults([]);
          setMbOpen(false);
        } finally {
          if (
            searchSeq ===
            artistSearchSeqRef.current
          ) {
            setMbLoading(false);
          }
        }
      },
      [],
    );

  const chooseArtist = (
    artist: MbArtist,
  ) => {
    suppressNextArtistSearchRef.current =
      true;

    selectedArtistNameRef.current =
      artist.name;

    artistSearchSeqRef.current += 1;

    setQuery(artist.name);

    setSelectedArtistName(
      artist.name,
    );

    setArtistMbid(artist.id);

    setMbOpen(false);
    setMbResults([]);
    setMbError("");
    setMbLoading(false);

    Keyboard.dismiss();
  };

  React.useEffect(() => {
    if (
      suppressNextArtistSearchRef.current
    ) {
      suppressNextArtistSearchRef.current =
        false;

      setMbOpen(false);
      setMbResults([]);
      setMbLoading(false);
      return;
    }

    const q = query.trim();

    if (
      selectedArtistNameRef.current &&
      sameText(
        q,
        selectedArtistNameRef.current,
      )
    ) {
      setMbOpen(false);
      setMbResults([]);
      setMbLoading(false);
      return;
    }

    selectedArtistNameRef.current =
      undefined;

    setArtistMbid(undefined);
    setSelectedArtistName(undefined);

    if (q.length < 2) {
      setMbResults([]);
      setMbOpen(false);
      setMbError("");
      return;
    }

    const t = setTimeout(() => {
      void runMbSearch(q);
    }, 320);

    return () =>
      clearTimeout(t);
  }, [query, runMbSearch]);

  const searchEventsForQuery =
    React.useCallback(async () => {
      if (
        trimmedQuery.length < 2 &&
        activeCity.length < 2
      ) {
        setSearchEvents([]);
        setSearchError("");
        return;
      }

      setSearchLoading(true);
      setSearchError("");

      try {
        const rawEvents =
          (await searchFutureEvents({
            q:
              trimmedQuery.length >= 2
                ? trimmedQuery
                : activeCity,
            city:
              activeCity.length >= 2
                ? activeCity
                : undefined,
            size: 20,
          })) as DiscoverEvent[];

        const cityFilteredEvents =
          activeCity.length >= 2
            ? rawEvents.filter(
                (event) => {
                  const eventCity =
                    String(
                      event.city ?? "",
                    ).toLowerCase();

                  const venueCity =
                    String(
                      event._embedded
                        ?.venues?.[0]
                        ?.city?.name ?? "",
                    ).toLowerCase();

                  const cityNeedle =
                    activeCity.toLowerCase();

                  return (
                    eventCity.includes(
                      cityNeedle,
                    ) ||
                    venueCity.includes(
                      cityNeedle,
                    )
                  );
                },
              )
            : rawEvents;

        const tributeFilteredEvents =
          filterTributeEvents(
            cityFilteredEvents,
            includeTributeActs,
          );

        const artistNameToMatch =
          selectedArtistNameRef.current ??
          trimmedQuery;

        const artistFilteredEvents =
          trimmedQuery.length >= 2
            ? tributeFilteredEvents.filter(
                (event) =>
                  eventMatchesArtistSearch(
                    event,
                    artistNameToMatch,
                  ),
              )
            : tributeFilteredEvents;

        setSearchEvents(
          artistFilteredEvents,
        );
      } catch (e: any) {
        setSearchError(
          e?.message ??
            "Search failed",
        );

        setSearchEvents([]);
      } finally {
        setSearchLoading(false);
      }
    }, [
      activeCity,
      includeTributeActs,
      trimmedQuery,
    ]);

  React.useEffect(() => {
    if (
      trimmedQuery.length < 2 &&
      activeCity.length < 2
    ) {
      setSearchEvents([]);
      setSearchError("");
      return;
    }

    const t = setTimeout(() => {
      void searchEventsForQuery();
    }, 350);

    return () =>
      clearTimeout(t);
  }, [
    trimmedQuery,
    activeCity,
    searchEventsForQuery,
  ]);

  return (
    <SafeAreaView
      style={styles.safe}
    >
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
        keyboardVerticalOffset={8}
      >
        <AppHeader
          onPressLogo={
            props.onPressLogo
          }
          scrollY={scrollY}
        />

        <AnimatedScrollView
          ref={scrollRef}
          style={styles.list}
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={
            false
          }
          onScroll={Animated.event(
            [
              {
                nativeEvent: {
                  contentOffset: {
                    y: scrollY,
                  },
                },
              },
            ],
            {
              useNativeDriver:
                false,
            },
          )}
          scrollEventThrottle={16}
        >
          <View style={styles.heroWrap}>
            <View
              style={styles.searchStack}
            >
              <SearchInput
                icon="search-outline"
                value={query}
                onChangeText={(
                  text,
                ) => {
                  const isStillSelected =
                    selectedArtistNameRef.current &&
                    sameText(
                      text,
                      selectedArtistNameRef.current,
                    );

                  setQuery(text);

                  if (
                    isStillSelected
                  ) {
                    setMbOpen(false);
                    setMbResults([]);
                    setMbLoading(false);
                    return;
                  }

                  selectedArtistNameRef.current =
                    undefined;

                  artistSearchSeqRef.current +=
                    1;

                  setSelectedArtistName(
                    undefined,
                  );

                  setArtistMbid(
                    undefined,
                  );

                  setMbOpen(
                    text.trim()
                      .length >= 2,
                  );
                }}
                placeholder="Search artist"
                autoCapitalize="none"
              />

              {mbLoading ? (
                <View
                  style={
                    styles.loadingRow
                  }
                >
                  <ActivityIndicator />

                  <Text
                    style={
                      styles.loadingText
                    }
                  >
                    {
                      UI_COPY.artistLoading
                    }
                  </Text>
                </View>
              ) : null}

              {mbError ? (
                <Text
                  style={
                    styles.errorText
                  }
                >
                  {mbError}
                </Text>
              ) : null}

              {mbOpen &&
              !mbLoading &&
              mbResults.length > 0 ? (
                <View
                  style={
                    styles.suggestCard
                  }
                >
                  {mbResults.map(
                    (artist) => {
                      const meta = [
                        artist.country,
                        artist.disambiguation,
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <Pressable
                          key={
                            artist.id
                          }
                          onPress={() =>
                            chooseArtist(
                              artist,
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.suggestRow,
                            pressed
                              ? styles.rowPressed
                              : null,
                          ]}
                        >
                          <View
                            style={
                              styles.artistAvatar
                            }
                          >
                            <Ionicons
                              name="musical-note"
                              size={14}
                              color="#7EB6FF"
                            />
                          </View>

                          <View
                            style={
                              styles.flex
                            }
                          >
                            <Text
                              style={
                                styles.suggestTitle
                              }
                            >
                              {
                                artist.name
                              }
                            </Text>

                            {meta ? (
                              <Text
                                style={
                                  styles.suggestMeta
                                }
                              >
                                {
                                  meta
                                }
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    },
                  )}
                </View>
              ) : null}

              {artistMbid ? (
                <View
                  style={
                    styles.matchedPill
                  }
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color="#2EE59D"
                  />

                  <Text
                    style={
                      styles.matchedText
                    }
                  >
                    Matched artist
                  </Text>
                </View>
              ) : null}

              <CitySearchInput
                value={cityInput}
                onChangeText={
                  setCityInput
                }
                placeholder="Search city"
              />

              {showingSearchResults ? (
                searchLoading ? (
                  <View
                    style={
                      styles.loadingRow
                    }
                  >
                    <ActivityIndicator />

                    <Text
                      style={
                        styles.loadingText
                      }
                    >
                      {
                        UI_COPY.searching
                      }
                    </Text>
                  </View>
                ) : searchError ? (
                  <Text
                    style={
                      styles.errorText
                    }
                  >
                    {searchError}
                  </Text>
                ) : null
              ) : null}
            </View>
          </View>

          {showingSearchResults ? (
            <View
              style={
                styles.sectionBlock
              }
            >
              <SectionTitle
                title={
                  activeCity
                    ? `Search results · ${activeCity}`
                    : "Search results"
                }
                subtitle={
                  searchEvents.length >
                  0
                    ? `${
                        searchEvents.length
                      } upcoming ${
                        searchEvents.length ===
                        1
                          ? "gig"
                          : "gigs"
                      } found`
                    : undefined
                }
              />

              {searchEvents.length >
              0 ? (
                <View
                  style={
                    styles.cardList
                  }
                >
                  {searchEvents.map(
                    (
                      item,
                      index,
                    ) => (
                      <View
                        key={getEventKey(
                          item,
                          index,
                        )}
                        style={
                          styles.cardWrap
                        }
                      >
                        <EventCard
                          item={item}
                          cityFallback={
                            activeCity
                          }
                          onAddToGigs={
                            props.onAddToGigs
                          }
                        />
                      </View>
                    ),
                  )}
                </View>
              ) : !searchLoading ? (
                <View
                  style={
                    styles.emptyCard
                  }
                >
                  <Ionicons
                    name="radio-outline"
                    size={22}
                    color={
                      Colours.text
                        .muted
                    }
                  />

                  <Text
                    style={
                      styles.emptyTitle
                    }
                  >
                    Nothing found yet
                  </Text>

                  <Text
                    style={
                      styles.emptyHint
                    }
                  >
                    {
                      UI_COPY.emptySearch
                    }
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View
              style={
                styles.emptyPlain
              }
            >
              <Ionicons
                name="ticket-outline"
                size={24}
                color={
                  Colours.text.muted
                }
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Start with a search
              </Text>

              <Text
                style={
                  styles.emptyHint
                }
              >
                Search by artist or city
                to find upcoming gigs
              </Text>
            </View>
          )}

          <View
            style={{ height: 24 }}
          />
        </AnimatedScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor:
      Colours.background.app,
  },

  flex: {
    flex: 1,
  },

  keyboardWrap: {
    flex: 1,
  },

  list: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 130,
  },

  heroWrap: {
    marginBottom: 12,
  },

  searchStack: {
    gap: 10,
  },

  searchInputWrap: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor:
      "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  searchInputWrapFocused: {
    borderColor: "#2F8CFF",
    backgroundColor:
      "rgba(47,140,255,0.10)",
  },

  searchInput: {
    flex: 1,
    color: Colours.text.primary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    paddingVertical:
      Platform.OS === "ios"
        ? 13
        : 9,
  },

  clearPressed: {
    opacity: 0.7,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },

  loadingText: {
    color: Colours.text.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },

  errorText: {
    color: Colours.text.danger,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },

  matchedPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor:
      "rgba(46,229,157,0.1)",
  },

  matchedText: {
    color: "#2EE59D",
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 16,
  },

  suggestCard: {
    backgroundColor:
      "rgba(255,255,255,0.04)",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.055)",
  },

  suggestRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor:
      "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  rowPressed: {
    opacity: 0.9,
  },

  artistAvatar: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor:
      "rgba(126,182,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  suggestTitle: {
    color: Colours.text.primary,
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 18,
  },

  suggestMeta: {
    marginTop: 2,
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  sectionBlock: {
    marginTop: 14,
  },

  sectionTitleWrap: {
    marginBottom: 10,
  },

  sectionTitle: {
    color: Colours.text.primary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  sectionSubtitle: {
    marginTop: 4,
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  cardList: {
    gap: 10,
  },

  cardWrap: {
    width: "100%",
  },

  resultCard: {
    backgroundColor:
      "rgba(255,255,255,0.045)",
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.075)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },

  resultTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },

  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor:
      "rgba(126,182,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  resultArtistImage: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor:
      "rgba(126,182,255,0.1)",
  },

  resultTitleWrap: {
    flex: 1,
  },

  resultTitle: {
    color: Colours.text.primary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.15,
  },

  resultMeta: {
    color: Colours.text.muted,
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },

  datePill: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor:
      "rgba(255,255,255,0.055)",
  },

  resultDate: {
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },

  addBtn: {
    marginTop: 14,
    height: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#2F8CFF",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#2F8CFF",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
  },

  addBtnPressed: {
    opacity: 0.9,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  addBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  emptyCard: {
    marginTop: 20,
    borderRadius: 20,
    padding: 18,
    backgroundColor:
      "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.07)",
    alignItems: "center",
    gap: 8,
  },

  emptyPlain: {
    marginTop: 34,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: "center",
    gap: 8,
  },

  emptyTitle: {
    color: Colours.text.primary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },

  emptyHint: {
    color: Colours.text.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
  },
});