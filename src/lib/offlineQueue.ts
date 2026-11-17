import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiDelete, apiPatch, apiPost } from "./api";
import type { CreateGigInput, Gig } from "../shared/types/Gig";
import {
  captureAccountWork,
  isAccountWorkCurrent,
  runAccountWork,
  type AccountWorkToken,
} from "./accountWork";

const KEY = "wegig:offline:gigQueue:v2";

type FlushResult = {
  sent: number;
  remaining: number;
  dropped: number;
};

let queuePausedForDeletion = false;
let queueTail: Promise<void> = Promise.resolve();
let activeFlush: Promise<FlushResult> | null = null;

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

function canUseQueue(token: AccountWorkToken): boolean {
  return (
    !queuePausedForDeletion &&
    isAccountWorkCurrent(token)
  );
}

async function runQueueOperation<T>(
  token: AccountWorkToken,
  action: () => Promise<T>,
): Promise<T | undefined> {
  if (!canUseQueue(token)) return undefined;

  return runAccountWork(token, async () => {
    const task = queueTail.then(async () => {
      if (!canUseQueue(token)) return undefined;
      return action();
    });

    queueTail = task.then(
      () => undefined,
      () => undefined,
    );

    return task;
  });
}

function safeJsonParse<T>(
  value: string | null,
  fallback: T,
): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createQueueId(): string {
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
  return (await getQueuedActions()).length;
}

async function enqueueAction(
  item: QueuedAction,
  token: AccountWorkToken,
): Promise<void> {
  const saved = await runQueueOperation(token, async () => {
    const list = await getQueuedActions();

    if (!canUseQueue(token)) return false;

    list.push(item);
    await saveQueue(list);

    return true;
  });

  if (saved !== true || !canUseQueue(token)) {
    throw new Error(
      "This account is being deleted. The gig change was not queued.",
    );
  }
}

export async function enqueueGig(
  payload: CreateGigInput,
  token: AccountWorkToken = captureAccountWork(),
): Promise<void> {
  await enqueueAction(
    {
      id: createQueueId(),
      createdAt: Date.now(),
      type: "CREATE_GIG",
      payload,
    },
    token,
  );
}

export async function enqueueGigUpdate(
  gigId: string,
  payload: Partial<CreateGigInput>,
  token: AccountWorkToken = captureAccountWork(),
): Promise<void> {
  await enqueueAction(
    {
      id: createQueueId(),
      createdAt: Date.now(),
      type: "UPDATE_GIG",
      gigId,
      payload,
    },
    token,
  );
}

export async function enqueueGigDelete(
  gigId: string,
  token: AccountWorkToken = captureAccountWork(),
): Promise<void> {
  await enqueueAction(
    {
      id: createQueueId(),
      createdAt: Date.now(),
      type: "DELETE_GIG",
      gigId,
    },
    token,
  );
}

export async function clearQueue(): Promise<void> {
  await queueTail;
  await AsyncStorage.removeItem(KEY);
}

function isProbablyOfflineError(error: any): boolean {
  const message = String(error?.message ?? "").toLowerCase();

  return (
    message.includes("network request failed") ||
    message.includes("request timed out") ||
    message.includes("timed out") ||
    message.includes("failed to fetch") ||
    message.includes("socket") ||
    message.includes("offline")
  );
}

async function sendQueuedAction(
  item: QueuedAction,
): Promise<void> {
  if (item.type === "CREATE_GIG") {
    await apiPost<Gig>("/gigs", item.payload);
    return;
  }

  if (item.type === "UPDATE_GIG") {
    await apiPatch<Gig>(
      `/gigs/${item.gigId}`,
      item.payload,
    );
    return;
  }

  await apiDelete(`/gigs/${item.gigId}`);
}

async function flushGigQueueInternal(
  token: AccountWorkToken,
): Promise<FlushResult> {
  const list = await getQueuedActions();

  const remaining: QueuedAction[] = [];
  let sent = 0;
  let dropped = 0;

  for (let index = 0; index < list.length; index += 1) {
    if (!canUseQueue(token)) {
      remaining.push(...list.slice(index));
      break;
    }

    const item = list[index];

    try {
      await sendQueuedAction(item);
      sent += 1;
    } catch (error: any) {
      if (!canUseQueue(token)) {
        remaining.push(...list.slice(index));
        break;
      }

      if (isProbablyOfflineError(error)) {
        remaining.push(...list.slice(index));
        break;
      }

      dropped += 1;
    }
  }

  // Deletion will clear the queue after this operation settles.
  // An invalidated flush must not write its old snapshot back.
  if (canUseQueue(token)) {
    await saveQueue(remaining);
  }

  return {
    sent,
    remaining: remaining.length,
    dropped,
  };
}

export function isOfflineError(error: any): boolean {
  return isProbablyOfflineError(error);
}

export async function flushGigQueue(
  token: AccountWorkToken = captureAccountWork(),
): Promise<FlushResult> {
  if (!canUseQueue(token)) {
    return { sent: 0, remaining: 0, dropped: 0 };
  }

  if (activeFlush) return activeFlush;

  const task = runQueueOperation(
    token,
    () => flushGigQueueInternal(token),
  ).then(
    (result) =>
      result ?? { sent: 0, remaining: 0, dropped: 0 },
  );

  activeFlush = task;

  try {
    return await task;
  } finally {
    if (activeFlush === task) {
      activeFlush = null;
    }
  }
}

export async function pauseGigQueueForDeletion(): Promise<void> {
  queuePausedForDeletion = true;
  await queueTail;
}

export function resumeGigQueueAfterDeletion(): void {
  queuePausedForDeletion = false;
}