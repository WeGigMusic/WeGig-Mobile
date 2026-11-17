import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Gig } from "../shared/types/Gig";
import {
  captureAccountWork,
  isAccountWorkCurrent,
  runAccountWork,
  type AccountWorkToken,
} from "./accountWork";

const NOTIFICATION_IDS_KEY = "wegig.notificationIds";
const NOTIFY_GIG_REMINDER_KEY = "wegig.notifyGigReminder";
const NOTIFY_RATE_REMINDER_KEY = "wegig.notifyRateReminder";

type StoredNotificationIds = Record<
  string,
  {
    dayBeforeId?: string;
    rateReminderId?: string;
  }
>;

let configured = false;
let reminderTail: Promise<void> = Promise.resolve();

export function configureNotificationBehaviour() {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();

  if (
    existing.granted ||
    existing.ios?.status ===
      Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();

  return (
    requested.granted ||
    requested.ios?.status ===
      Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function configureNotificationChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("gig-reminders", {
    name: "Gig reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

function parseLocalYmd(value?: string): Date | null {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    0,
    0,
    0,
    0,
  );
}

function atLocalTime(base: Date, hour: number, minute: number) {
  const next = new Date(base);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function getDayBeforeReminderTime(gigDate: Date) {
  const base = new Date(gigDate);
  base.setDate(base.getDate() - 1);
  return atLocalTime(base, 19, 0);
}

function getDayAfterRatingReminderTime(gigDate: Date) {
  const base = new Date(gigDate);
  base.setDate(base.getDate() + 1);
  return atLocalTime(base, 11, 0);
}

async function loadStoredNotificationIds(): Promise<StoredNotificationIds> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);

    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

async function saveStoredNotificationIds(
  value: StoredNotificationIds,
) {
  await AsyncStorage.setItem(
    NOTIFICATION_IDS_KEY,
    JSON.stringify(value),
  );
}

async function cancelNotificationId(id?: string) {
  if (!id) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

async function cancelTrackedNotifications(
  stored: StoredNotificationIds,
) {
  await Promise.all(
    Object.values(stored).flatMap((entry) =>
      [entry.dayBeforeId, entry.rateReminderId]
        .filter((id): id is string => Boolean(id))
        .map((id) => cancelNotificationId(id)),
    ),
  );
}

async function scheduleOneOffNotification(params: {
  title: string;
  body: string;
  date: Date;
  data: Record<string, string>;
}) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      sound: "default",
      data: params.data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: params.date,
      channelId:
        Platform.OS === "android" ? "gig-reminders" : undefined,
    },
  });
}

async function syncReminders(
  gigs: Gig[],
  token: AccountWorkToken,
): Promise<void> {
  if (!isAccountWorkCurrent(token)) return;

  configureNotificationBehaviour();
  await configureNotificationChannel();

  if (!isAccountWorkCurrent(token)) return;

  const [gigReminderRaw, rateReminderRaw] = await Promise.all([
    AsyncStorage.getItem(NOTIFY_GIG_REMINDER_KEY),
    AsyncStorage.getItem(NOTIFY_RATE_REMINDER_KEY),
  ]);

  if (!isAccountWorkCurrent(token)) return;

  const gigReminderEnabled =
    gigReminderRaw == null || gigReminderRaw === "1";
  const rateReminderEnabled =
    rateReminderRaw == null || rateReminderRaw === "1";

  if (!gigReminderEnabled && !rateReminderEnabled) {
    const stored = await loadStoredNotificationIds();

    if (!isAccountWorkCurrent(token)) return;

    await cancelTrackedNotifications(stored);

    if (!isAccountWorkCurrent(token)) return;

    await saveStoredNotificationIds({});
    return;
  }

  const hasPermission = await ensureNotificationPermissions();

  if (!hasPermission || !isAccountWorkCurrent(token)) return;

  const existing = await loadStoredNotificationIds();

  if (!isAccountWorkCurrent(token)) return;

  await cancelTrackedNotifications(existing);

  if (!isAccountWorkCurrent(token)) return;

  const now = new Date();
  const nextStored: StoredNotificationIds = {};

  for (const gig of gigs) {
    if (!isAccountWorkCurrent(token)) return;

    const gigDate = parseLocalYmd(gig.date);
    if (!gigDate) continue;

    const perGig: StoredNotificationIds[string] = {};

    if (gigReminderEnabled) {
      const dayBeforeAt = getDayBeforeReminderTime(gigDate);

      if (dayBeforeAt.getTime() > now.getTime()) {
        perGig.dayBeforeId = await scheduleOneOffNotification({
          title: "Gig tomorrow",
          body: `${gig.artist} at ${gig.venue}${
            gig.city ? ` • ${gig.city}` : ""
          }`,
          date: dayBeforeAt,
          data: {
            type: "gig_reminder",
            gigId: gig.id,
          },
        });
      }
    }

    if (!isAccountWorkCurrent(token)) return;

    if (rateReminderEnabled && typeof gig.rating !== "number") {
      const dayAfterAt = getDayAfterRatingReminderTime(gigDate);

      if (dayAfterAt.getTime() > now.getTime()) {
        perGig.rateReminderId = await scheduleOneOffNotification({
          title: `How was ${gig.artist} last night?`,
          body: `Rate your gig at ${gig.venue}.`,
          date: dayAfterAt,
          data: {
            type: "rate_reminder",
            gigId: gig.id,
          },
        });
      }
    }

    if (perGig.dayBeforeId || perGig.rateReminderId) {
      nextStored[gig.id] = perGig;
    }
  }

  if (!isAccountWorkCurrent(token)) return;

  await saveStoredNotificationIds(nextStored);
}

export async function syncGigReminderNotifications(
  gigs: Gig[],
  token: AccountWorkToken = captureAccountWork(),
): Promise<void> {
  await runAccountWork(token, async () => {
    // Run reminder updates in order so two screens cannot schedule
    // overlapping sets of reminders at the same time.
    const task = reminderTail.then(() => syncReminders(gigs, token));

    // Keep later updates usable even if this update fails.
    reminderTail = task.catch(() => {});

    await task;
  });
}