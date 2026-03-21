import {
  BabyEvent,
  FeedData,
  SleepData,
  DiaperData,
  PumpData,
  MedicationData,
  GrowthEntry,
  Milestone,
  calculateAge,
  getDayKey,
  getSleepMinutesForDay,
  formatDuration,
} from "./store";
import { calculateProjections } from "./projections";

/**
 * Projection data for today's metrics
 */
export interface TodayProjection {
  feedingProjection: {
    totalLoggedMl: number;
    feedingsCount: number;
    averagePerFeeding: number;
    timeElapsedHours: number;
    timeRemainingHours: number;
    projectedTotalMl: number;
    dailyTargetMl: number;
    percentageOfTarget: number;
    status: "ahead" | "on-track" | "behind";
  };
  sleepProjection: {
    totalLoggedMinutes: number;
    napsCount: number;
    averageNapDuration: number;
    timeElapsedHours: number;
    timeRemainingHours: number;
    projectedTotalMinutes: number;
    dailyTargetMinutes: number;
    percentageOfTarget: number;
    status: "ahead" | "on-track" | "behind";
  };
  diaperProjection: {
    wetDiapersLogged: number;
    poopyDiapersLogged: number;
    timeElapsedHours: number;
    timeRemainingHours: number;
    projectedWetDiapers: number;
    projectedPoopyDiapers: number;
    dailyTargetWet: number;
    dailyTargetPoopy: number;
    wetStatus: "ahead" | "on-track" | "behind";
    poopyStatus: "ahead" | "on-track" | "behind";
  };
}

// ── Age bracket definitions ──────────────────────────────────────────────────

interface AgeBracket {
  minWeeks: number;
  maxWeeks: number;
  stage: string;
  feedingMlPerKgDay: number; // ml/kg/day for weight-based calculation
  feedingMlFallback: number; // used when weight is unknown
  feedingMinMl: number;
  feedingMaxMl: number;
  sleepHoursBaseline: number;
  sleepPrematureBonusHours: number; // added if birth weight < 2.5kg
  wetDiapersMin: number;
  wetDiapersMax: number;
  poopyDiapersDaily: number;
}

const AGE_BRACKETS: AgeBracket[] = [
  {
    minWeeks: 0, maxWeeks: 8,
    stage: "Newborn (0-8 weeks)",
    feedingMlPerKgDay: 150, feedingMlFallback: 600,
    feedingMinMl: 450, feedingMaxMl: 750,
    sleepHoursBaseline: 16.5, sleepPrematureBonusHours: 0.5,
    wetDiapersMin: 6, wetDiapersMax: 10,
    poopyDiapersDaily: 3.5,
  },
  {
    minWeeks: 8, maxWeeks: 16,
    stage: "Young Infant (8-16 weeks)",
    feedingMlPerKgDay: 150, feedingMlFallback: 700,
    feedingMinMl: 550, feedingMaxMl: 850,
    sleepHoursBaseline: 15.5, sleepPrematureBonusHours: 0.5,
    wetDiapersMin: 6, wetDiapersMax: 10,
    poopyDiapersDaily: 1.5,
  },
  {
    minWeeks: 16, maxWeeks: 26,
    stage: "Infant (4-6 months)",
    feedingMlPerKgDay: 150, feedingMlFallback: 800,
    feedingMinMl: 650, feedingMaxMl: 950,
    sleepHoursBaseline: 14.5, sleepPrematureBonusHours: 0.5,
    wetDiapersMin: 5, wetDiapersMax: 9,
    poopyDiapersDaily: 1.5,
  },
  {
    minWeeks: 26, maxWeeks: 39,
    stage: "Older Infant (6-9 months)",
    feedingMlPerKgDay: 100, feedingMlFallback: 550,
    feedingMinMl: 400, feedingMaxMl: 700,
    sleepHoursBaseline: 13.5, sleepPrematureBonusHours: 0,
    wetDiapersMin: 5, wetDiapersMax: 8,
    poopyDiapersDaily: 1.5,
  },
  {
    minWeeks: 39, maxWeeks: 52,
    stage: "Mobile Infant (9-12 months)",
    feedingMlPerKgDay: 90, feedingMlFallback: 550,
    feedingMinMl: 350, feedingMaxMl: 650,
    sleepHoursBaseline: 12.5, sleepPrematureBonusHours: 0,
    wetDiapersMin: 5, wetDiapersMax: 8,
    poopyDiapersDaily: 1.5,
  },
  {
    minWeeks: 52, maxWeeks: 104,
    stage: "Toddler (12-24 months)",
    feedingMlPerKgDay: 80, feedingMlFallback: 500,
    feedingMinMl: 300, feedingMaxMl: 600,
    sleepHoursBaseline: 12, sleepPrematureBonusHours: 0,
    wetDiapersMin: 4, wetDiapersMax: 7,
    poopyDiapersDaily: 1,
  },
  {
    minWeeks: 104, maxWeeks: Infinity,
    stage: "Preschooler (24+ months)",
    feedingMlPerKgDay: 70, feedingMlFallback: 500,
    feedingMinMl: 250, feedingMaxMl: 550,
    sleepHoursBaseline: 11.5, sleepPrematureBonusHours: 0,
    wetDiapersMin: 4, wetDiapersMax: 7,
    poopyDiapersDaily: 1,
  },
];

