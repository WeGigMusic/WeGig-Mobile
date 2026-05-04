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

type SetlistArtistResponse = {
  success: boolean;
  setlists: SetlistItem[];
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
}): Promise<SetlistItem[]> {
  const artist = params.artist.trim();
  if (!artist) return [];

  const qs = new URLSearchParams();
  qs.set("artist", artist);

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

  return res.setlists ?? [];
}