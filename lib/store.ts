import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type EventType = "feed" | "sleep" | "diaper" | "observation" | "growth" | "pump";

export type PumpSide = "left" | "right" | "both";

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

export interface PumpData {
  amountMl?: number;
  side: PumpSide;
  durationMin?: number;
  notes?: string;
}

export interface GrowthData {
  weight?: number;
  weightUnit?: WeightUnit;
  height?: number;
  heightUnit?: HeightUnit;
  notes?: string;
}

export interface BabyEvent {
  id: string;
  type: EventType;
  timestamp: string; // ISO
  data: FeedData | SleepData | DiaperData | ObservationData | GrowthData | PumpData;
  imageUrl?: string;
  createdAt: string; // ISO
}

export type WeightUnit = "kg" | "lbs";
export type HeightUnit = "cm" | "in";

export interface BabyProfile {
  name: string;
  birthDate: string; // ISO date
  sex?: "boy" | "girl";
  photoUri?: string;
  weight?: number; // stored in the user's chosen unit
  weightUnit?: WeightUnit;
  height?: number; // stored in the user's chosen unit
  heightUnit?: HeightUnit;
}

export interface AppSettings {
  units: "ml" | "oz";
  isPremium: boolean;
  theme: "auto" | "light" | "dark";
}

export interface Milestone {
  id: string;
  title: string;
  date: string; // ISO date YYYY-MM-DD
  category: MilestoneCategory;
  notes?: string;
  photoUri?: string;
  createdAt: string;
}

export type MilestoneCategory = "motor" | "social" | "language" | "cognitive" | "feeding" | "other";

export const MILESTONE_CATEGORIES: { key: MilestoneCategory; label: string; icon: string }[] = [
  { key: "motor", label: "Motor", icon: "🏃" },
  { key: "social", label: "Social", icon: "😊" },
  { key: "language", label: "Language", icon: "🗣" },
  { key: "cognitive", label: "Cognitive", icon: "🧠" },
  { key: "feeding", label: "Feeding", icon: "🍼" },
  { key: "other", label: "Other", icon: "⭐" },
];

export interface GrowthEntry {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  weight?: number;
  weightUnit?: WeightUnit;
  height?: number;
  heightUnit?: HeightUnit;
  createdAt: string;
}

export interface AppState {
  profile: BabyProfile | null;
  events: BabyEvent[];
  settings: AppSettings;
  activeSleep: { startTime: string } | null;
  growthHistory: GrowthEntry[];
  milestones: Milestone[];
  lastSyncedAt: string | null;
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
  growthHistory: [],
  milestones: [],
  lastSyncedAt: null,
};

// ─── Storage Keys ────────────────────────────────────────────────────────────

const KEYS = {
  PROFILE: "@baby_tracker_profile",
  EVENTS: "@baby_tracker_events",
  SETTINGS: "@baby_tracker_settings",
  ACTIVE_SLEEP: "@baby_tracker_active_sleep",
  GROWTH_HISTORY: "@baby_tracker_growth_history",
  MILESTONES: "@baby_tracker_milestones",
  LAST_SYNCED: "@baby_tracker_last_synced",
};

// ─── Persistence Helpers ─────────────────────────────────────────────────────

