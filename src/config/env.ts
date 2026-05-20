export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export function requireEnv(value: string, name: string) {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

export function requireApiBaseUrl() {
  return requireEnv(
    env.apiBaseUrl,
    "EXPO_PUBLIC_API_BASE_URL",
  );
}

export function requireMapboxToken() {
  return requireEnv(
    env.mapboxToken,
    "EXPO_PUBLIC_MAPBOX_TOKEN",
  );
}

export function requireSupabaseConfig() {
  return {
    url: requireEnv(
      env.supabaseUrl,
      "EXPO_PUBLIC_SUPABASE_URL",
    ),
    anonKey: requireEnv(
      env.supabaseAnonKey,
      "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    ),
  };
}