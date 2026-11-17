import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { apiDelete } from "./api";
import { supabase } from "./supabase";
import { posthog } from "./analytics";
import { deleteLocalProfile } from "./localProfile";
import { setCachedGigs } from "./gigsCache";
import {
  clearQueue,
  pauseGigQueueForDeletion,
  resumeGigQueueAfterDeletion,
} from "./offlineQueue";

const PENDING_KEY = "wegig.accountDeletionPending";
const listeners = new Set<() => void>();

const LOCAL_KEYS = [
  "wegig.firstGigId",
  "wegig.favouriteGigId",
  "wegig.notifyGigReminder",
  "wegig.notifyRateReminder",
  "wegig.notificationIds",
  "wegig:gigs:cache:v1",
  "wegig:gigs:cacheMeta:v1",
];

export type PendingDeletion = {
  userId: string;
  serverDeleted: boolean;
};

export async function getPendingAccountDeletion():
Promise<PendingDeletion | null> {
  const stored = await AsyncStorage.getItem(PENDING_KEY);
  if (!stored) return null;

  const value = JSON.parse(stored);

  if (
    typeof value.userId !== "string" ||
    !value.userId ||
    typeof value.serverDeleted !== "boolean"
  ) {
    throw new Error("Account deletion recovery data could not be read.");
  }

  return value;
}

export function subscribeToAccountDeletion(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  listeners.forEach(listener => listener());
}

export async function beginAccountDeletion(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    throw new Error("Please sign in again before deleting your account.");
  }

  const existing = await getPendingAccountDeletion();

  if (existing && existing.userId !== data.session.user.id) {
    throw new Error("Another account has unfinished deletion cleanup.");
  }

  const pending: PendingDeletion = existing ?? {
    userId: data.session.user.id,
    serverDeleted: false,
  };

  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  notifyListeners();
}

export async function deleteMyAccount(): Promise<void> {
  const pending = await getPendingAccountDeletion();

  if (!pending) {
    throw new Error("No confirmed account deletion is pending.");
  }

  await pauseGigQueueForDeletion();

  if (!pending.serverDeleted) {
    const { data, error } = await supabase.auth.getSession();

    if (error || data.session?.user.id !== pending.userId) {
      throw new Error(
        "Deletion needs your original sign-in session. Please contact WeGig support if it has expired.",
      );
    }

    const result = await apiDelete<{ deleted: boolean }>("/account", {
      confirmation: "DELETE",
    });

    if (result?.deleted !== true) {
      throw new Error("Deletion could not be confirmed. Please retry.");
    }

    pending.serverDeleted = true;
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  }

  await clearQueue();
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
  await deleteLocalProfile(pending.userId);
  await setCachedGigs([]);
  await AsyncStorage.multiRemove(LOCAL_KEYS);

  posthog.reset();

  const result = await supabase.auth.signOut({ scope: "local" });

  if (result.error) {
    throw new Error(
      "Your account was deleted, but device cleanup needs another attempt.",
    );
  }

  await AsyncStorage.removeItem(PENDING_KEY);
  resumeGigQueueAfterDeletion();
  notifyListeners();
}