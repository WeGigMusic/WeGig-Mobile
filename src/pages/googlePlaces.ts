const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

function getApiKey(): string | null {
  return API_KEY?.trim() || null;
}

export type PlaceSuggestion = {
  placeId: string;
  title: string;
  subtitle?: string;
};

export type PlaceDetails = {
  placeId: string;
  venueName: string;
  city: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
};

export type VenueSearchOptions = {
  cityHint?: string;
  locationBias?: {
    latitude: number;
    longitude: number;
    radiusMeters?: number;
  };
};

export const createSessionToken = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const searchVenues = async (
  input: string,
  sessionToken: string,
  options?: VenueSearchOptions,
): Promise<PlaceSuggestion[]> => {
  const trimmedInput = input.trim();
  if (!trimmedInput) return [];

  const apiKey = getApiKey();

  if (!apiKey) {
    return [];
  }

  const cityHint = options?.cityHint?.trim();
  const fullInput = cityHint ? `${trimmedInput} ${cityHint}` : trimmedInput;

  const body: Record<string, any> = {
    input: fullInput,
    sessionToken,
    includedPrimaryTypes: [
      "stadium",
      "concert_hall",
      "performing_arts_theater",
      "event_venue",
    ],
    languageCode: "en",
  };

  if (options?.locationBias) {
    body.locationBias = {
      circle: {
        center: {
          latitude: options.locationBias.latitude,
          longitude: options.locationBias.longitude,
        },
        radius: options.locationBias.radiusMeters ?? 50000,
      },
    };
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  return (data.suggestions ?? [])
    .map((item: any) => item.placePrediction)
    .filter(Boolean)
    .map((place: any) => ({
      placeId: place.placeId,
      title: place.text?.text ?? "",
      subtitle: place.structuredFormat?.secondaryText?.text,
    }));
};

export const getPlaceDetails = async (
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetails> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("Venue details unavailable");
  }

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-Session-Token": sessionToken,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,addressComponents,location",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Venue details unavailable");
  }

  const data = await response.json();

  return {
    placeId: data.id,
    venueName: data.displayName?.text ?? "",
    city: extractCity(data.addressComponents),
    formattedAddress: data.formattedAddress,
    latitude: data.location?.latitude,
    longitude: data.location?.longitude,
  };
};

const extractCity = (components: any[] = []): string => {
  const preferredTypes = [
    "locality",
    "postal_town",
    "administrative_area_level_2",
  ];

  for (const type of preferredTypes) {
    const match = components.find((component) =>
      (component.types ?? []).includes(type),
    );

    if (match?.longText) {
      return match.longText;
    }
  }

  return "";
};