/** Linearly interpolate between two values */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Get personalized daily targets for feeding, sleep, and diapers.
 *
 * @param ageWeeks        Baby's age in weeks
 * @param currentWeightKg Baby's current weight in kg (optional)
 * @param birthWeightKg   Baby's birth weight in kg (optional, used for prematurity correction)
 */
export function getAgeSpecificTargets(
  ageWeeks: number,
  currentWeightKg?: number,
  birthWeightKg?: number
) {
  // Find current and next bracket for smooth interpolation
  const bracketIdx = AGE_BRACKETS.findIndex(
    (b) => ageWeeks >= b.minWeeks && ageWeeks < b.maxWeeks
  );
  const bracket = AGE_BRACKETS[Math.max(0, bracketIdx)];
  const nextBracket = AGE_BRACKETS[bracketIdx + 1] ?? bracket;

  // Smooth transition: blend over 2-week window at bracket boundary
  const transitionWindowWeeks = 2;
  const weeksUntilBoundary = bracket.maxWeeks - ageWeeks;
  const blendT = weeksUntilBoundary < transitionWindowWeeks
    ? 1 - (weeksUntilBoundary / transitionWindowWeeks)
    : 0;

  // ── Feeding target ──
  let feedingMlDaily: number;
  if (currentWeightKg && currentWeightKg > 0) {
    const rawFeed = lerp(
      currentWeightKg * bracket.feedingMlPerKgDay,
      currentWeightKg * nextBracket.feedingMlPerKgDay,
      blendT
    );
    const minFeed = lerp(bracket.feedingMinMl, nextBracket.feedingMinMl, blendT);
    const maxFeed = lerp(bracket.feedingMaxMl, nextBracket.feedingMaxMl, blendT);
    // Low birth weight babies (< 2.5kg) get a 10% lower floor to avoid over-targeting
    const lbwAdjustedMin = birthWeightKg && birthWeightKg < 2.5 ? minFeed * 0.9 : minFeed;
    feedingMlDaily = Math.round(Math.max(lbwAdjustedMin, Math.min(maxFeed, rawFeed)));
  } else {
    feedingMlDaily = Math.round(lerp(bracket.feedingMlFallback, nextBracket.feedingMlFallback, blendT));
  }

  // ── Sleep target ──
  const sleepBaseline = lerp(bracket.sleepHoursBaseline, nextBracket.sleepHoursBaseline, blendT);
  // Prematurity correction: add bonus hours for low birth weight babies in first 6 months
  const premBonus = (birthWeightKg && birthWeightKg < 2.5 && ageWeeks < 26)
    ? lerp(bracket.sleepPrematureBonusHours, nextBracket.sleepPrematureBonusHours, blendT)
    : 0;
  const sleepHoursDaily = Math.round((sleepBaseline + premBonus) * 10) / 10;

  // ── Wet diaper target ── derived from feeding volume
  const wetMin = lerp(bracket.wetDiapersMin, nextBracket.wetDiapersMin, blendT);
  const wetMax = lerp(bracket.wetDiapersMax, nextBracket.wetDiapersMax, blendT);
  const wetFromFeeding = feedingMlDaily / 100; // ~1 wet diaper per 100ml
  const wetDiapersDaily = Math.round(Math.max(wetMin, Math.min(wetMax, wetFromFeeding)));

  // ── Poopy diaper target ──
  const poopyDiapersDaily = lerp(bracket.poopyDiapersDaily, nextBracket.poopyDiapersDaily, blendT);

  return {
    feedingMlDaily,
    sleepHoursDaily,
    wetDiapersDaily,
    poopyDiapersDaily: Math.round(poopyDiapersDaily * 10) / 10,
    stage: bracket.stage,
  };
}

