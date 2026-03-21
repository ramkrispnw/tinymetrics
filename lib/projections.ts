/**
 * projections.ts
 *
 * End-of-day projection engine.
 *
 * Algorithm for each metric:
 *   projection = (historyWeight × historicalBaseline) + (todayWeight × todayPace)
 *
 *   where:
 *     elapsedFraction = hoursElapsed / 24
 *     todayWeight     = elapsedFraction²          (near-zero early, dominant late)
 *     historyWeight   = 1 - todayWeight
 *
 * Historical baseline:
 *   Weighted 7-day rolling average (D-1=30%, D-2=25%, D-3=20%, D-4=15%, D-5..D-7=~3.3% each)
 *   with a trend multiplier = (3-day avg) / (7-day avg), capped at ±20%.
 *
 * Today's pace:
 *   actual / historicalFractionByNow
 *   where historicalFractionByNow = average fraction of daily total that was logged
 *   by this same hour across the last 7 days (time-of-day adjusted).
 *
 * Sleep:
 *   Uses getSleepMinutesForDay() which clips sessions to exact day boundaries.
 *
 * Zero-event days:
 *   If no events logged yet today, projection = historicalBaseline (labeled "based on history").
 */

import {
  BabyEvent,
  FeedData,
  DiaperData,
  getDayKey,
  getSleepMinutesForDay,
} from "./store";
import { getAgeSpecificTargets } from "./ai-context-builder";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetricProjection {
  /** Actual logged value so far today */
  logged: number;
  /** Projected end-of-day total */
  projected: number;
  /** Age-appropriate daily target */
  target: number;
  /** Whether projection is based on history only (no events today) */
  basedOnHistory: boolean;
  status: "ahead" | "on-track" | "behind";
}

export interface DailyProjections {
  feeding: MetricProjection;
  sleep: MetricProjection;
  wetDiapers: MetricProjection;
  poopyDiapers: MetricProjection;
  /** Hours elapsed since midnight */
  hoursElapsed: number;
  /** Hours remaining until midnight */
  hoursRemaining: number;
}

// ─── Day-key helpers ──────────────────────────────────────────────────────────

function getDayKeyForOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return getDayKey(d.toISOString());
}

// ─── Historical baseline ──────────────────────────────────────────────────────

/**
 * Day weights: D-1=30%, D-2=25%, D-3=20%, D-4=15%, D-5..D-7 split remaining 10%
 */
const DAY_WEIGHTS = [0.30, 0.25, 0.20, 0.15, 0.0333, 0.0333, 0.0334];

/**
 * Compute weighted 7-day historical baseline for a metric, with trend multiplier.
 * Returns 0 if no history available.
 */
function historicalBaseline(dailyValues: number[]): number {
  // dailyValues[0] = D-1 (yesterday), [1] = D-2, ..., [6] = D-7
  const weighted = dailyValues.reduce((sum, v, i) => sum + v * (DAY_WEIGHTS[i] ?? 0), 0);
  if (weighted === 0) return 0;

  // Trend multiplier: 3-day avg vs 7-day avg
  const avg3 = (dailyValues[0] + dailyValues[1] + dailyValues[2]) / 3;
  const avg7 = dailyValues.reduce((s, v) => s + v, 0) / 7;
  const trendMultiplier = avg7 > 0 ? Math.min(Math.max(avg3 / avg7, 0.8), 1.2) : 1;

  return weighted * trendMultiplier;
}

// ─── Time-of-day fraction ─────────────────────────────────────────────────────

/**
 * For each of the last N days, compute what fraction of that day's total
 * for a given metric was logged by `hoursElapsed` hours into the day.
 * Returns the average fraction across days that had any data.
 */
function historicalFractionByHour(
  dailyTotals: number[],
  dailyByHour: number[][],
  hoursElapsed: number
): number {
  const fractions: number[] = [];
  for (let i = 0; i < dailyTotals.length; i++) {
    const total = dailyTotals[i];
    if (total <= 0) continue;
    const byHour = dailyByHour[i];
    // Sum events up to hoursElapsed on that day
    const upToNow = byHour
      .filter((_, h) => h < Math.floor(hoursElapsed))
      .reduce((s, v) => s + v, 0);
    fractions.push(upToNow / total);
  }
  if (fractions.length === 0) return hoursElapsed / 24; // fallback: linear
  return fractions.reduce((s, v) => s + v, 0) / fractions.length;
}

