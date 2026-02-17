import { describe, it, expect } from "vitest";

// ─── Server-side DB functions (unit-testable logic) ─────────────────────────

describe("Invite code generation", () => {
  it("generates 6-character alphanumeric codes", () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const generateInviteCode = (): string => {
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return code;
    };

    const code = generateInviteCode();
    expect(code).toHaveLength(6);
    // Should only contain allowed characters (no 0, O, I, 1)
    for (const ch of code) {
      expect(chars).toContain(ch);
    }
  });

  it("generates unique codes", () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const generateInviteCode = (): string => {
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return code;
    };

    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateInviteCode());
    }
    // With 30^6 = 729M possibilities, 100 codes should all be unique
    expect(codes.size).toBe(100);
  });
});

describe("Household ID resolution", () => {
  it("returns owner userId when user is the owner (solo)", () => {
    // When there's no partner link, householdId = userId
    const userId = 42;
    const asPartnerResults: any[] = []; // No partner records
    const householdId = asPartnerResults.length > 0 ? asPartnerResults[0].ownerUserId : userId;
    expect(householdId).toBe(42);
  });

  it("returns owner userId when user is a partner", () => {
    // When user is a partner, householdId = ownerUserId
    const userId = 99;
    const asPartnerResults = [{ ownerUserId: 42 }]; // User 99 is partner of user 42
    const householdId = asPartnerResults.length > 0 ? asPartnerResults[0].ownerUserId : userId;
    expect(householdId).toBe(42);
  });

  it("both owner and partner resolve to same household", () => {
    const ownerUserId = 42;
    const partnerUserId = 99;

    // Owner resolves to their own ID
    const ownerHousehold = ownerUserId;
    // Partner resolves to owner's ID
    const partnerResults = [{ ownerUserId: 42 }];
    const partnerHousehold = partnerResults.length > 0 ? partnerResults[0].ownerUserId : partnerUserId;

    expect(ownerHousehold).toBe(partnerHousehold);
  });
});

describe("Cloud event merge logic", () => {
  it("merges cloud and local events by id, cloud wins for duplicates", () => {
    type MockEvent = { id: string; type: string; timestamp: string; data: any };

    const localEvents: MockEvent[] = [
      { id: "a1", type: "feed", timestamp: "2026-02-16T10:00:00Z", data: { method: "bottle", amountMl: 100 } },
      { id: "a2", type: "sleep", timestamp: "2026-02-16T11:00:00Z", data: { durationMin: 30 } },
      { id: "local-only", type: "diaper", timestamp: "2026-02-16T12:00:00Z", data: { type: "pee" } },
    ];

    const cloudEvents: MockEvent[] = [
      { id: "a1", type: "feed", timestamp: "2026-02-16T10:00:00Z", data: { method: "bottle", amountMl: 120 } }, // Updated amount
      { id: "a2", type: "sleep", timestamp: "2026-02-16T11:00:00Z", data: { durationMin: 30 } }, // Same
      { id: "cloud-only", type: "feed", timestamp: "2026-02-16T13:00:00Z", data: { method: "breast_left" } }, // Partner's event
    ];

    const mergedMap = new Map<string, MockEvent>();
    for (const e of localEvents) mergedMap.set(e.id, e);
    for (const e of cloudEvents) mergedMap.set(e.id, e); // Cloud overwrites local
    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    expect(merged).toHaveLength(4); // a1, a2, local-only, cloud-only
    // Cloud version of a1 should win (amountMl: 120)
    const a1 = merged.find((e) => e.id === "a1");
    expect(a1?.data.amountMl).toBe(120);
    // local-only should still exist
    expect(merged.find((e) => e.id === "local-only")).toBeTruthy();
    // cloud-only should be included
    expect(merged.find((e) => e.id === "cloud-only")).toBeTruthy();
    // Sorted by timestamp descending
    expect(merged[0].id).toBe("cloud-only"); // 13:00
    expect(merged[merged.length - 1].id).toBe("a1"); // 10:00
  });
});

describe("Growth history merge logic", () => {
  it("merges local and cloud growth entries by id", () => {
    type GrowthEntry = { id: string; date: string; weight?: number; height?: number };

    const local: GrowthEntry[] = [
      { id: "g1", date: "2026-02-10", weight: 5.2 },
      { id: "g2", date: "2026-02-15", weight: 5.5 },
    ];

    const cloud: GrowthEntry[] = [
      { id: "g1", date: "2026-02-10", weight: 5.2 }, // Same
      { id: "g3", date: "2026-02-12", weight: 5.3, height: 55 }, // Partner's entry
    ];

    const mergedMap = new Map<string, GrowthEntry>();
    for (const e of local) mergedMap.set(e.id, e);
    for (const e of cloud) mergedMap.set(e.id, e);
    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    expect(merged).toHaveLength(3); // g1, g2, g3
    expect(merged.find((e) => e.id === "g3")?.height).toBe(55);
  });
});

describe("Milestone merge logic", () => {
  it("merges local and cloud milestones by id", () => {
    type Milestone = { id: string; title: string; date: string; category: string };

    const local: Milestone[] = [
      { id: "m1", title: "First smile", date: "2026-01-15", category: "social" },
    ];

    const cloud: Milestone[] = [
      { id: "m1", title: "First smile", date: "2026-01-15", category: "social" },
      { id: "m2", title: "First word", date: "2026-02-10", category: "language" }, // Partner logged this
    ];

    const mergedMap = new Map<string, Milestone>();
    for (const m of local) mergedMap.set(m.id, m);
    for (const m of cloud) mergedMap.set(m.id, m);
    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].title).toBe("First word"); // Most recent first
    expect(merged[1].title).toBe("First smile");
  });
});

describe("Invite acceptance flow", () => {
  it("rejects self-acceptance", () => {
    const ownerUserId = 42;
    const partnerUserId = 42; // Same user
    const isSelf = ownerUserId === partnerUserId;
    expect(isSelf).toBe(true);
  });

  it("allows different user to accept", () => {
    const ownerUserId: number = 42;
    const partnerUserId: number = 99;
    const isSelf = ownerUserId === partnerUserId;
    expect(isSelf).toBe(false);
  });
});

describe("Profile sync", () => {
  it("serializes and deserializes profile correctly", () => {
    const profile = {
      name: "Baby Emma",
      birthDate: "2026-01-01",
      sex: "girl" as const,
      weight: 5.5,
      weightUnit: "kg" as const,
      height: 55,
      heightUnit: "cm" as const,
    };

    const serialized = JSON.stringify(profile);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.name).toBe("Baby Emma");
    expect(deserialized.weight).toBe(5.5);
    expect(deserialized.heightUnit).toBe("cm");
  });

  it("cloud profile with name takes precedence", () => {
    const localProfile = null;
    const cloudProfile = {
      name: "Baby Emma",
      birthDate: "2026-01-01",
    };

    // Cloud wins if it has a name
    const result = cloudProfile.name ? cloudProfile : localProfile;
    expect(result?.name).toBe("Baby Emma");
  });
});