/**
 * Calculate today's projections based on logged events.
 * Delegates to the smart projection engine in lib/projections.ts.
 */
export function calculateTodayProjections(
  events: BabyEvent[],
  ageWeeks: number,
  currentWeightKg?: number,
  birthWeightKg?: number
): TodayProjection {
  const proj = calculateProjections(events, ageWeeks, currentWeightKg, birthWeightKg);
  const targets = getAgeSpecificTargets(ageWeeks, currentWeightKg, birthWeightKg);

  // Count today's feed sessions for the AI context
  const now = new Date();
  const todayKey = getDayKey(now.toISOString());
  const todayEvents = events.filter((e) => getDayKey(e.timestamp) === todayKey);
  const feeds = todayEvents.filter((e) => e.type === "feed");
  const sleeps = todayEvents.filter((e) => e.type === "sleep");
  const avgFeedMl = feeds.length > 0
    ? feeds.reduce((s, e) => s + ((e.data as FeedData).amountMl || 0), 0) / feeds.length
    : 0;
  const avgSleepMin = sleeps.length > 0
    ? sleeps.reduce((s, e) => s + ((e.data as SleepData).durationMin || 0), 0) / sleeps.length
    : 0;

  return {
    feedingProjection: {
      totalLoggedMl: proj.feeding.logged,
      feedingsCount: feeds.length,
      averagePerFeeding: Math.round(avgFeedMl),
      timeElapsedHours: proj.hoursElapsed,
      timeRemainingHours: proj.hoursRemaining,
      projectedTotalMl: proj.feeding.projected,
      dailyTargetMl: targets.feedingMlDaily,
      percentageOfTarget: Math.round((proj.feeding.projected / targets.feedingMlDaily) * 100),
      status: proj.feeding.status,
    },
    sleepProjection: {
      totalLoggedMinutes: proj.sleep.logged,
      napsCount: sleeps.length,
      averageNapDuration: Math.round(avgSleepMin),
      timeElapsedHours: proj.hoursElapsed,
      timeRemainingHours: proj.hoursRemaining,
      projectedTotalMinutes: proj.sleep.projected,
      dailyTargetMinutes: targets.sleepHoursDaily * 60,
      percentageOfTarget: Math.round((proj.sleep.projected / (targets.sleepHoursDaily * 60)) * 100),
      status: proj.sleep.status,
    },
    diaperProjection: {
      wetDiapersLogged: proj.wetDiapers.logged,
      poopyDiapersLogged: proj.poopyDiapers.logged,
      timeElapsedHours: proj.hoursElapsed,
      timeRemainingHours: proj.hoursRemaining,
      projectedWetDiapers: proj.wetDiapers.projected,
      projectedPoopyDiapers: proj.poopyDiapers.projected,
      dailyTargetWet: targets.wetDiapersDaily,
      dailyTargetPoopy: targets.poopyDiapersDaily,
      wetStatus: proj.wetDiapers.status,
      poopyStatus: proj.poopyDiapers.status,
    },
  };
}

/**
 * Format today's projection into readable text for AI context
 */
