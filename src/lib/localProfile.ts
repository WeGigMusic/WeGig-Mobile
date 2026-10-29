import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

export type LocalProfile = {
  displayName: string;
  avatarPreset: string;
  avatarFile: string;
};

const LEGACY_KEYS = ["wegig.displayName", "wegig.avatarPreset", "wegig.avatarUri"];
const MIGRATION_OWNER_KEY = "wegig.profileMigrationOwner";
const blankProfile = (): LocalProfile => ({
  displayName: "Music Fan", avatarPreset: "", avatarFile: "",
});
const profileKey = (userId: string) => `wegig.profile.v1.${userId}`;

function photoDirectory(userId: string) {
  if (!FileSystem.documentDirectory) throw new Error("Profile storage is unavailable.");
  return `${FileSystem.documentDirectory}profiles/${encodeURIComponent(userId)}/`;
}

export function profilePhotoUri(userId: string, filename: string) {
  if (!filename || !/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|heic|webp)$/i.test(filename)) return "";
  return `${photoDirectory(userId)}${filename}`;
}

export async function loadLocalProfile(userId: string): Promise<LocalProfile> {
  const stored = await AsyncStorage.getItem(profileKey(userId));
  if (!stored) return blankProfile();
  const value = JSON.parse(stored);
  return {
    displayName: typeof value.displayName === "string" && value.displayName.trim()
      ? value.displayName.trim() : "Music Fan",
    avatarPreset: typeof value.avatarPreset === "string" ? value.avatarPreset : "",
    avatarFile: typeof value.avatarFile === "string" ? value.avatarFile : "",
  };
}

export async function saveLocalProfile(userId: string, profile: LocalProfile) {
  await AsyncStorage.setItem(profileKey(userId), JSON.stringify(profile));
}

export async function copyProfilePhoto(userId: string, sourceUri: string) {
  const directory = photoDirectory(userId);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const extension = sourceUri.split(/[?#]/)[0].match(/\.(jpg|jpeg|png|heic|webp)$/i)?.[1] ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const uri = profilePhotoUri(userId, filename);
  await FileSystem.copyAsync({ from: sourceUri, to: uri });
  return filename;
}

export async function existingProfilePhoto(userId: string, filename: string) {
  const uri = profilePhotoUri(userId, filename);
  if (!uri) return "";
  try {
    return (await FileSystem.getInfoAsync(uri)).exists ? uri : "";
  } catch {
    return "";
  }
}

export async function deleteProfilePhoto(userId: string, filename: string) {
  const uri = profilePhotoUri(userId, filename);
  if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function hasLegacyProfile(userId: string) {
  const [owner, current, ...legacy] = await Promise.all([
    AsyncStorage.getItem(MIGRATION_OWNER_KEY),
    AsyncStorage.getItem(profileKey(userId)),
    ...LEGACY_KEYS.map((key) => AsyncStorage.getItem(key)),
  ]);
  return (!owner || owner === userId) && !current && legacy.some((value) => !!value?.trim());
}

export async function importLegacyProfile(userId: string) {
  const owner = await AsyncStorage.getItem(MIGRATION_OWNER_KEY);
  if (owner && owner !== userId) throw new Error("These details have already been restored to another account.");
  const [name, preset, uri] = await Promise.all(
    LEGACY_KEYS.map((key) => AsyncStorage.getItem(key)),
  );
  const profile = blankProfile();
  profile.displayName = name?.trim() || "Music Fan";
  profile.avatarPreset = preset?.trim() || "";
  let photoMissing = false;
  if (uri?.trim()) {
    // Old absolute iOS sandbox paths can become stale after an app update.
    let source = uri.trim();
    if (!(await FileSystem.getInfoAsync(source)).exists) {
      const suffix = source.match(/\/(Library\/Caches|Documents)\/(.+)$/);
      const base = suffix?.[1] === "Documents" ? FileSystem.documentDirectory : FileSystem.cacheDirectory;
      if (suffix && base) source = `${base}${suffix[2]}`;
    }
    if ((await FileSystem.getInfoAsync(source)).exists) {
      profile.avatarFile = await copyProfilePhoto(userId, source);
      profile.avatarPreset = "";
    } else {
      photoMissing = true;
    }
  }
  // Claim the unscoped legacy data before saving so it cannot leak into another account.
  await AsyncStorage.setItem(MIGRATION_OWNER_KEY, userId);
  await saveLocalProfile(userId, profile);
  return { profile, photoMissing };
}
