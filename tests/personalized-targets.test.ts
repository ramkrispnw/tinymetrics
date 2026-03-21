/**
 * Tests for personalized target logic in getAgeSpecificTargets()
 */
import { describe, it, expect } from "vitest";
import { getAgeSpecificTargets } from "../lib/ai-context-builder";

describe("getAgeSpecificTargets – weight-based feeding", () => {
  it("uses weight × 150ml/kg for a 3-month-old with known weight, clamped to bracket max", () => {
    // 3 months ≈ 13 weeks, bracket: Young Infant (8-16 weeks), 150ml/kg
    // 6kg × 150 = 900ml, but bracket max is 850 → clamped to 850
    const targets = getAgeSpecificTargets(13, 6.0);
    expect(targets.feedingMlDaily).toBeLessThanOrEqual(850);
    expect(targets.feedingMlDaily).toBeGreaterThanOrEqual(550);
    // Should be higher than fallback (700) since weight-based calculation is used
    expect(targets.feedingMlDaily).toBeGreaterThan(700);
  });

  it("uses fallback when weight is not set", () => {
    const targets = getAgeSpecificTargets(13); // no weight
    expect(targets.feedingMlDaily).toBe(700); // fallback for 8-16 weeks
  });

  it("clamps feeding target to bracket minimum", () => {
    // Very small baby (2kg) at 13 weeks → 2 × 150 = 300, below min 550
    const targets = getAgeSpecificTargets(13, 2.0);
    expect(targets.feedingMlDaily).toBeGreaterThanOrEqual(550);
  });

  it("applies LBW floor reduction for birth weight < 2.5kg", () => {
    // Small baby at 13 weeks, low birth weight → min floor reduced by 10%
    const normalTargets = getAgeSpecificTargets(13, 2.0);
    const lbwTargets = getAgeSpecificTargets(13, 2.0, 2.0); // birth weight 2kg
    // LBW min is 10% lower, so lbwTargets.feedingMlDaily can be slightly lower
    expect(lbwTargets.feedingMlDaily).toBeLessThanOrEqual(normalTargets.feedingMlDaily);
  });
});

describe("getAgeSpecificTargets – sleep prematurity correction", () => {
  it("adds 0.5h sleep bonus for low birth weight baby under 26 weeks", () => {
    const normal = getAgeSpecificTargets(10); // no birth weight
    const premature = getAgeSpecificTargets(10, undefined, 2.0); // birth weight 2kg
    expect(premature.sleepHoursDaily).toBeGreaterThan(normal.sleepHoursDaily);
    expect(premature.sleepHoursDaily - normal.sleepHoursDaily).toBeCloseTo(0.5, 1);
  });

  it("does not add sleep bonus for normal birth weight", () => {
    const normal = getAgeSpecificTargets(10);
    const normalBirth = getAgeSpecificTargets(10, undefined, 3.5); // 3.5kg birth weight
    expect(normalBirth.sleepHoursDaily).toBe(normal.sleepHoursDaily);
  });

  it("does not add sleep bonus for babies over 26 weeks even if LBW", () => {
    const targets = getAgeSpecificTargets(30, undefined, 2.0); // 30 weeks, LBW
    const noLbw = getAgeSpecificTargets(30);
    expect(targets.sleepHoursDaily).toBe(noLbw.sleepHoursDaily);
  });
});

describe("getAgeSpecificTargets – wet diaper derivation", () => {
  it("derives wet diapers from feeding volume", () => {
    // 6kg baby at 13 weeks: feeding ≈ 850ml → 850/100 = 8.5 → clamped to 8 (max 10)
    const targets = getAgeSpecificTargets(13, 6.0);
    const expectedWet = Math.round(Math.min(10, Math.max(6, targets.feedingMlDaily / 100)));
    expect(targets.wetDiapersDaily).toBe(expectedWet);
  });

  it("wet diapers are within bracket bounds", () => {
    const targets = getAgeSpecificTargets(13, 5.0);
    expect(targets.wetDiapersDaily).toBeGreaterThanOrEqual(6);
    expect(targets.wetDiapersDaily).toBeLessThanOrEqual(10);
  });
});

describe("getAgeSpecificTargets – smooth bracket transitions", () => {
  it("interpolates smoothly at bracket boundary (week 15 → 16)", () => {
    const week14 = getAgeSpecificTargets(14, 6.0); // Young Infant, 1 week before boundary
    const week16 = getAgeSpecificTargets(16, 6.0); // Infant bracket
    const week15 = getAgeSpecificTargets(15, 6.0); // In transition window

    // Week 15 feeding should be between week 14 and week 16 values
    const min = Math.min(week14.feedingMlDaily, week16.feedingMlDaily);
    const max = Math.max(week14.feedingMlDaily, week16.feedingMlDaily);
    expect(week15.feedingMlDaily).toBeGreaterThanOrEqual(min - 1);
    expect(week15.feedingMlDaily).toBeLessThanOrEqual(max + 1);
  });

  it("sleep transitions smoothly across bracket boundary", () => {
    const week14 = getAgeSpecificTargets(14);
    const week16 = getAgeSpecificTargets(16);
    const week15 = getAgeSpecificTargets(15);
    const min = Math.min(week14.sleepHoursDaily, week16.sleepHoursDaily);
    const max = Math.max(week14.sleepHoursDaily, week16.sleepHoursDaily);
    expect(week15.sleepHoursDaily).toBeGreaterThanOrEqual(min - 0.1);
    expect(week15.sleepHoursDaily).toBeLessThanOrEqual(max + 0.1);
  });
});

describe("getAgeSpecificTargets – stage labels", () => {
  it("returns correct stage for each bracket", () => {
    expect(getAgeSpecificTargets(4).stage).toBe("Newborn (0-8 weeks)");
    expect(getAgeSpecificTargets(12).stage).toBe("Young Infant (8-16 weeks)");
    expect(getAgeSpecificTargets(20).stage).toBe("Infant (4-6 months)");
    expect(getAgeSpecificTargets(30).stage).toBe("Older Infant (6-9 months)");
    expect(getAgeSpecificTargets(45).stage).toBe("Mobile Infant (9-12 months)");
    expect(getAgeSpecificTargets(60).stage).toBe("Toddler (12-24 months)");
    expect(getAgeSpecificTargets(110).stage).toBe("Preschooler (24+ months)");
  });
});