export function formatTodayProjection(projection: TodayProjection): string {
  const parts: string[] = [];

  parts.push("## TODAY'S PROJECTION (as of now)");
  parts.push(
    `Time elapsed: ${projection.feedingProjection.timeElapsedHours}h | Time remaining: ${projection.feedingProjection.timeRemainingHours}h`
  );

  // Feeding
  parts.push("\n### Feeding Projection");
  parts.push(
    `Logged: ${projection.feedingProjection.totalLoggedMl}ml (${projection.feedingProjection.feedingsCount} feedings)`
  );
  parts.push(
    `Average per feeding: ${Math.round(projection.feedingProjection.averagePerFeeding)}ml`
  );
  parts.push(
    `Projected by end of day: ~${projection.feedingProjection.projectedTotalMl}ml (${projection.feedingProjection.percentageOfTarget}% of ${projection.feedingProjection.dailyTargetMl}ml target)`
  );
  parts.push(`Status: ${projection.feedingProjection.status.toUpperCase()}`);

  // Sleep
  parts.push("\n### Sleep Projection");
  parts.push(
    `Logged: ${formatDuration(projection.sleepProjection.totalLoggedMinutes)} (${projection.sleepProjection.napsCount} naps)`
  );
  parts.push(
    `Average nap: ${Math.round(projection.sleepProjection.averageNapDuration)} minutes`
  );
  parts.push(
    `Projected by end of day: ~${formatDuration(projection.sleepProjection.projectedTotalMinutes)} (${projection.sleepProjection.percentageOfTarget}% of ${formatDuration(projection.sleepProjection.dailyTargetMinutes)} target)`
  );
  parts.push(`Status: ${projection.sleepProjection.status.toUpperCase()}`);

  // Diapers
  parts.push("\n### Diaper Projection");
  parts.push(
    `Logged: ${projection.diaperProjection.wetDiapersLogged} wet, ${projection.diaperProjection.poopyDiapersLogged} poopy`
  );
  parts.push(
    `Projected by end of day: ~${projection.diaperProjection.projectedWetDiapers} wet (${Math.round((projection.diaperProjection.projectedWetDiapers / projection.diaperProjection.dailyTargetWet) * 100)}% of ${projection.diaperProjection.dailyTargetWet} target), ~${projection.diaperProjection.projectedPoopyDiapers} poopy (${Math.round((projection.diaperProjection.projectedPoopyDiapers / projection.diaperProjection.dailyTargetPoopy) * 100)}% of ${projection.diaperProjection.dailyTargetPoopy} target)`
  );
  parts.push(`Wet status: ${projection.diaperProjection.wetStatus.toUpperCase()}`);
  parts.push(`Poopy status: ${projection.diaperProjection.poopyStatus.toUpperCase()}`);

  return parts.join("\n");
}

/**
 * Build comprehensive AI context with baby data, events, and projections
 */
