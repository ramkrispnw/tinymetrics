import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

// Set up notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("feed-reminders", {
      name: "Feeding Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleFeedingReminder(intervalHours: number, babyName: string): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  // Cancel existing feed reminders first
  await cancelFeedingReminders();

  const intervalSeconds = intervalHours * 3600;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Time to feed ${babyName || "baby"}!`,
      body: `It's been ${intervalHours} hour${intervalHours !== 1 ? "s" : ""} since the reminder was set. Time for the next feed.`,
      data: { type: "feed_reminder" },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: intervalSeconds,
      repeats: true,
    },
  });

  return id;
}

export async function scheduleOneTimeFeedReminder(intervalHours: number, babyName: string): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  const intervalSeconds = intervalHours * 3600;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Time to feed ${babyName || "baby"}!`,
      body: `${intervalHours} hour${intervalHours !== 1 ? "s" : ""} have passed since the last feed.`,
      data: { type: "feed_reminder_once" },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: intervalSeconds,
      repeats: false,
    },
  });

  return id;
}

export async function cancelFeedingReminders(): Promise<void> {
  if (Platform.OS === "web") return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const data = n.content.data as any;
    if (data?.type === "feed_reminder" || data?.type === "feed_reminder_once") {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledReminders(): Promise<Notifications.NotificationRequest[]> {
  if (Platform.OS === "web") return [];
  return Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Send a local notification when a linked partner logs an activity.
 * This is triggered during sync when new partner events are detected.
 */
export async function sendPartnerActivityNotification(
  partnerName: string,
  activityType: string,
  summary?: string
): Promise<void> {
  if (Platform.OS === "web") return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("partner-activity", {
      name: "Partner Activity",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }

  const typeLabel = activityType.charAt(0).toUpperCase() + activityType.slice(1);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${partnerName} logged a ${typeLabel}`,
      body: summary || `Your partner logged a new ${activityType} event.`,
      data: { type: "partner_activity", activityType },
      sound: "default",
    },
    trigger: null, // Immediate
  });
}
