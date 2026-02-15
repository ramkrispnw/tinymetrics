import { describe, it, expect } from "vitest";
import {
  isToday,
  formatTime,
  formatDuration,
  mlToOz,
  getDayKey,
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
});
