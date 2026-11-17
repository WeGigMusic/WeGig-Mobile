import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Gig, CreateGigInput } from "../shared/types/Gig";
import {
  captureAccountWork,
  isAccountWorkCurrent,
  runAccountWork,
  type AccountWorkToken,
} from "./accountWork";

const GIGS_CACHE_KEY = "wegig:gigs:cache:v1";
const GIGS_CACHE_META_KEY = "wegig:gigs:cacheMeta:v1";

let gigsCache: Gig[] = [];
let lastUpdatedAt = 0;

export async function hydrateCachedGigs(
  token: AccountWorkToken = captureAccountWork(),
): Promise<void> {
  await runAccountWork(token, async () => {
    try {
      const entries = await AsyncStorage.multiGet([
        GIGS_CACHE_KEY,
        GIGS_CACHE_META_KEY,
      ]);

      if (!isAccountWorkCurrent(token)) return;

      const gigsRaw = entries[0]?.[1] ?? null;
      const metaRaw = entries[1]?.[1] ?? null;

      try {
        const parsed = gigsRaw ? JSON.parse(gigsRaw) : [];
        gigsCache = Array.isArray(parsed) ? parsed : [];
      } catch {
        gigsCache = [];
      }

      try {
        const meta = metaRaw ? JSON.parse(metaRaw) : null;
        lastUpdatedAt =
          typeof meta?.lastUpdatedAt === "number"
            ? meta.lastUpdatedAt
            : 0;
      } catch {
        lastUpdatedAt = 0;
      }
    } catch {
      if (!isAccountWorkCurrent(token)) return;

      gigsCache = [];
      lastUpdatedAt = 0;
    }
  });
}

export async function setCachedGigs(
  next: Gig[],
  token: AccountWorkToken = captureAccountWork(),
): Promise<void> {
  await runAccountWork(token, async () => {
    gigsCache = Array.isArray(next) ? next : [];
    lastUpdatedAt = Date.now();

    try {
      await AsyncStorage.multiSet([
        [GIGS_CACHE_KEY, JSON.stringify(gigsCache)],
        [
          GIGS_CACHE_META_KEY,
          JSON.stringify({ lastUpdatedAt }),
        ],
      ]);
    } catch {}
  });
}

// Deletion cleanup must work while normal account work is paused.
// Storage failures propagate so cleanup can be retried.
export async function clearCachedGigsForDeletion(): Promise<void> {
  gigsCache = [];
  lastUpdatedAt = 0;

  await AsyncStorage.multiRemove([
    GIGS_CACHE_KEY,
    GIGS_CACHE_META_KEY,
  ]);
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

function norm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function findDuplicateGig(
  draft: Partial<CreateGigInput> & {
    externalSource?: any;
    externalId?: any;
  },
  gigs: Gig[] = gigsCache,
): Gig | null {
  const artist = norm(draft.artist);
  const venue = norm(draft.venue);
  const city = norm(draft.city);
  const date = norm(draft.date);
  const externalSource = norm(draft.externalSource);
  const externalId = norm(draft.externalId);

  return (
    gigs.find((gig) => {
      const matchesExternal = Boolean(
        externalSource &&
          externalId &&
          norm(gig.externalSource) === externalSource &&
          norm(gig.externalId) === externalId,
      );

      const matchesManual = Boolean(
        artist &&
          venue &&
          city &&
          date &&
          norm(gig.artist) === artist &&
          norm(gig.venue) === venue &&
          norm(gig.city) === city &&
          norm(gig.date) === date,
      );

      return matchesExternal || matchesManual;
    }) ?? null
  );
}