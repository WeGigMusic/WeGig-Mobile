// src/lib/gigsCache.ts
import type { Gig, CreateGigInput } from "../shared/types/Gig";

let gigsCache: Gig[] = [];
let lastUpdatedAt = 0;

export function setCachedGigs(next: Gig[]) {
  gigsCache = Array.isArray(next) ? next : [];
  lastUpdatedAt = Date.now();
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

/**
 * Client-side duplicate check:
 * same artist+venue+city+date OR same externalSource+externalId
 */
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
        externalSource && externalId && gExtSource === externalSource && gExtId === externalId;

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
