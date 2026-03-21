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

/**
 * Get age-specific targets for feeding, sleep, and diapers
 */
export function getAgeSpecificTargets(ageWeeks: number) {
  if (ageWeeks < 8) {
    return {
      feedingMlDaily: 600,
      sleepHoursDaily: 16.5,
      wetDiapersDaily: 7,
      poopyDiapersDaily: 3.5,
      stage: "Newborn (0-8 weeks)",
    };
  } else if (ageWeeks < 16) {
    return {
      feedingMlDaily: 700,
      sleepHoursDaily: 15.5,
      wetDiapersDaily: 7,
      poopyDiapersDaily: 1.5,
      stage: "Young Infant (8-16 weeks)",
    };
  } else if (ageWeeks < 26) {
    return {
      feedingMlDaily: 800,
      sleepHoursDaily: 14.5,
      wetDiapersDaily: 7,
      poopyDiapersDaily: 1.5,
      stage: "Infant (4-6 months)",
    };
  } else if (ageWeeks < 39) {
    return {
      feedingMlDaily: 550,
      sleepHoursDaily: 13.5,
      wetDiapersDaily: 7,
      poopyDiapersDaily: 1.5,
      stage: "Older Infant (6-9 months)",
    };
  } else if (ageWeeks < 52) {
    return {
      feedingMlDaily: 550,
      sleepHoursDaily: 12.5,
      wetDiapersDaily: 7,
      poopyDiapersDaily: 1.5,
      stage: "Mobile Infant (9-12 months)",
    };
  } else if (ageWeeks < 104) {
    return {
      feedingMlDaily: 500,
      sleepHoursDaily: 12,
      wetDiapersDaily: 6,
      poopyDiapersDaily: 1,
      stage: "Toddler (12-24 months)",
    };
  } else {
    return {
      feedingMlDaily: 500,
      sleepHoursDaily: 11.5,
      wetDiapersDaily: 5,
      poopyDiapersDaily: 1,
      stage: "Preschooler (24+ months)",
    };
  }
}

/**
 * Calculate today's projections based on logged events.
 * Delegates to the smart projection engine in lib/projections.ts.
 */
export function calculateTodayProjections(
  events: BabyEvent[],
  ageWeeks: number
): TodayProjection {
  const proj = calculateProjections(events, ageWeeks);
  const targets = getAgeSpecificTargets(ageWeeks);

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
    const projections = calculateTodayProjections(events, ageWeeks);
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
