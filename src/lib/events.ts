import { apiGet } from "./api";

export type AppEventSource =
  | "ticketmaster"
  | "skiddle"
  | "eventbrite"
  | "setlistfm";

export type AppEvent = {
  source: AppEventSource;
  sourceEventId: string;

  title: string;

  date?: string;
  time?: string;
  dateTime?: string;

  status?: string;

  ticketUrl?: string;

  venueName?: string;
  city?: string;
  countryCode?: string;

  artists: {
    id?: string;
    name: string;
    imageUrl?: string | null;
  }[];
};

type EventsSearchResponse = {
  mode?: "past" | "future";
  sources?: {
    ticketmaster?: number;
    skiddle?: number;
    setlistfm?: number;
    eventbrite?: number;
  };
  events?: AppEvent[];
};

export async function searchPastEvents(input: {
  artist: string;
  artistMbid?: string;
  city?: string;
  venue?: string;
}): Promise<AppEvent[]> {
  const params = new URLSearchParams({
    mode: "past",
    q: input.artist,
  });

  if (input.artistMbid) params.set("artistMbid", input.artistMbid);
  if (input.city) params.set("city", input.city);
  if (input.venue) params.set("venue", input.venue);

  const res = await apiGet<EventsSearchResponse>(
    `/events/search?${params.toString()}`,
  );

  return Array.isArray(res.events) ? res.events : [];
}

export async function searchFutureEvents(input: {
  q: string;
  city?: string;
  latlong?: string;
  radius?: number;
  startDateTime?: string;
  endDateTime?: string;
  size?: number;
}): Promise<AppEvent[]> {
  const params = new URLSearchParams({
    mode: "future",
    q: input.q,
  });

  if (input.city) params.set("city", input.city);
  if (input.latlong) params.set("latlong", input.latlong);
  if (input.radius != null) params.set("radius", String(input.radius));
  if (input.startDateTime) params.set("startDateTime", input.startDateTime);
  if (input.endDateTime) params.set("endDateTime", input.endDateTime);
  if (input.size != null) params.set("size", String(input.size));

  const res = await apiGet<EventsSearchResponse>(
    `/events/search?${params.toString()}`,
  );

  return Array.isArray(res.events) ? res.events : [];
}

export function getEventArtistName(event: AppEvent): string {
  return event.artists?.[0]?.name || event.title || "";
}

export function getEventDate(event: AppEvent): string {
  return event.date || event.dateTime?.slice(0, 10) || "";
}