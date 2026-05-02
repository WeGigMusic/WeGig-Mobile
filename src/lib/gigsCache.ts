import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Gig, CreateGigInput } from "../shared/types/Gig";

const GIGS_CACHE_KEY = "wegig:gigs:cache:v1";
const GIGS_CACHE_META_KEY = "wegig:gigs:cacheMeta:v1";

let gigsCache: Gig[] = [];
let lastUpdatedAt = 0;

export async function hydrateCachedGigs() {
  try {
    const raw = await AsyncStorage.getItem(GIGS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    gigsCache = Array.isArray(parsed) ? parsed : [];
  } catch {
    gigsCache = [];
  }

  try {
    const rawMeta = await AsyncStorage.getItem(GIGS_CACHE_META_KEY);
    const meta = rawMeta ? JSON.parse(rawMeta) : null;
    lastUpdatedAt = typeof meta?.lastUpdatedAt === "number" ? meta.lastUpdatedAt : 0;
  } catch {
    lastUpdatedAt = 0;
  }
}

export async function setCachedGigs(next: Gig[]) {
  gigsCache = Array.isArray(next) ? next : [];
  lastUpdatedAt = Date.now();

  await AsyncStorage.setItem(GIGS_CACHE_KEY, JSON.stringify(gigsCache));
  await AsyncStorage.setItem(
    GIGS_CACHE_META_KEY,
    JSON.stringify({ lastUpdatedAt }),
  );
}

export function getCachedGigs(): Gig[] {
  return gigsCache;
}

export function getCachedGigsMeta() {
  return { count: gigsCache.length, lastUpdatedAt };
}

function norm(s: unknown) {
  return String(s ?? "").trim().toLowerCase();
}

export function findDuplicateGig(
  draft: Partial<CreateGigInput> & { externalSource?: any; externalId?: any },
  gigs: Gig[] = gigsCache,
): Gig | null {
  const artist = norm((draft as any).artist);
  const venue = norm((draft as any).venue);
  const city = norm((draft as any).city);
  const date = norm((draft as any).date);

  const externalSource = norm((draft as any).externalSource);
  const externalId = norm((draft as any).externalId);

  return (
    gigs.find((g) => {
      const gExtSource = norm((g as any).externalSource);
      const gExtId = norm((g as any).externalId);

      const matchesExternal =
        externalSource &&
        externalId &&
        gExtSource === externalSource &&
        gExtId === externalId;

      const matchesManual =
        artist &&
        venue &&
        city &&
        date &&
        norm(g.artist) === artist &&
        norm(g.venue) === venue &&
        norm(g.city) === city &&
        norm(g.date) === date;

      return matchesExternal || matchesManual;
    }) ?? null
  );
}