import AsyncStorage from "@react-native-async-storage/async-storage";

const ARTIST_IMAGE_CACHE_KEY =
  "wegig:artist-images:v2";

type ArtistImageCache =
  Record<string, string>;

let cache: ArtistImageCache = {};

function normalizeArtist(
  artist: string,
) {
  return artist
    .trim()
    .toLowerCase();
}

export async function hydrateArtistImageCache() {
  try {
    const raw =
      await AsyncStorage.getItem(
        ARTIST_IMAGE_CACHE_KEY,
      );

    if (!raw) {
      cache = {};
      return;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      cache = {};
      return;
    }

    const cleaned: ArtistImageCache =
      {};

    for (
      const [key, value] of
      Object.entries(parsed)
    ) {
      if (
        typeof value === "string" &&
        value.trim()
      ) {
        cleaned[key] =
          value.trim();
      }
    }

    cache = cleaned;
  } catch {
    cache = {};
  }
}

export function getArtistImageCache(): ArtistImageCache {
  return {
    ...cache,
  };
}

export async function setArtistImageCacheEntry(
  artist: string,
  imageUrl: string | null,
) {
  const key =
    normalizeArtist(artist);

  const url =
    String(
      imageUrl ?? "",
    ).trim();

  if (!key || !url) {
    return;
  }

  cache[key] = url;

  try {
    await AsyncStorage.setItem(
      ARTIST_IMAGE_CACHE_KEY,
      JSON.stringify(cache),
    );
  } catch {}
}