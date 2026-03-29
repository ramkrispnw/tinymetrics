// No-op stub for expo-notifications on web.
// All real call sites are already guarded by Platform.OS !== "web",
// so this stub just needs to satisfy the import without crashing.
export const setNotificationHandler = () => {};
export const getPermissionsAsync = async () => ({ status: "denied" });
export const requestPermissionsAsync = async () => ({ status: "denied" });
export const setNotificationChannelAsync = async () => {};
export const scheduleNotificationAsync = async () => null;
export const cancelScheduledNotificationAsync = async () => {};
export const cancelAllScheduledNotificationsAsync = async () => {};
export const getAllScheduledNotificationsAsync = async () => [];
export const AndroidImportance = { HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0 };
export const SchedulableTriggerInputTypes = { TIME_INTERVAL: "timeInterval", CALENDAR: "calendar", DATE: "date" };
