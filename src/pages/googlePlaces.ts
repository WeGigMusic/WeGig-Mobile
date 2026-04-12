const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

console.log(
  "GOOGLE PLACES API KEY:",
  API_KEY ? `${API_KEY.slice(0, 8)}...` : "MISSING",
);

function requireApiKey(): string {
  if (!API_KEY) {
    throw new Error("Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");
  }

  return API_KEY;
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
  if (!input.trim()) return [];

  const cityHint = options?.cityHint?.trim();
  const fullInput = cityHint ? `${input} ${cityHint}` : input;

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
        "X-Goog-Api-Key": requireApiKey(),
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Autocomplete failed: ${response.status} ${errorText}`);
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
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": requireApiKey(),
        "X-Goog-Session-Token": sessionToken,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,addressComponents,location",
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Place details failed: ${response.status} ${errorText}`);
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