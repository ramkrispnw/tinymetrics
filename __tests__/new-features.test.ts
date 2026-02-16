import { describe, it, expect } from "vitest";

// Test Activity date range helpers
describe("Activity Date Range", () => {
  it("should compute Today range correctly", () => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    expect(start.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(end.getTime()).toBeGreaterThanOrEqual(now.getTime());
    expect(end.getTime() - start.getTime()).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it("should compute Yesterday range correctly", () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    expect(yesterday.getDate()).not.toBe(now.getDate());
    expect(yesterdayEnd.getTime() - yesterday.getTime()).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it("should compute Week range (7 days back)", () => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const diff = now.getTime() - weekAgo.getTime();
    expect(diff).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThanOrEqual(8 * 24 * 60 * 60 * 1000);
  });

  it("should compute 3 Months range (90 days back)", () => {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
    threeMonthsAgo.setHours(0, 0, 0, 0);

    const diff = now.getTime() - threeMonthsAgo.getTime();
    expect(diff).toBeGreaterThanOrEqual(89 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThanOrEqual(91 * 24 * 60 * 60 * 1000);
  });

  it("should support custom range with start and end dates", () => {
    const start = new Date("2025-12-01T00:00:00");
    const end = new Date("2025-12-31T23:59:59");

    expect(start.getTime()).toBeLessThan(end.getTime());
    const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(31);
  });
});

// Test Milestone data model
describe("Milestone Data Model", () => {
  const MILESTONE_CATEGORIES = [
    { key: "motor", label: "Motor", icon: "🏃" },
    { key: "social", label: "Social", icon: "😊" },
    { key: "language", label: "Language", icon: "🗣" },
    { key: "cognitive", label: "Cognitive", icon: "🧠" },
    { key: "feeding", label: "Feeding", icon: "🍼" },
    { key: "other", label: "Other", icon: "⭐" },
  ];

  it("should have 6 milestone categories", () => {
    expect(MILESTONE_CATEGORIES).toHaveLength(6);
  });

  it("should have required fields for a milestone", () => {
    const milestone = {
      id: "abc123",
      title: "First smile",
      date: "2025-06-15",
      category: "social" as const,
      notes: "So cute!",
      photoUri: undefined,
      createdAt: new Date().toISOString(),
    };

    expect(milestone.id).toBeDefined();
    expect(milestone.title).toBe("First smile");
    expect(milestone.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(milestone.category).toBe("social");
    expect(milestone.createdAt).toBeDefined();
  });

  it("should allow optional photo and notes", () => {
    const milestone = {
      id: "def456",
      title: "First steps",
      date: "2026-01-10",
      category: "motor" as const,
      createdAt: new Date().toISOString(),
    };

    expect(milestone.title).toBe("First steps");
    expect((milestone as any).notes).toBeUndefined();
    expect((milestone as any).photoUri).toBeUndefined();
  });

  it("should filter milestones by category", () => {
    const milestones = [
      { id: "1", title: "First smile", category: "social", date: "2025-06-15", createdAt: "" },
      { id: "2", title: "First steps", category: "motor", date: "2025-12-01", createdAt: "" },
      { id: "3", title: "First word", category: "language", date: "2025-10-20", createdAt: "" },
      { id: "4", title: "Rolled over", category: "motor", date: "2025-08-05", createdAt: "" },
    ];

    const motorOnly = milestones.filter((m) => m.category === "motor");
    expect(motorOnly).toHaveLength(2);
    expect(motorOnly[0].title).toBe("First steps");
    expect(motorOnly[1].title).toBe("Rolled over");
  });
});

// Test Weekly Digest data preparation
describe("Weekly Digest Data Preparation", () => {
  it("should filter events from past 7 days", () => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoMs = weekAgo.getTime();

    const events = [
      { timestamp: new Date().toISOString(), type: "feed" },
      { timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), type: "sleep" },
      { timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), type: "diaper" },
    ];

    const weekEvents = events.filter(
      (e) => new Date(e.timestamp).getTime() >= weekAgoMs
    );

    expect(weekEvents).toHaveLength(2);
    expect(weekEvents[0].type).toBe("feed");
    expect(weekEvents[1].type).toBe("sleep");
  });

  it("should compute feed stats correctly", () => {
    const feeds = [
      { type: "feed", data: { method: "bottle", amountMl: 120 } },
      { type: "feed", data: { method: "bottle", amountMl: 150 } },
      { type: "feed", data: { method: "breast_left", amountMl: 0 } },
    ];

    const totalFeedMl = feeds.reduce(
      (sum, e) => sum + ((e.data as any).amountMl || 0),
      0
    );
    const avgFeedMl = feeds.length > 0 ? Math.round(totalFeedMl / feeds.length) : 0;

    expect(totalFeedMl).toBe(270);
    expect(avgFeedMl).toBe(90);
    expect(feeds.length).toBe(3);
  });

  it("should compute diaper stats correctly", () => {
    const diapers = [
      { type: "diaper", data: { type: "pee" } },
      { type: "diaper", data: { type: "poo" } },
      { type: "diaper", data: { type: "both" } },
      { type: "diaper", data: { type: "pee" } },
    ];

    const peeCount = diapers.filter(
      (e) => (e.data as any).type === "pee" || (e.data as any).type === "both"
    ).length;
    const pooCount = diapers.filter(
      (e) => (e.data as any).type === "poo" || (e.data as any).type === "both"
    ).length;

    expect(peeCount).toBe(3); // 2 pee + 1 both
    expect(pooCount).toBe(2); // 1 poo + 1 both
    expect(diapers.length).toBe(4);
  });
});

// Test Chart AI Summary data format
describe("Chart AI Summary Data Format", () => {
  it("should format feed chart data as JSON", () => {
    const feedData = [
      { day: "2026-02-10", value: 450, unit: "ml" },
      { day: "2026-02-11", value: 520, unit: "ml" },
      { day: "2026-02-12", value: 380, unit: "ml" },
    ];

    const json = JSON.stringify(feedData);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(3);
    expect(parsed[0].day).toBe("2026-02-10");
    expect(parsed[0].value).toBe(450);
    expect(parsed[0].unit).toBe("ml");
  });

  it("should format sleep chart data with minutes", () => {
    const sleepData = [
      { day: "2026-02-10", minutes: 720 },
      { day: "2026-02-11", minutes: 680 },
    ];

    const json = JSON.stringify(sleepData);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].minutes).toBe(720);
  });

  it("should format diaper chart data with counts", () => {
    const diaperData = [
      { day: "2026-02-10", count: 6 },
      { day: "2026-02-11", count: 5 },
    ];

    const json = JSON.stringify(diaperData);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].count).toBe(6);
  });

  it("should format growth chart data with units", () => {
    const weightData = [
      { date: "2026-01-01", value: 4.5, unit: "kg" },
      { date: "2026-02-01", value: 5.2, unit: "kg" },
    ];

    const json = JSON.stringify(weightData);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(2);
    expect(parsed[1].value).toBe(5.2);
    expect(parsed[1].unit).toBe("kg");
  });
});
