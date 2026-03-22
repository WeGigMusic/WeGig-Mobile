import { requireMapboxToken } from "../config/env";

type MapboxContextItem = {
  id?: string;
  text?: string;
  short_code?: string;
};

type MapboxFeature = {
  id: string;
  place_name?: string;
  text?: string;
  center?: [number, number];
  place_type?: string[];
  context?: MapboxContextItem[];
};

type MapboxResponse = {
  features?: MapboxFeature[];
};

function getContextText(
  feature: MapboxFeature,
  prefix: string,
): string | undefined {
  return feature.context?.find((item) => item.id?.startsWith(prefix))?.text;
}

function pickBestCity(feature: MapboxFeature): string {
  return (
    feature.text ||
    getContextText(feature, "place") ||
    getContextText(feature, "locality") ||
    getContextText(feature, "district") ||
    getContextText(feature, "region") ||
    ""
  );
}

export async function reverseGeocodeCity(params: {
  latitude: number;
  longitude: number;
}): Promise<string> {
  const token = requireMapboxToken();

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${params.longitude},${params.latitude}.json` +
    `?access_token=${encodeURIComponent(token)}` +
    `&types=place,locality,district,region` +
    `&language=en` +
    `&country=gb` +
    `&limit=1`;

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mapbox reverse geocode failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as MapboxResponse;
  const feature = json.features?.[0];

  if (!feature) {
    throw new Error("No Mapbox location result found");
  }

  const city = pickBestCity(feature).trim();

  if (!city) {
    throw new Error("Mapbox could not resolve a city");
  }

  return city;
}

export type MapboxPlaceResult = {
  id: string;
  name: string;
  placeName: string;
  city?: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

export async function searchPlaces(params: {
  query: string;
  cityHint?: string;
  limit?: number;
}): Promise<MapboxPlaceResult[]> {
  const token = requireMapboxToken();
  const query = params.query.trim();

  if (!query) return [];

  const searchText = params.cityHint?.trim()
    ? `${query} ${params.cityHint.trim()}`
    : query;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(searchText)}.json` +
    `?access_token=${encodeURIComponent(token)}` +
    `&autocomplete=true` +
    `&language=en` +
    `&country=gb` +
    `&limit=${encodeURIComponent(String(params.limit ?? 8))}` +
    `&types=place,locality,district`;

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mapbox place search failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as MapboxResponse;
  const queryLower = query.toLowerCase();

  return (json.features ?? [])
    .filter(
      (feature): feature is MapboxFeature & { center: [number, number] } =>
        Array.isArray(feature.center) && feature.center.length === 2,
    )
    .filter((feature) => {
      const haystack = [
        feature.text,
        feature.place_name,
        getContextText(feature, "place"),
        getContextText(feature, "locality"),
        getContextText(feature, "district"),
        getContextText(feature, "region"),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(queryLower);
    })
    .map((feature) => ({
      id: feature.id,
      name:
        feature.text?.trim() || feature.place_name?.trim() || "Unknown place",
      placeName:
        feature.place_name?.trim() ||
        feature.text?.trim() ||
        "Unknown place",
      city:
        getContextText(feature, "place") ||
        getContextText(feature, "locality") ||
        getContextText(feature, "district"),
      region: getContextText(feature, "region"),
      country: getContextText(feature, "country"),
      latitude: feature.center[1],
      longitude: feature.center[0],
    }))
    .sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      const aStarts = aName.startsWith(queryLower) ? 1 : 0;
      const bStarts = bName.startsWith(queryLower) ? 1 : 0;

      return bStarts - aStarts;
    });
}