export async function loadState(): Promise<AppState> {
  try {
    const [profileStr, eventsStr, settingsStr, activeSleepStr, growthStr, milestonesStr, lastSyncedStr] = await AsyncStorage.multiGet([
      KEYS.PROFILE,
      KEYS.EVENTS,
      KEYS.SETTINGS,
      KEYS.ACTIVE_SLEEP,
      KEYS.GROWTH_HISTORY,
      KEYS.MILESTONES,
      KEYS.LAST_SYNCED,
    ]);
    return {
      profile: profileStr[1] ? JSON.parse(profileStr[1]) : null,
      events: eventsStr[1] ? JSON.parse(eventsStr[1]) : [],
      settings: settingsStr[1] ? JSON.parse(settingsStr[1]) : DEFAULT_SETTINGS,
      activeSleep: activeSleepStr[1] ? JSON.parse(activeSleepStr[1]) : null,
      growthHistory: growthStr[1] ? JSON.parse(growthStr[1]) : [],
      milestones: milestonesStr[1] ? JSON.parse(milestonesStr[1]) : [],
      lastSyncedAt: lastSyncedStr[1] || null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function saveProfile(profile: BabyProfile | null) {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
}

export async function saveLastSynced(timestamp: string | null) {
  if (timestamp) {
    await AsyncStorage.setItem(KEYS.LAST_SYNCED, timestamp);
  } else {
    await AsyncStorage.removeItem(KEYS.LAST_SYNCED);
  }
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

export async function saveGrowthHistory(entries: GrowthEntry[]) {
  await AsyncStorage.setItem(KEYS.GROWTH_HISTORY, JSON.stringify(entries));
}

export async function saveMilestones(milestones: Milestone[]) {
  await AsyncStorage.setItem(KEYS.MILESTONES, JSON.stringify(milestones));
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

// ─── Unit Conversions ───────────────────────────────────────────────────────

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 100) / 100;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs / 2.20462 * 100) / 100;
}

export function cmToIn(cm: number): number {
  return Math.round(cm / 2.54 * 100) / 100;
}

export function inToCm(inches: number): number {
  return Math.round(inches * 2.54 * 100) / 100;
}

/** Convert weight to target unit */
export function convertWeight(value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number {
  if (fromUnit === toUnit) return value;
  return fromUnit === "kg" ? kgToLbs(value) : lbsToKg(value);
}

/** Convert height to target unit */
export function convertHeight(value: number, fromUnit: HeightUnit, toUnit: HeightUnit): number {
  if (fromUnit === toUnit) return value;
  return fromUnit === "cm" ? cmToIn(value) : inToCm(value);
}

/** Convert feed amount to target unit */
export function convertFeedAmount(value: number, fromUnit: "ml" | "oz", toUnit: "ml" | "oz"): number {
  if (fromUnit === toUnit) return value;
  return fromUnit === "ml" ? mlToOz(value) : ozToMl(value);
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

export function calculateAge(birthDateISO: string): { months: number; days: number; label: string } {
  const birth = new Date(birthDateISO);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  let days = now.getDate() - birth.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  const totalDays = months * 30 + days;
  if (months < 1) {
    return { months: 0, days: totalDays, label: `${totalDays} day${totalDays !== 1 ? "s" : ""} old` };
  }
  if (months < 24) {
    const label = days > 0 ? `${months}mo ${days}d old` : `${months}mo old`;
    return { months, days, label };
  }
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const label = remMonths > 0 ? `${years}y ${remMonths}mo old` : `${years}y old`;
  return { months, days, label };
}

export function getProfileSummary(profile: BabyProfile | null): string {
  if (!profile) return "No baby profile set up.";
  const age = calculateAge(profile.birthDate);
  let summary = `Baby name: ${profile.name}, Age: ${age.label}`;
  if (profile.weight != null) {
    summary += `, Weight: ${profile.weight} ${profile.weightUnit || "kg"}`;
  }
  if (profile.height != null) {
    summary += `, Height: ${profile.height} ${profile.heightUnit || "cm"}`;
  }
  return summary;
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

/**
 * Returns a YYYY-MM-DD string in the user's **local** timezone.
 * This is critical for grouping events by day — using UTC would shift
 * events to the wrong day for users west of GMT.
 */
export function getDayKey(isoString: string): string {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns a YYYY-MM-DD string for today in the user's local timezone.
 */
export function getTodayKey(): string {
  return getDayKey(new Date().toISOString());
}

// ─── Context ─────────────────────────────────────────────────────────────────

export interface StoreContextValue {
  state: AppState;
  addEvent: (event: Omit<BabyEvent, "id" | "createdAt">) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  updateEvent: (id: string, updates: Partial<Omit<BabyEvent, "id" | "createdAt">>) => Promise<void>;
  updateProfile: (profile: BabyProfile) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  startSleep: () => Promise<void>;
  stopSleep: () => Promise<BabyEvent | null>;
  addGrowthEntry: (entry: Omit<GrowthEntry, "id" | "createdAt">) => Promise<void>;
  deleteGrowthEntry: (id: string) => Promise<void>;
  addMilestone: (milestone: Omit<Milestone, "id" | "createdAt">) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;
  importEvents: (events: Omit<BabyEvent, "id" | "createdAt">[]) => Promise<number>;
  syncToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<void>;
  reload: () => Promise<void>;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
