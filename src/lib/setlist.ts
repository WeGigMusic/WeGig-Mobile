import { apiGet } from "./api";

export type SetlistItem = {
  id: string;
  eventDate: string;
  venueName: string;
  cityName: string;
  countryCode: string | null;
  url: string | null;
  songCount: number;
};

export type SetlistSearchResult = {
  setlists: SetlistItem[];
  page: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

type SetlistArtistResponse = {
  success: boolean;
  setlists: SetlistItem[];
  page?: number;
  total?: number;
  totalPages?: number;
  hasMore?: boolean;
  message?: string;
};

export function setlistDateToYmd(value: string): string {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return "";

  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

export async function searchArtistSetlists(params: {
  artist: string;
  artistMbid?: string;
  city?: string;
  venue?: string;
  page?: number;
}): Promise<SetlistSearchResult> {
  const artist = params.artist.trim();
  const page = Math.max(1, Number(params.page ?? 1));

  if (!artist) {
    return {
      setlists: [],
      page,
      total: 0,
      totalPages: 0,
      hasMore: false,
    };
  }

  const qs = new URLSearchParams();
  qs.set("artist", artist);
  qs.set("page", String(page));

  if (params.artistMbid?.trim()) {
    qs.set("artistMbid", params.artistMbid.trim());
  }

  if (params.city?.trim()) {
    qs.set("city", params.city.trim());
  }

  if (params.venue?.trim()) {
    qs.set("venue", params.venue.trim());
  }

  const res = await apiGet<SetlistArtistResponse>(
    `/setlist/artist?${qs.toString()}`,
  );

  return {
    setlists: res.setlists ?? [],
    page: res.page ?? page,
    total: res.total ?? res.setlists?.length ?? 0,
    totalPages: res.totalPages ?? 0,
    hasMore: !!res.hasMore,
  };
}