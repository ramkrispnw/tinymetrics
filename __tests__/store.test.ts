import { describe, it, expect } from "vitest";
import {
  isToday,
  formatTime,
  formatDuration,
  mlToOz,
  getDayKey,
  calculateAge,
  getProfileSummary,
} from "../lib/store";

describe("isToday", () => {
  it("returns true for today's ISO string", () => {
    expect(isToday(new Date().toISOString())).toBe(true);
  });

  it("returns false for yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday.toISOString())).toBe(false);
  });
});

describe("formatTime", () => {
  it("formats an ISO string to a time string", () => {
    const result = formatTime("2026-02-15T14:30:00.000Z");
    // Should be a string containing numbers and colon
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
});

describe("formatDuration", () => {
  it("formats 0 minutes", () => {
    expect(formatDuration(0)).toBe("0m");
  });

  it("formats minutes only", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });

  it("formats exact hours", () => {
    expect(formatDuration(120)).toBe("2h");
  });
});

describe("mlToOz", () => {
  it("converts ml to oz", () => {
    expect(mlToOz(30)).toBeCloseTo(1.0, 1);
  });

  it("converts 0 ml", () => {
    expect(mlToOz(0)).toBe(0);
  });

  it("converts larger amounts", () => {
    // 240ml ≈ 8.1oz
    const result = mlToOz(240);
    expect(result).toBeGreaterThan(8);
    expect(result).toBeLessThan(8.2);
  });
});

describe("getDayKey", () => {
  it("returns YYYY-MM-DD format", () => {
    const key = getDayKey("2026-02-15T14:30:00.000Z");
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses local timezone, not UTC", () => {
    // Create a date at a known local time
    const localDate = new Date(2026, 5, 15, 10, 30, 0); // June 15, 2026 10:30 AM local
    const key = getDayKey(localDate.toISOString());
    // Should always be 2026-06-15 in local timezone regardless of UTC offset
    expect(key).toBe("2026-06-15");
  });

  it("groups late-night events to the correct local day", () => {
    // Create a date at 11:30 PM local time
    const lateNight = new Date(2026, 0, 20, 23, 30, 0); // Jan 20, 2026 11:30 PM local
    const key = getDayKey(lateNight.toISOString());
    // Should be Jan 20 in local timezone, not Jan 21 (which it would be in UTC for western timezones)
    expect(key).toBe("2026-01-20");
  });

  it("groups early-morning events to the correct local day", () => {
    // Create a date at 1:00 AM local time
    const earlyMorning = new Date(2026, 2, 10, 1, 0, 0); // Mar 10, 2026 1:00 AM local
    const key = getDayKey(earlyMorning.toISOString());
    expect(key).toBe("2026-03-10");
  });
});

describe("calculateAge", () => {
  it("returns days for newborns less than 1 month old", () => {
    const now = new Date();
    const tenDaysAgo = new Date(now);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const result = calculateAge(tenDaysAgo.toISOString().split("T")[0]);
    expect(result.months).toBe(0);
    expect(result.label).toContain("day");
    expect(result.label).toContain("old");
  });

  it("returns months for babies under 2 years", () => {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const result = calculateAge(sixMonthsAgo.toISOString().split("T")[0]);
    expect(result.months).toBeGreaterThanOrEqual(5);
    expect(result.months).toBeLessThanOrEqual(7);
    expect(result.label).toContain("mo");
    expect(result.label).toContain("old");
  });

  it("returns years for children 2+ years", () => {
    const now = new Date();
    const threeYearsAgo = new Date(now);
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const result = calculateAge(threeYearsAgo.toISOString().split("T")[0]);
    expect(result.months).toBeGreaterThanOrEqual(35);
    expect(result.label).toContain("y");
    expect(result.label).toContain("old");
  });
});

describe("getProfileSummary", () => {
  it("returns no profile message when null", () => {
    expect(getProfileSummary(null)).toBe("No baby profile set up.");
  });

  it("includes name and age", () => {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const result = getProfileSummary({
      name: "Emma",
      birthDate: threeMonthsAgo.toISOString().split("T")[0],
    });
    expect(result).toContain("Emma");
    expect(result).toContain("Age:");
  });

  it("includes weight and height when provided", () => {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const result = getProfileSummary({
      name: "Liam",
      birthDate: oneMonthAgo.toISOString().split("T")[0],
      weight: 4.5,
      weightUnit: "kg",
      height: 52,
      heightUnit: "cm",
    });
    expect(result).toContain("Liam");
    expect(result).toContain("4.5 kg");
    expect(result).toContain("52 cm");
  });

  it("uses default units when not specified", () => {
    const now = new Date();
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const result = getProfileSummary({
      name: "Test",
      birthDate: twoMonthsAgo.toISOString().split("T")[0],
      weight: 5.0,
      height: 55,
    });
    expect(result).toContain("5 kg");
    expect(result).toContain("55 cm");
  });
});
