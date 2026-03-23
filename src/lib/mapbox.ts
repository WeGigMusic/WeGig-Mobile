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

type AllowedPlaceType = "place" | "locality";

const ALLOWED_PLACE_TYPES = new Set<AllowedPlaceType>(["place", "locality"]);

function getContextText(
  feature: MapboxFeature,
  prefix: string,
): string | undefined {
  return feature.context?.find((item) => item.id?.startsWith(prefix))?.text;
}

function getPrimaryPlaceType(
  feature: MapboxFeature,
): AllowedPlaceType | undefined {
  const primaryType = feature.place_type?.[0];

  if (primaryType === "place" || primaryType === "locality") {
    return primaryType;
  }

  return undefined;
}

function isAllowedPlaceFeature(
  feature: MapboxFeature,
): feature is MapboxFeature & {
  center: [number, number];
  place_type: AllowedPlaceType[];
} {
  return (
    Array.isArray(feature.center) &&
    feature.center.length === 2 &&
    !!getPrimaryPlaceType(feature)
  );
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ");
}

function getDisplayName(feature: MapboxFeature): string {
  return feature.text?.trim() || "";
}

function getRegion(feature: MapboxFeature): string | undefined {
  return getContextText(feature, "region");
}

function getCountry(feature: MapboxFeature): string | undefined {
  return getContextText(feature, "country");
}

function getFullPlaceLabel(feature: MapboxFeature): string {
  const name = getDisplayName(feature);
  const region = getRegion(feature);
  const country = getCountry(feature);

  return [name, region, country].filter(Boolean).join(", ");
}

function scoreFeature(feature: MapboxFeature, query: string): number {
  const normalizedQuery = normalizeText(query);
  const name = normalizeText(feature.text || "");
  const placeName = normalizeText(feature.place_name || "");
  const primaryType = getPrimaryPlaceType(feature);

  let score = 0;

  if (name === normalizedQuery) score += 100;
  if (name.startsWith(normalizedQuery)) score += 40;
  if (name.includes(normalizedQuery)) score += 20;
  if (placeName.includes(normalizedQuery)) score += 10;
  if (primaryType === "place") score += 5;

  return score;
}

function dedupePlaces(
  places: MapboxPlaceResult[],
): MapboxPlaceResult[] {
  const seen = new Set<string>();

  return places.filter((place) => {
    const key = [
      normalizeText(place.name),
      normalizeText(place.region || ""),
      normalizeText(place.country || ""),
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    `&types=place,locality` +
    `&language=en` +
    `&country=gb` +
    `&limit=5`;

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mapbox reverse geocode failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as MapboxResponse;

  const feature = (json.features ?? []).find(
    (item) => !!getPrimaryPlaceType(item) && !!item.text?.trim(),
  );

  if (!feature) {
    throw new Error("No Mapbox town/city result found");
  }

  const city = getDisplayName(feature);

  if (!city) {
    throw new Error("Mapbox could not resolve a town/city");
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
    `&types=place,locality`;

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mapbox place search failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as MapboxResponse;
  const normalizedQuery = normalizeText(query);

  const results = (json.features ?? [])
    .filter(isAllowedPlaceFeature)
    .filter((feature) => {
      const name = normalizeText(feature.text || "");
      const placeName = normalizeText(feature.place_name || "");

      return (
        name.includes(normalizedQuery) || placeName.includes(normalizedQuery)
      );
    })
    .sort((a, b) => scoreFeature(b, query) - scoreFeature(a, query))
    .map((feature) => {
      const name = getDisplayName(feature);
      const region = getRegion(feature);
      const country = getCountry(feature);

      return {
        id: feature.id,
        name,
        placeName: getFullPlaceLabel(feature) || name || "Unknown place",
        city: name,
        region,
        country,
        latitude: feature.center[1],
        longitude: feature.center[0],
      };
    });

  return dedupePlaces(results);
}