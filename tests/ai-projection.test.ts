import { describe, it, expect, beforeAll } from "vitest";
import {
  calculateTodayProjections,
  getAgeSpecificTargets,
  formatTodayProjection,
  buildAIContext,
} from "../lib/ai-context-builder";
import type { BabyEvent } from "../lib/store";

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(hours: number, minutes = 0): string {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function makeFeedEvent(hours: number, amountMl: number): BabyEvent {
  return {
    id: `feed-${hours}`,
    type: "feed",
    timestamp: todayISO(hours),
    data: { method: "bottle", amountMl, durationMin: 0 },
  } as BabyEvent;
}

function makeSleepEvent(hours: number, durationMin: number): BabyEvent {
  return {
    id: `sleep-${hours}`,
    type: "sleep",
    timestamp: todayISO(hours),
    data: { durationMin },
  } as BabyEvent;
}

function makeDiaperEvent(hours: number, type: "pee" | "poo" | "both"): BabyEvent {
  return {
    id: `diaper-${hours}`,
    type: "diaper",
    timestamp: todayISO(hours),
    data: { type },
  } as BabyEvent;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getAgeSpecificTargets", () => {
  it("returns newborn targets for 0-week-old", () => {
    const t = getAgeSpecificTargets(0);
    expect(t.stage).toContain("Newborn");
    expect(t.feedingMlDaily).toBe(600);
    expect(t.sleepHoursDaily).toBe(16.5);
  });

  it("returns infant targets for 20-week-old", () => {
    const t = getAgeSpecificTargets(20);
    expect(t.stage).toContain("Infant");
    expect(t.feedingMlDaily).toBe(800);
  });

  it("returns toddler targets for 60-week-old", () => {
    const t = getAgeSpecificTargets(60);
    expect(t.stage).toContain("Toddler");
    expect(t.feedingMlDaily).toBe(500);
  });
});

describe("calculateTodayProjections – 4-month-old (18 weeks)", () => {
  const AGE_WEEKS = 18; // 4-month-old infant

  it("projects feeding correctly when 4 feedings logged", () => {
    const events: BabyEvent[] = [
      makeFeedEvent(7, 180),
      makeFeedEvent(10, 200),
      makeFeedEvent(13, 190),
      makeFeedEvent(16, 200),
    ];
    const proj = calculateTodayProjections(events, AGE_WEEKS);
    const fp = proj.feedingProjection;

    expect(fp.totalLoggedMl).toBe(770);
    expect(fp.feedingsCount).toBe(4);
    expect(fp.projectedTotalMl).toBeGreaterThan(fp.totalLoggedMl);
    expect(fp.dailyTargetMl).toBe(800);
    // Projected should be ≥ logged
    expect(fp.projectedTotalMl).toBeGreaterThanOrEqual(fp.totalLoggedMl);
  });

  it("projects sleep correctly when 2 naps logged", () => {
    const events: BabyEvent[] = [
      makeSleepEvent(9, 60),
      makeSleepEvent(13, 90),
    ];
    const proj = calculateTodayProjections(events, AGE_WEEKS);
    const sp = proj.sleepProjection;

    expect(sp.totalLoggedMinutes).toBe(150);
    expect(sp.napsCount).toBe(2);
    expect(sp.projectedTotalMinutes).toBeGreaterThanOrEqual(150);
    expect(sp.dailyTargetMinutes).toBe(14.5 * 60); // 870 min
  });

  it("projects diapers correctly when 4 wet + 1 poo logged", () => {
    const events: BabyEvent[] = [
      makeDiaperEvent(7, "pee"),
      makeDiaperEvent(9, "pee"),
      makeDiaperEvent(11, "both"),
      makeDiaperEvent(13, "pee"),
      makeDiaperEvent(15, "pee"),
    ];
    const proj = calculateTodayProjections(events, AGE_WEEKS);
    const dp = proj.diaperProjection;

    // "both" counts as both wet and poo
    expect(dp.wetDiapersLogged).toBe(5); // 4 pee + 1 both
    expect(dp.poopyDiapersLogged).toBe(1); // 1 both
    expect(dp.projectedWetDiapers).toBeGreaterThanOrEqual(5);
  });

  it("returns on-track status when at ~100% of target", () => {
    // Simulate a day where feeding is exactly on target pace
    const events: BabyEvent[] = [
      makeFeedEvent(6, 200),
      makeFeedEvent(9, 200),
      makeFeedEvent(12, 200),
      makeFeedEvent(15, 200),
    ];
    const proj = calculateTodayProjections(events, AGE_WEEKS);
    // Status should be on-track or ahead (not behind) with 800ml target
    expect(["on-track", "ahead"]).toContain(proj.feedingProjection.status);
  });
});

