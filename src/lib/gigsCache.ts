import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Gig,
  CreateGigInput,
} from "../shared/types/Gig";

const GIGS_CACHE_KEY =
  "wegig:gigs:cache:v1";

const GIGS_CACHE_META_KEY =
  "wegig:gigs:cacheMeta:v1";

let gigsCache: Gig[] = [];
let lastUpdatedAt = 0;

export async function hydrateCachedGigs() {
  try {
    const entries =
      await AsyncStorage.multiGet([
        GIGS_CACHE_KEY,
        GIGS_CACHE_META_KEY,
      ]);

    const gigsRaw =
      entries[0]?.[1] ?? null;

    const metaRaw =
      entries[1]?.[1] ?? null;

    try {
      const parsed =
        gigsRaw
          ? JSON.parse(gigsRaw)
          : [];

      gigsCache =
        Array.isArray(parsed)
          ? parsed
          : [];
    } catch {
      gigsCache = [];
    }

    try {
      const meta =
        metaRaw
          ? JSON.parse(metaRaw)
          : null;

      lastUpdatedAt =
        typeof meta?.lastUpdatedAt ===
        "number"
          ? meta.lastUpdatedAt
          : 0;
    } catch {
      lastUpdatedAt = 0;
    }
  } catch {
    gigsCache = [];
    lastUpdatedAt = 0;
  }
}

export async function setCachedGigs(
  next: Gig[],
) {
  gigsCache =
    Array.isArray(next)
      ? next
      : [];

  lastUpdatedAt =
    Date.now();

  try {
    await AsyncStorage.multiSet([
      [
        GIGS_CACHE_KEY,
        JSON.stringify(
          gigsCache,
        ),
      ],
      [
        GIGS_CACHE_META_KEY,
        JSON.stringify({
          lastUpdatedAt,
        }),
      ],
    ]);
  } catch {}
}

export function getCachedGigs(): Gig[] {
  return gigsCache;
}

export function getCachedGigsMeta() {
  return {
    count: gigsCache.length,
    lastUpdatedAt,
  };
}

function norm(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toLowerCase();
}

export function findDuplicateGig(
  draft: Partial<CreateGigInput> & {
    externalSource?: any;
    externalId?: any;
  },
  gigs: Gig[] = gigsCache,
): Gig | null {
  const artist =
    norm(
      (draft as any).artist,
    );

  const venue =
    norm(
      (draft as any).venue,
    );

  const city =
    norm(
      (draft as any).city,
    );

  const date =
    norm(
      (draft as any).date,
    );

  const externalSource =
    norm(
      (draft as any)
        .externalSource,
    );

  const externalId =
    norm(
      (draft as any)
        .externalId,
    );

  return (
    gigs.find((gig) => {
      const gigExternalSource =
        norm(
          (gig as any)
            .externalSource,
        );

      const gigExternalId =
        norm(
          (gig as any)
            .externalId,
        );

      const matchesExternal =
        Boolean(
          externalSource &&
            externalId &&
            gigExternalSource ===
              externalSource &&
            gigExternalId ===
              externalId,
        );

      const matchesManual =
        Boolean(
          artist &&
            venue &&
            city &&
            date &&
            norm(gig.artist) ===
              artist &&
            norm(gig.venue) ===
              venue &&
            norm(gig.city) ===
              city &&
            norm(gig.date) ===
              date,
        );

      return (
        matchesExternal ||
        matchesManual
      );
    }) ?? null
  );
}