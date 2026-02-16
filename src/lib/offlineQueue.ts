// src/lib/offlineQueue.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiPost } from "./api";
import type { Gig } from "../shared/types/Gig";

const KEY = "wegig:offline:gigQueue:v1";

export type QueuedGig = {
  id: string; // local id
  createdAt: number;
  payload: any; // CreateGigInput + optional fields
};

function safeJsonParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export async function getQueuedGigs(): Promise<QueuedGig[]> {
  const raw = await AsyncStorage.getItem(KEY);
  const list = safeJsonParse<QueuedGig[]>(raw, []);
  return Array.isArray(list) ? list : [];
}

export async function getQueuedGigsCount(): Promise<number> {
  const list = await getQueuedGigs();
  return list.length;
}

export async function enqueueGig(payload: any): Promise<void> {
  const list = await getQueuedGigs();

  const item: QueuedGig = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    payload,
  };

  list.push(item);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

function isProbablyOfflineError(e: any): boolean {
  const msg = String(e?.message ?? "").toLowerCase();

  // Common RN/Expo fetch failure strings
  return (
    msg.includes("network request failed") ||
    msg.includes("request timed out") ||
    msg.includes("timed out") ||
    msg.includes("failed to fetch") ||
    msg.includes("socket") ||
    msg.includes("offline")
  );
}

/**
 * Try sending queued gigs to API.
 * - On success: remove them from queue.
 * - If still offline: stop early (keep remaining).
 * - If server rejects (400/409/etc): drop that item (so it doesn’t block the queue).
 */
export async function flushGigQueue(): Promise<{
  sent: number;
  remaining: number;
  dropped: number;
}> {
  const list = await getQueuedGigs();
  if (list.length === 0) return { sent: 0, remaining: 0, dropped: 0 };

  const remaining: QueuedGig[] = [];
  let sent = 0;
  let dropped = 0;

  for (const item of list) {
    try {
      // If your API returns 409 for duplicates, that will throw in api.ts -> we catch below
      await apiPost<Gig>("/gigs", item.payload);
      sent += 1;
    } catch (e: any) {
      // If still offline, keep this + stop (avoid burning battery)
      if (isProbablyOfflineError(e)) {
        remaining.push(item);
        // keep the rest too
        remaining.push(...list.slice(list.indexOf(item) + 1));
        break;
      }

      // If it’s a server/validation/dup error: drop it so it doesn’t block the queue.
      dropped += 1;
    }
  }

  await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
  return { sent, remaining: remaining.length, dropped };
}

export function isOfflineError(e: any): boolean {
  return isProbablyOfflineError(e);
}