export function buildAIContext(
  profile: any,
  events: BabyEvent[],
  growthHistory: GrowthEntry[],
  milestones: Milestone[],
  activeSleep: any
): string {
  const parts: string[] = [];

  // ── Profile ──
  parts.push("## BABY PROFILE");
  if (profile) {
    if (profile.name) parts.push(`Name: ${profile.name}`);
    if (profile.birthDate) {
      const ageInfo = calculateAge(profile.birthDate);
      const ageWeeks = Math.floor((ageInfo.months * 30 + ageInfo.days) / 7);
      parts.push(`Age: ${ageInfo.label} (${ageWeeks} weeks)`);
    }
    if (profile.weight) parts.push(`Weight: ${profile.weight} ${profile.weightUnit || "kg"}`);
    if (profile.height) parts.push(`Height: ${profile.height} ${profile.heightUnit || "cm"}`);
    if (profile.sex) parts.push(`Sex: ${profile.sex}`);
  }

  // ── Today's Projections ──
  if (profile?.birthDate) {
    const ageInfo = calculateAge(profile.birthDate);
    const ageWeeks = Math.floor((ageInfo.months * 30 + ageInfo.days) / 7);
    const ctxWeightKg = profile.weight
      ? profile.weightUnit === "lbs" ? profile.weight * 0.453592 : profile.weight
      : undefined;
    const ctxBirthWeightKg = profile.birthWeight
      ? profile.birthWeightUnit === "lbs" ? profile.birthWeight * 0.453592 : profile.birthWeight
      : undefined;
    const projections = calculateTodayProjections(events, ageWeeks, ctxWeightKg, ctxBirthWeightKg);
    parts.push("\n" + formatTodayProjection(projections));
  }

  // ── Date range: last 14 days ──
  const dayKeys: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayKeys.push(getDayKey(d.toISOString()));
  }
  const todayKey = dayKeys[0];

  // ── Events by day ──
  const recentEvents = events.filter((e) => dayKeys.includes(getDayKey(e.timestamp)));

  // Group by day
  const byDay = new Map<string, BabyEvent[]>();
  for (const e of recentEvents) {
    const dk = getDayKey(e.timestamp);
    if (!byDay.has(dk)) byDay.set(dk, []);
    byDay.get(dk)!.push(e);
  }

  // ── Today's detailed breakdown ──
  const todayEvents = byDay.get(todayKey) || [];
  parts.push("\n## TODAY'S EVENTS (" + todayKey + ")");
  if (todayEvents.length === 0) {
    parts.push("No events logged today yet.");
  } else {
    const feeds = todayEvents.filter((e) => e.type === "feed");
    const sleeps = todayEvents.filter((e) => e.type === "sleep");
    const diapers = todayEvents.filter((e) => e.type === "diaper");
    const observations = todayEvents.filter((e) => e.type === "observation");
    const pumps = todayEvents.filter((e) => e.type === "pump");
    const meds = todayEvents.filter((e) => e.type === "medication");

    if (feeds.length > 0) {
      const totalMl = feeds.reduce((s, e) => s + ((e.data as FeedData).amountMl || 0), 0);
      const totalMin = feeds.reduce((s, e) => s + ((e.data as FeedData).durationMin || 0), 0);
      parts.push(
        `Feeding: ${feeds.length} sessions, ${totalMl}ml total, ${totalMin}min total nursing`
      );
    }

    if (sleeps.length > 0) {
      // Use overlap logic to include overnight sleep from previous day
      const allSleepForToday = events.filter((e) => e.type === "sleep");
      const totalMin = allSleepForToday.reduce((s, e) => s + getSleepMinutesForDay(e, todayKey), 0);
      parts.push(`Sleep: ${sleeps.length} sessions started today + overnight carry-over, ${formatDuration(totalMin)} total`);
    }

    if (diapers.length > 0) {
      const pee = diapers.filter((e) => (e.data as DiaperData).type === "pee").length;
      const poo = diapers.filter((e) => (e.data as DiaperData).type === "poo").length;
      const both = diapers.filter((e) => (e.data as DiaperData).type === "both").length;
      parts.push(`Diapers: ${diapers.length} changes (${pee} pee, ${poo} poo, ${both} both)`);
    }

    if (pumps.length > 0) {
      const totalMl = pumps.reduce((s, e) => s + ((e.data as PumpData).amountMl || 0), 0);
      parts.push(`Pumping: ${pumps.length} sessions, ${totalMl}ml total`);
    }

    if (meds.length > 0) {
      parts.push(`Medications: ${meds.length} doses logged`);
    }

    if (observations.length > 0) {
      parts.push(`Observations: ${observations.length}`);
    }
  }

  // ── Weekly summary ──
  parts.push("\n## LAST 7 DAYS SUMMARY");
  const last7Keys = dayKeys.slice(0, 7);
  for (const dk of last7Keys) {
    const dayEvents = byDay.get(dk) || [];
    if (dayEvents.length === 0) {
      parts.push(`${dk}: No events`);
      continue;
    }
    const feeds = dayEvents.filter((e) => e.type === "feed");
    const sleeps = dayEvents.filter((e) => e.type === "sleep");
    const diapers = dayEvents.filter((e) => e.type === "diaper");
    const feedMl = feeds.reduce((s, e) => s + ((e.data as FeedData).amountMl || 0), 0);
    // Use overlap logic to capture overnight sleep carrying into this day
    const allSleepForDay = events.filter((e) => e.type === "sleep");
    const sleepMin = allSleepForDay.reduce((s, e) => s + getSleepMinutesForDay(e, dk), 0);
    parts.push(
      `${dk}: ${feeds.length} feeds (${feedMl}ml), ${sleeps.length} sleep sessions (${formatDuration(sleepMin)} incl. overnight), ${diapers.length} diapers`
    );
  }

  // ── Growth history ──
  if (growthHistory.length > 0) {
    parts.push("\n## GROWTH HISTORY");
    const recent = growthHistory.slice(0, 10);
    recent.forEach((g: GrowthEntry) => {
      const items: string[] = [];
      if (g.weight != null) items.push(`${g.weight} ${g.weightUnit || "kg"}`);
      if (g.height != null) items.push(`${g.height} ${g.heightUnit || "cm"}`);
      parts.push(`${g.date}: ${items.join(", ")}`);
    });
  }

  // ── Milestones ──
  if (milestones.length > 0) {
    parts.push("\n## MILESTONES ACHIEVED");
    milestones.slice(0, 15).forEach((m: Milestone) => {
      parts.push(`${m.date}: ${m.title} (${m.category})`);
    });
  }

  // ── Active sleep ──
  if (activeSleep) {
    const start = new Date(activeSleep.startTime);
    const elapsedMin = Math.round((Date.now() - start.getTime()) / 60000);
    parts.push(
      `\n## ACTIVE SLEEP: Baby has been sleeping for ${formatDuration(elapsedMin)} (started at ${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})`
    );
  }

  // Truncate to stay within limits
  const full = parts.join("\n");
  return full.length > 14000 ? full.slice(0, 14000) + "\n...(truncated)" : full;
}