// ─── Per-metric data extractors ───────────────────────────────────────────────

/** Returns total feed ml for a given day key */
function feedMlForDay(events: BabyEvent[], dayKey: string): number {
  return events
    .filter((e) => e.type === "feed" && getDayKey(e.timestamp) === dayKey)
    .reduce((sum, e) => sum + ((e.data as FeedData).amountMl || 0), 0);
}

/** Returns hourly feed ml array (24 buckets) for a given day key */
function feedMlByHour(events: BabyEvent[], dayKey: string): number[] {
  const buckets = Array(24).fill(0);
  events
    .filter((e) => e.type === "feed" && getDayKey(e.timestamp) === dayKey)
    .forEach((e) => {
      const h = new Date(e.timestamp).getHours();
      buckets[h] += (e.data as FeedData).amountMl || 0;
    });
  return buckets;
}

/** Returns total sleep minutes for a given day key (clips to day boundaries) */
function sleepMinForDay(events: BabyEvent[], dayKey: string): number {
  return events
    .filter((e) => e.type === "sleep")
    .reduce((sum, e) => sum + getSleepMinutesForDay(e, dayKey), 0);
}

/** Returns hourly sleep minutes array (24 buckets) for a given day key */
function sleepMinByHour(events: BabyEvent[], dayKey: string): number[] {
  const buckets = Array(24).fill(0);
  const [year, month, day] = dayKey.split("-").map(Number);
  const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);

  events
    .filter((e) => e.type === "sleep")
    .forEach((e) => {
      const mins = getSleepMinutesForDay(e, dayKey);
      if (mins <= 0) return;
      // Distribute minutes into hourly buckets
      const data = e.data as any;
      const start = data.startTime ? new Date(data.startTime) : new Date(e.timestamp);
      const end = data.endTime
        ? new Date(data.endTime)
        : new Date(start.getTime() + (data.durationMin || 0) * 60000);

      for (let h = 0; h < 24; h++) {
        const hStart = new Date(dayStart.getTime() + h * 3600000);
        const hEnd = new Date(hStart.getTime() + 3600000);
        const overlapStart = Math.max(start.getTime(), hStart.getTime());
        const overlapEnd = Math.min(end.getTime(), hEnd.getTime());
        if (overlapEnd > overlapStart) {
          buckets[h] += (overlapEnd - overlapStart) / 60000;
        }
      }
    });
  return buckets;
}

/** Returns wet diaper count for a given day key */
function wetDiapersForDay(events: BabyEvent[], dayKey: string): number {
  return events.filter((e) => {
    if (e.type !== "diaper") return false;
    if (getDayKey(e.timestamp) !== dayKey) return false;
    const t = (e.data as DiaperData).type;
    return t === "pee" || t === "both";
  }).length;
}

/** Returns hourly wet diaper count array (24 buckets) for a given day key */
function wetDiapersByHour(events: BabyEvent[], dayKey: string): number[] {
  const buckets = Array(24).fill(0);
  events
    .filter((e) => {
      if (e.type !== "diaper") return false;
      if (getDayKey(e.timestamp) !== dayKey) return false;
      const t = (e.data as DiaperData).type;
      return t === "pee" || t === "both";
    })
    .forEach((e) => {
      buckets[new Date(e.timestamp).getHours()]++;
    });
  return buckets;
}

/** Returns poopy diaper count for a given day key */
function poopyDiapersForDay(events: BabyEvent[], dayKey: string): number {
  return events.filter((e) => {
    if (e.type !== "diaper") return false;
    if (getDayKey(e.timestamp) !== dayKey) return false;
    const t = (e.data as DiaperData).type;
    return t === "poo" || t === "both";
  }).length;
}

/** Returns hourly poopy diaper count array (24 buckets) for a given day key */
function poopyDiapersByHour(events: BabyEvent[], dayKey: string): number[] {
  const buckets = Array(24).fill(0);
  events
    .filter((e) => {
      if (e.type !== "diaper") return false;
      if (getDayKey(e.timestamp) !== dayKey) return false;
      const t = (e.data as DiaperData).type;
      return t === "poo" || t === "both";
    })
    .forEach((e) => {
      buckets[new Date(e.timestamp).getHours()]++;
    });
  return buckets;
}

