import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type EventType = "feed" | "sleep" | "diaper" | "observation";

export type FeedMethod = "bottle" | "breast_left" | "breast_right" | "solid";
export type DiaperType = "pee" | "poo" | "both";
export type PooColor = "yellow" | "green" | "brown" | "black" | "red";
export type PooConsistency = "liquid" | "soft" | "firm" | "hard";
export type ObservationCategory = "rash" | "fast_breathing" | "fever" | "vomiting" | "cough" | "other";
export type Severity = "mild" | "moderate" | "severe";

export interface FeedData {
  method: FeedMethod;
  amountMl?: number;
  durationMin?: number;
  notes?: string;
}

export interface SleepData {
  startTime: string; // ISO
  endTime?: string; // ISO
  durationMin?: number;
  notes?: string;
}

export interface DiaperData {
  type: DiaperType;
  pooColor?: PooColor;
  pooConsistency?: PooConsistency;
  notes?: string;
}

export interface ObservationData {
  category: ObservationCategory;
  severity: Severity;
  description?: string;
  notes?: string;
}

export interface BabyEvent {
  id: string;
  type: EventType;
  timestamp: string; // ISO
  data: FeedData | SleepData | DiaperData | ObservationData;
  imageUrl?: string;
  createdAt: string; // ISO
}

export interface BabyProfile {
  name: string;
  birthDate: string; // ISO date
  photoUri?: string;
}

export interface AppSettings {
  units: "ml" | "oz";
  isPremium: boolean;
  theme: "auto" | "light" | "dark";
}

export interface AppState {
  profile: BabyProfile | null;
  events: BabyEvent[];
  settings: AppSettings;
  activeSleep: { startTime: string } | null;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  units: "ml",
  isPremium: false,
  theme: "auto",
};

export const DEFAULT_STATE: AppState = {
  profile: null,
  events: [],
  settings: DEFAULT_SETTINGS,
  activeSleep: null,
};

// ─── Storage Keys ────────────────────────────────────────────────────────────

const KEYS = {
  PROFILE: "@baby_tracker_profile",
  EVENTS: "@baby_tracker_events",
  SETTINGS: "@baby_tracker_settings",
  ACTIVE_SLEEP: "@baby_tracker_active_sleep",
};

// ─── Persistence Helpers ─────────────────────────────────────────────────────

export async function loadState(): Promise<AppState> {
  try {
    const [profileStr, eventsStr, settingsStr, activeSleepStr] = await AsyncStorage.multiGet([
      KEYS.PROFILE,
      KEYS.EVENTS,
      KEYS.SETTINGS,
      KEYS.ACTIVE_SLEEP,
    ]);
    return {
      profile: profileStr[1] ? JSON.parse(profileStr[1]) : null,
      events: eventsStr[1] ? JSON.parse(eventsStr[1]) : [],
      settings: settingsStr[1] ? JSON.parse(settingsStr[1]) : DEFAULT_SETTINGS,
      activeSleep: activeSleepStr[1] ? JSON.parse(activeSleepStr[1]) : null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function saveProfile(profile: BabyProfile | null) {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
}

export async function saveEvents(events: BabyEvent[]) {
  await AsyncStorage.setItem(KEYS.EVENTS, JSON.stringify(events));
}

export async function saveSettings(settings: AppSettings) {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function saveActiveSleep(activeSleep: { startTime: string } | null) {
  if (activeSleep) {
    await AsyncStorage.setItem(KEYS.ACTIVE_SLEEP, JSON.stringify(activeSleep));
  } else {
    await AsyncStorage.removeItem(KEYS.ACTIVE_SLEEP);
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function mlToOz(ml: number): number {
  return Math.round(ml * 0.033814 * 10) / 10;
}

export function ozToMl(oz: number): number {
  return Math.round(oz / 0.033814);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function isToday(isoString: string): boolean {
  const d = new Date(isoString);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function getDayKey(isoString: string): string {
  return new Date(isoString).toISOString().split("T")[0];
}

// ─── Context ─────────────────────────────────────────────────────────────────

export interface StoreContextValue {
  state: AppState;
  addEvent: (event: Omit<BabyEvent, "id" | "createdAt">) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  updateProfile: (profile: BabyProfile) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  startSleep: () => Promise<void>;
  stopSleep: () => Promise<BabyEvent | null>;
  reload: () => Promise<void>;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
