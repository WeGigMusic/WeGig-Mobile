export const env = {
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "",
};

export function requireMapboxToken() {
  if (!env.mapboxToken) {
    throw new Error("Missing EXPO_PUBLIC_MAPBOX_TOKEN");
  }

  return env.mapboxToken;
}