// ─── Core blended projection ──────────────────────────────────────────────────

/**
 * Compute a single blended projection for one metric.
 *
 * @param loggedToday   Actual value logged so far today
 * @param histBaseline  Weighted historical daily baseline
 * @param todayPace     Extrapolated full-day value based on today's pace
 * @param hoursElapsed  Hours since midnight
 * @param hasEventsToday Whether any events were logged today for this metric
 * @param floor         Minimum projection value (never go below this)
 */
function blendedProjection(
  loggedToday: number,
  histBaseline: number,
  todayPace: number,
  hoursElapsed: number,
  hasEventsToday: boolean,
  floor = 0
): { projected: number; basedOnHistory: boolean } {
  // If no events today at all, return history baseline
  if (!hasEventsToday || hoursElapsed < 0.5) {
    return { projected: Math.max(histBaseline, floor), basedOnHistory: true };
  }

  const elapsedFraction = Math.min(hoursElapsed / 24, 1);
  const todayWeight = elapsedFraction * elapsedFraction; // quadratic
  const historyWeight = 1 - todayWeight;

  const blended = historyWeight * histBaseline + todayWeight * todayPace;
  // Projected can never be less than what's already logged
  const projected = Math.max(blended, loggedToday, floor);
  return { projected, basedOnHistory: false };
}

// ─── Status helper ────────────────────────────────────────────────────────────

