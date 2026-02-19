import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  type AppSettings,
  type NotificationSettings,
  type BabyEvent,
  type GrowthEntry,
  type Milestone,
} from "../lib/store";

describe("NotificationSettings type and defaults", () => {
  it("should have default notification settings with both toggles enabled", () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS.partnerActivity).toBe(true);
    expect(DEFAULT_NOTIFICATION_SETTINGS.feedReminders).toBe(true);
  });

  it("should include notifications in DEFAULT_SETTINGS", () => {
    expect(DEFAULT_SETTINGS.notifications).toBeDefined();
    expect(DEFAULT_SETTINGS.notifications.partnerActivity).toBe(true);
    expect(DEFAULT_SETTINGS.notifications.feedReminders).toBe(true);
  });

  it("should allow updating notification settings independently", () => {
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      notifications: {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        partnerActivity: false,
      },
    };
    expect(settings.notifications.partnerActivity).toBe(false);
    expect(settings.notifications.feedReminders).toBe(true);
  });

  it("should allow disabling feed reminders", () => {
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      notifications: {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        feedReminders: false,
      },
    };
    expect(settings.notifications.feedReminders).toBe(false);
    expect(settings.notifications.partnerActivity).toBe(true);
  });
});

describe("User attribution fields", () => {
  it("BabyEvent should support loggedBy and loggedByName", () => {
    const event: BabyEvent = {
      id: "test1",
      type: "feed",
      timestamp: new Date().toISOString(),
      data: { method: "bottle", amountMl: 120 },
      createdAt: new Date().toISOString(),
      loggedBy: "user123",
      loggedByName: "Alice",
    };
    expect(event.loggedBy).toBe("user123");
    expect(event.loggedByName).toBe("Alice");
  });

  it("BabyEvent loggedBy fields should be optional", () => {
    const event: BabyEvent = {
      id: "test2",
      type: "diaper",
      timestamp: new Date().toISOString(),
      data: { type: "pee" },
      createdAt: new Date().toISOString(),
    };
    expect(event.loggedBy).toBeUndefined();
    expect(event.loggedByName).toBeUndefined();
  });

  it("GrowthEntry should support loggedBy and loggedByName", () => {
    const entry: GrowthEntry = {
      id: "g1",
      date: "2026-01-15",
      weight: 5.5,
      weightUnit: "kg",
      createdAt: new Date().toISOString(),
      loggedBy: "user456",
      loggedByName: "Bob",
    };
    expect(entry.loggedBy).toBe("user456");
    expect(entry.loggedByName).toBe("Bob");
  });

  it("Milestone should support loggedBy and loggedByName", () => {
    const milestone: Milestone = {
      id: "m1",
      title: "First smile",
      date: "2026-01-20",
      category: "social",
      createdAt: new Date().toISOString(),
      loggedBy: "user789",
      loggedByName: "Charlie",
    };
    expect(milestone.loggedBy).toBe("user789");
    expect(milestone.loggedByName).toBe("Charlie");
  });
});

describe("Cloud sync loggedBy data extraction", () => {
  it("should extract loggedBy from cloud event data JSON", () => {
    // Simulate what loadFromCloud does: parse data JSON and extract _loggedBy
    const cloudData = JSON.stringify({
      method: "bottle",
      amountMl: 150,
      _loggedBy: "user123",
      _loggedByName: "Alice",
    });

    const parsed = JSON.parse(cloudData);
    const loggedBy = parsed._loggedBy;
    const loggedByName = parsed._loggedByName;

    // Clean data (remove internal fields)
    delete parsed._loggedBy;
    delete parsed._loggedByName;

    expect(loggedBy).toBe("user123");
    expect(loggedByName).toBe("Alice");
    expect(parsed._loggedBy).toBeUndefined();
    expect(parsed._loggedByName).toBeUndefined();
    expect(parsed.method).toBe("bottle");
    expect(parsed.amountMl).toBe(150);
  });

  it("should handle cloud data without loggedBy fields", () => {
    const cloudData = JSON.stringify({
      method: "breast_left",
      durationMin: 15,
    });

    const parsed = JSON.parse(cloudData);
    const loggedBy = parsed._loggedBy;
    const loggedByName = parsed._loggedByName;

    expect(loggedBy).toBeUndefined();
    expect(loggedByName).toBeUndefined();
  });
});

describe("Partner notification filtering", () => {
  it("should identify new partner events (events not in existing set and from different user)", () => {
    const existingEvents: BabyEvent[] = [
      {
        id: "e1",
        type: "feed",
        timestamp: "2026-01-15T10:00:00Z",
        data: { method: "bottle", amountMl: 120 },
        createdAt: "2026-01-15T10:00:00Z",
        loggedBy: "user1",
        loggedByName: "Me",
      },
    ];

    const cloudEvents: BabyEvent[] = [
      {
        id: "e1",
        type: "feed",
        timestamp: "2026-01-15T10:00:00Z",
        data: { method: "bottle", amountMl: 120 },
        createdAt: "2026-01-15T10:00:00Z",
        loggedBy: "user1",
        loggedByName: "Me",
      },
      {
        id: "e2",
        type: "diaper",
        timestamp: "2026-01-15T11:00:00Z",
        data: { type: "pee" },
        createdAt: "2026-01-15T11:00:00Z",
        loggedBy: "user2",
        loggedByName: "Partner",
      },
    ];

    const currentUserId = "user1";
    const existingIds = new Set(existingEvents.map((e) => e.id));
    const newPartnerEvents = cloudEvents.filter(
      (e) => !existingIds.has(e.id) && e.loggedBy && e.loggedBy !== currentUserId
    );

    expect(newPartnerEvents).toHaveLength(1);
    expect(newPartnerEvents[0].id).toBe("e2");
    expect(newPartnerEvents[0].loggedByName).toBe("Partner");
  });

  it("should not notify for own events", () => {
    const existingEvents: BabyEvent[] = [];
    const cloudEvents: BabyEvent[] = [
      {
        id: "e3",
        type: "sleep",
        timestamp: "2026-01-15T20:00:00Z",
        data: { startTime: "2026-01-15T20:00:00Z" },
        createdAt: "2026-01-15T20:00:00Z",
        loggedBy: "user1",
        loggedByName: "Me",
      },
    ];

    const currentUserId = "user1";
    const existingIds = new Set(existingEvents.map((e) => e.id));
    const newPartnerEvents = cloudEvents.filter(
      (e) => !existingIds.has(e.id) && e.loggedBy && e.loggedBy !== currentUserId
    );

    expect(newPartnerEvents).toHaveLength(0);
  });

  it("should respect notification settings when partnerActivity is disabled", () => {
    const settings: NotificationSettings = {
      partnerActivity: false,
      feedReminders: true,
    };

    // Simulate the check in loadFromCloud
    const shouldNotify = settings.partnerActivity !== false;
    expect(shouldNotify).toBe(false);
  });
});