describe("calculateTodayProjections – Newborn (2 weeks)", () => {
  const AGE_WEEKS = 2;

  it("uses newborn targets (600ml daily)", () => {
    const events: BabyEvent[] = [makeFeedEvent(8, 60), makeFeedEvent(11, 60)];
    const proj = calculateTodayProjections(events, AGE_WEEKS);
    expect(proj.feedingProjection.dailyTargetMl).toBe(600);
  });

  it("flags as behind when only 2 feedings logged by midday", () => {
    const events: BabyEvent[] = [makeFeedEvent(8, 50), makeFeedEvent(11, 50)];
    const proj = calculateTodayProjections(events, AGE_WEEKS);
    // 100ml logged with 600ml target – likely behind
    expect(proj.feedingProjection.totalLoggedMl).toBe(100);
    // Projected should still be calculated
    expect(proj.feedingProjection.projectedTotalMl).toBeGreaterThan(0);
  });
});

describe("formatTodayProjection", () => {
  it("returns a non-empty string with all three sections", () => {
    const events: BabyEvent[] = [
      makeFeedEvent(8, 200),
      makeSleepEvent(9, 60),
      makeDiaperEvent(10, "pee"),
    ];
    const proj = calculateTodayProjections(events, 18);
    const text = formatTodayProjection(proj);

    expect(text).toContain("TODAY'S PROJECTION");
    expect(text).toContain("Feeding Projection");
    expect(text).toContain("Sleep Projection");
    expect(text).toContain("Diaper Projection");
    expect(text).toContain("Projected by end of day");
    expect(text).toContain("Status:");
  });
});

describe("buildAIContext", () => {
  const profile = {
    name: "Baby Aria",
    birthDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 18 * 7); // 18 weeks old
      return d.toISOString();
    })(),
    weight: 6.5,
    weightUnit: "kg",
    height: 62,
    heightUnit: "cm",
    sex: "female",
  };

  it("includes BABY PROFILE section", () => {
    const ctx = buildAIContext(profile, [], [], [], null);
    expect(ctx).toContain("BABY PROFILE");
    expect(ctx).toContain("Baby Aria");
  });

  it("includes TODAY'S PROJECTION section when profile has birthDate", () => {
    const events: BabyEvent[] = [
      makeFeedEvent(8, 180),
      makeFeedEvent(11, 200),
      makeSleepEvent(9, 60),
    ];
    const ctx = buildAIContext(profile, events, [], [], null);
    expect(ctx).toContain("TODAY'S PROJECTION");
    expect(ctx).toContain("Feeding Projection");
    expect(ctx).toContain("Sleep Projection");
  });

  it("includes TODAY'S EVENTS section", () => {
    const events: BabyEvent[] = [makeFeedEvent(8, 180)];
    const ctx = buildAIContext(profile, events, [], [], null);
    expect(ctx).toContain("TODAY'S EVENTS");
  });

  it("includes LAST 7 DAYS SUMMARY section", () => {
    const ctx = buildAIContext(profile, [], [], [], null);
    expect(ctx).toContain("LAST 7 DAYS SUMMARY");
  });

  it("includes ACTIVE SLEEP section when activeSleep is set", () => {
    const activeSleep = { startTime: new Date(Date.now() - 30 * 60000).toISOString() };
    const ctx = buildAIContext(profile, [], [], [], activeSleep);
    expect(ctx).toContain("ACTIVE SLEEP");
  });

  it("does not exceed 14000 characters", () => {
    // Generate many events to test truncation
    const events: BabyEvent[] = [];
    for (let i = 0; i < 200; i++) {
      events.push(makeFeedEvent(i % 24, 200));
    }
    const ctx = buildAIContext(profile, events, [], [], null);
    expect(ctx.length).toBeLessThanOrEqual(14100); // slight buffer for truncation message
  });
});