function deriveStatus(projected: number, target: number): "ahead" | "on-track" | "behind" {
  const pct = target > 0 ? (projected / target) * 100 : 100;
  if (pct > 110) return "ahead";
  if (pct < 85) return "behind";
  return "on-track";
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Calculate smart end-of-day projections for feeding, sleep, and diapers.
 *
 * @param events   Full event array from the store
 * @param ageWeeks Baby's age in weeks (for targets)
 */
export function calculateProjections(
  events: BabyEvent[],
  ageWeeks: number,
  currentWeightKg?: number,
  birthWeightKg?: number
): DailyProjections {
  const now = new Date();
  const todayKey = getDayKey(now.toISOString());

  // Time elapsed/remaining
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const hoursElapsed = (now.getTime() - dayStart.getTime()) / 3600000;
  const hoursRemaining = 24 - hoursElapsed;

  const targets = getAgeSpecificTargets(ageWeeks, currentWeightKg, birthWeightKg);

  // Build 7-day history arrays (index 0 = yesterday = D-1)
  const histDayKeys = Array.from({ length: 7 }, (_, i) => getDayKeyForOffset(i + 1));

  // ── Feeding ──
  const histFeedTotals = histDayKeys.map((dk) => feedMlForDay(events, dk));
  const histFeedByHour = histDayKeys.map((dk) => feedMlByHour(events, dk));
  const feedBaseline = historicalBaseline(histFeedTotals);
  const feedLoggedToday = feedMlForDay(events, todayKey);
  const feedHasEvents = feedLoggedToday > 0;
  const feedFractionByNow = historicalFractionByHour(histFeedTotals, histFeedByHour, hoursElapsed);
  const feedTodayPace = feedFractionByNow > 0.02
    ? feedLoggedToday / feedFractionByNow
    : feedBaseline;
  const feedResult = blendedProjection(
    feedLoggedToday,
    feedBaseline > 0 ? feedBaseline : targets.feedingMlDaily,
    feedTodayPace,
    hoursElapsed,
    feedHasEvents,
    targets.feedingMlDaily * 0.4 // floor: 40% of target
  );

  // ── Sleep ──
  const histSleepTotals = histDayKeys.map((dk) => sleepMinForDay(events, dk));
  const histSleepByHour = histDayKeys.map((dk) => sleepMinByHour(events, dk));
  const sleepBaseline = historicalBaseline(histSleepTotals);
  const sleepLoggedToday = sleepMinForDay(events, todayKey);
  const sleepHasEvents = sleepLoggedToday > 0;
  const sleepFractionByNow = historicalFractionByHour(histSleepTotals, histSleepByHour, hoursElapsed);
  const sleepTodayPace = sleepFractionByNow > 0.02
    ? sleepLoggedToday / sleepFractionByNow
    : sleepBaseline;
  const sleepTarget = targets.sleepHoursDaily * 60;
  const sleepResult = blendedProjection(
    sleepLoggedToday,
    sleepBaseline > 0 ? sleepBaseline : sleepTarget,
    sleepTodayPace,
    hoursElapsed,
    sleepHasEvents,
    sleepTarget * 0.4
  );

  // ── Wet Diapers ──
  const histWetTotals = histDayKeys.map((dk) => wetDiapersForDay(events, dk));
  const histWetByHour = histDayKeys.map((dk) => wetDiapersByHour(events, dk));
  const wetBaseline = historicalBaseline(histWetTotals);
  const wetLoggedToday = wetDiapersForDay(events, todayKey);
  const wetHasEvents = wetLoggedToday > 0;
  const wetFractionByNow = historicalFractionByHour(histWetTotals, histWetByHour, hoursElapsed);
  const wetTodayPace = wetFractionByNow > 0.02
    ? wetLoggedToday / wetFractionByNow
    : wetBaseline;
  const wetResult = blendedProjection(
    wetLoggedToday,
    wetBaseline > 0 ? wetBaseline : targets.wetDiapersDaily,
    wetTodayPace,
    hoursElapsed,
    wetHasEvents,
    ageWeeks < 26 ? 3 : 2 // minimum floor for young babies
  );

  // ── Poopy Diapers ──
  const histPoopyTotals = histDayKeys.map((dk) => poopyDiapersForDay(events, dk));
  const histPoopyByHour = histDayKeys.map((dk) => poopyDiapersByHour(events, dk));
  const poopyBaseline = historicalBaseline(histPoopyTotals);
  const poopyLoggedToday = poopyDiapersForDay(events, todayKey);
  const poopyHasEvents = poopyLoggedToday > 0;
  const poopyFractionByNow = historicalFractionByHour(histPoopyTotals, histPoopyByHour, hoursElapsed);
  const poopyTodayPace = poopyFractionByNow > 0.02
    ? poopyLoggedToday / poopyFractionByNow
    : poopyBaseline;
  const poopyResult = blendedProjection(
    poopyLoggedToday,
    poopyBaseline > 0 ? poopyBaseline : targets.poopyDiapersDaily,
    poopyTodayPace,
    hoursElapsed,
    poopyHasEvents,
    0
  );

  return {
    feeding: {
      logged: feedLoggedToday,
      projected: Math.round(feedResult.projected),
      target: targets.feedingMlDaily,
      basedOnHistory: feedResult.basedOnHistory,
      status: deriveStatus(feedResult.projected, targets.feedingMlDaily),
    },
    sleep: {
      logged: sleepLoggedToday,
      projected: Math.round(sleepResult.projected),
      target: sleepTarget,
      basedOnHistory: sleepResult.basedOnHistory,
      status: deriveStatus(sleepResult.projected, sleepTarget),
    },
    wetDiapers: {
      logged: wetLoggedToday,
      projected: Math.round(wetResult.projected),
      target: targets.wetDiapersDaily,
      basedOnHistory: wetResult.basedOnHistory,
      status: deriveStatus(wetResult.projected, targets.wetDiapersDaily),
    },
    poopyDiapers: {
      logged: poopyLoggedToday,
      projected: Math.round(poopyResult.projected),
      target: targets.poopyDiapersDaily,
      basedOnHistory: poopyResult.basedOnHistory,
      status: deriveStatus(poopyResult.projected, targets.poopyDiapersDaily),
    },
    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
    hoursRemaining: Math.round(hoursRemaining * 10) / 10,
  };
}

/**
 * Get the 7-day historical daily feeding totals (index 0 = 6 days ago, index 6 = today projected).
 * Used by the sparkline chart.
 */
export function get7DayFeedingHistory(
  events: BabyEvent[],
  todayProjected: number
): number[] {
  const result: number[] = [];
  for (let daysAgo = 6; daysAgo >= 1; daysAgo--) {
    result.push(feedMlForDay(events, getDayKeyForOffset(daysAgo)));
  }
  result.push(todayProjected);
  return result;
}
