import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { Gig } from "../shared/types/Gig";
import { Platform } from "react-native";

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

  if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();

  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
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
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

function atLocalTime(base: Date, hour: number, minute: number) {
  const next = new Date(base);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function getDayBeforeReminderTime(gigDate: Date) {
  const base = new Date(gigDate);
  base.setDate(base.getDate() - 1);
  return atLocalTime(base, 19, 0); // 7pm local
}

function getDayAfterRatingReminderTime(gigDate: Date) {
  const base = new Date(gigDate);
  base.setDate(base.getDate() + 1);
  return atLocalTime(base, 11, 0); // 11am local
}

async function loadStoredNotificationIds(): Promise<StoredNotificationIds> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredNotificationIds;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveStoredNotificationIds(value: StoredNotificationIds) {
  await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(value));
}

async function cancelNotificationId(id?: string) {
  if (!id) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

async function cancelAllTrackedNotifications() {
  const stored = await loadStoredNotificationIds();

  await Promise.all(
    Object.values(stored).flatMap((entry) =>
      [entry.dayBeforeId, entry.rateReminderId].filter(Boolean).map((id) =>
        cancelNotificationId(id),
      ),
    ),
  );

  await saveStoredNotificationIds({});
}

async function scheduleOneOffNotification(params: {
  title: string;
  body: string;
  date: Date;
  data: Record<string, string>;
}) {
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      sound: "default",
      data: params.data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: params.date,
      channelId: Platform.OS === "android" ? "gig-reminders" : undefined,
    },
  });

  return identifier;
}

export async function syncGigReminderNotifications(gigs: Gig[]) {
  configureNotificationBehaviour();
  await configureNotificationChannel();

  const [gigReminderRaw, rateReminderRaw] = await Promise.all([
    AsyncStorage.getItem(NOTIFY_GIG_REMINDER_KEY),
    AsyncStorage.getItem(NOTIFY_RATE_REMINDER_KEY),
  ]);

  const gigReminderEnabled = gigReminderRaw == null ? true : gigReminderRaw === "1";
  const rateReminderEnabled = rateReminderRaw == null ? true : rateReminderRaw === "1";

  if (!gigReminderEnabled && !rateReminderEnabled) {
    await cancelAllTrackedNotifications();
    return;
  }

  const hasPermission = await ensureNotificationPermissions();
  if (!hasPermission) {
    return;
  }

  const existing = await loadStoredNotificationIds();

  await Promise.all(
    Object.values(existing).flatMap((entry) =>
      [entry.dayBeforeId, entry.rateReminderId].filter(Boolean).map((id) =>
        cancelNotificationId(id),
      ),
    ),
  );

  const now = new Date();
  const nextStored: StoredNotificationIds = {};

  for (const gig of gigs) {
    const gigDate = parseLocalYmd(gig.date);
    if (!gigDate) continue;

    const perGig: StoredNotificationIds[string] = {};

    if (gigReminderEnabled) {
      const dayBeforeAt = getDayBeforeReminderTime(gigDate);

      if (dayBeforeAt.getTime() > now.getTime()) {
        perGig.dayBeforeId = await scheduleOneOffNotification({
          title: "Gig tomorrow",
          body: `${gig.artist} at ${gig.venue}${gig.city ? ` • ${gig.city}` : ""}`,
          date: dayBeforeAt,
          data: {
            type: "gig_reminder",
            gigId: gig.id,
          },
        });
      }
    }

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

  await saveStoredNotificationIds(nextStored);
}