// src/lib/offlineQueue.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiDelete, apiPatch, apiPost } from "./api";
import type { CreateGigInput, Gig } from "../shared/types/Gig";

const KEY = "wegig:offline:gigQueue:v2";

export type QueuedAction =
  | {
      id: string;
      createdAt: number;
      type: "CREATE_GIG";
      payload: CreateGigInput;
    }
  | {
      id: string;
      createdAt: number;
      type: "UPDATE_GIG";
      gigId: string;
      payload: Partial<CreateGigInput>;
    }
  | {
      id: string;
      createdAt: number;
      type: "DELETE_GIG";
      gigId: string;
    };

function safeJsonParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;

  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function createQueueId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function saveQueue(list: QueuedAction[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  const raw = await AsyncStorage.getItem(KEY);
  const list = safeJsonParse<QueuedAction[]>(raw, []);
  return Array.isArray(list) ? list : [];
}

export async function getQueuedGigs(): Promise<QueuedAction[]> {
  return getQueuedActions();
}

export async function getQueuedGigsCount(): Promise<number> {
  const list = await getQueuedActions();
  return list.length;
}

export async function enqueueGig(payload: CreateGigInput): Promise<void> {
  const list = await getQueuedActions();

  const item: QueuedAction = {
    id: createQueueId(),
    createdAt: Date.now(),
    type: "CREATE_GIG",
    payload,
  };

  list.push(item);
  await saveQueue(list);
}

export async function enqueueGigUpdate(
  gigId: string,
  payload: Partial<CreateGigInput>,
): Promise<void> {
  const list = await getQueuedActions();

  const item: QueuedAction = {
    id: createQueueId(),
    createdAt: Date.now(),
    type: "UPDATE_GIG",
    gigId,
    payload,
  };

  list.push(item);
  await saveQueue(list);
}

export async function enqueueGigDelete(gigId: string): Promise<void> {
  const list = await getQueuedActions();

  const item: QueuedAction = {
    id: createQueueId(),
    createdAt: Date.now(),
    type: "DELETE_GIG",
    gigId,
  };

  list.push(item);
  await saveQueue(list);
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

function isProbablyOfflineError(e: any): boolean {
  const msg = String(e?.message ?? "").toLowerCase();

  return (
    msg.includes("network request failed") ||
    msg.includes("request timed out") ||
    msg.includes("timed out") ||
    msg.includes("failed to fetch") ||
    msg.includes("socket") ||
    msg.includes("offline")
  );
}

async function sendQueuedAction(item: QueuedAction): Promise<void> {
  if (item.type === "CREATE_GIG") {
    await apiPost<Gig>("/gigs", item.payload);
    return;
  }

  if (item.type === "UPDATE_GIG") {
    await apiPatch<Gig>(`/gigs/${item.gigId}`, item.payload);
    return;
  }

  if (item.type === "DELETE_GIG") {
    await apiDelete(`/gigs/${item.gigId}`);
  }
}

export async function flushGigQueue(): Promise<{
  sent: number;
  remaining: number;
  dropped: number;
}> {
  const list = await getQueuedActions();

  if (list.length === 0) {
    return { sent: 0, remaining: 0, dropped: 0 };
  }

  const remaining: QueuedAction[] = [];
  let sent = 0;
  let dropped = 0;

  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];

    try {
      await sendQueuedAction(item);
      sent += 1;
    } catch (e: any) {
      if (isProbablyOfflineError(e)) {
        remaining.push(item);
        remaining.push(...list.slice(index + 1));
        break;
      }

      dropped += 1;
    }
  }

  await saveQueue(remaining);

  return {
    sent,
    remaining: remaining.length,
    dropped,
  };
}

export function isOfflineError(e: any): boolean {
  return isProbablyOfflineError(e);
}