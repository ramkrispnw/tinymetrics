/**
 * Run with: npx tsx scripts/sample-context.ts
 * Prints the exact context string that would be sent to the AI
 * using realistic sample data.
 */

import { buildAIContext } from "../lib/ai-context-builder";
import type { BabyEvent, GrowthEntry, Milestone } from "../lib/store";

// ── Sample profile ────────────────────────────────────────────────────────────
const profile = {
  name: "Ishaan",
  birthDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // ~3 months old
  gender: "male" as const,
  weight: 6.2,
  weightUnit: "kg" as const,
  height: 62,
  heightUnit: "cm" as const,
  birthWeight: 3.1,
  birthWeightUnit: "kg" as const,
};

// ── Helper to build timestamps ────────────────────────────────────────────────
const today = new Date();
today.setHours(0, 0, 0, 0);
const ts = (daysAgo: number, hour: number, min = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};

// ── Sample events ─────────────────────────────────────────────────────────────
const events: BabyEvent[] = [
  // Today's events
  { id: "f1", type: "feed", timestamp: ts(0, 7, 30), createdAt: ts(0, 7, 30),
    data: { method: "bottle", amountMl: 120, notes: "drank well, no fussing" } },
  { id: "f2", type: "feed", timestamp: ts(0, 10, 0), createdAt: ts(0, 10, 0),
    data: { method: "bottle", amountMl: 130, notes: "" } },
  { id: "s1", type: "sleep", timestamp: ts(0, 8, 30), createdAt: ts(0, 8, 30),
    data: { startTime: ts(0, 8, 30), endTime: ts(0, 10, 0), notes: "woke up once, resettled quickly" } },
  { id: "d1", type: "diaper", timestamp: ts(0, 9, 0), createdAt: ts(0, 9, 0),
    data: { type: "both", pooColor: "yellow", notes: "normal seedy texture" } },
  { id: "d2", type: "diaper", timestamp: ts(0, 11, 0), createdAt: ts(0, 11, 0),
    data: { type: "pee" } },
  { id: "o1", type: "observation", timestamp: ts(0, 11, 30), createdAt: ts(0, 11, 30),
    data: { category: "other", severity: "mild", description: "baby seems gassy, pulling legs up", notes: "tried bicycle legs, helped a bit" } },
  { id: "m1", type: "medication", timestamp: ts(0, 8, 0), createdAt: ts(0, 8, 0),
    data: { name: "Vitamin D", dosage: "400 IU", frequency: "once daily", notes: "given with morning feed" } },

  // Yesterday
  { id: "f3", type: "feed", timestamp: ts(1, 7, 0), createdAt: ts(1, 7, 0),
    data: { method: "bottle", amountMl: 140 } },
  { id: "f4", type: "feed", timestamp: ts(1, 10, 0), createdAt: ts(1, 10, 0),
    data: { method: "bottle", amountMl: 130 } },
  { id: "f5", type: "feed", timestamp: ts(1, 13, 0), createdAt: ts(1, 13, 0),
    data: { method: "bottle", amountMl: 120 } },
  { id: "f6", type: "feed", timestamp: ts(1, 16, 0), createdAt: ts(1, 16, 0),
    data: { method: "bottle", amountMl: 130 } },
  { id: "f7", type: "feed", timestamp: ts(1, 19, 0), createdAt: ts(1, 19, 0),
    data: { method: "bottle", amountMl: 125 } },
  { id: "s2", type: "sleep", timestamp: ts(1, 21, 0), createdAt: ts(1, 21, 0),
    data: { startTime: ts(1, 21, 0), endTime: ts(0, 6, 30) } }, // overnight
  { id: "d3", type: "diaper", timestamp: ts(1, 9, 0), createdAt: ts(1, 9, 0),
    data: { type: "poo", pooColor: "yellow" } },
  { id: "d4", type: "diaper", timestamp: ts(1, 12, 0), createdAt: ts(1, 12, 0),
    data: { type: "pee" } },
  { id: "d5", type: "diaper", timestamp: ts(1, 15, 0), createdAt: ts(1, 15, 0),
    data: { type: "both" } },
  { id: "d6", type: "diaper", timestamp: ts(1, 18, 0), createdAt: ts(1, 18, 0),
    data: { type: "pee" } },
  { id: "d7", type: "diaper", timestamp: ts(1, 21, 0), createdAt: ts(1, 21, 0),
    data: { type: "pee" } },

  // 2 days ago
  { id: "f8", type: "feed", timestamp: ts(2, 7, 0), createdAt: ts(2, 7, 0),
    data: { method: "bottle", amountMl: 135 } },
  { id: "f9", type: "feed", timestamp: ts(2, 10, 0), createdAt: ts(2, 10, 0),
    data: { method: "bottle", amountMl: 140 } },
  { id: "f10", type: "feed", timestamp: ts(2, 13, 0), createdAt: ts(2, 13, 0),
    data: { method: "bottle", amountMl: 130 } },
  { id: "f11", type: "feed", timestamp: ts(2, 16, 0), createdAt: ts(2, 16, 0),
    data: { method: "bottle", amountMl: 125 } },
  { id: "f12", type: "feed", timestamp: ts(2, 19, 0), createdAt: ts(2, 19, 0),
    data: { method: "bottle", amountMl: 130 } },
  { id: "d8", type: "diaper", timestamp: ts(2, 9, 0), createdAt: ts(2, 9, 0),
    data: { type: "both", pooColor: "yellow" } },
  { id: "d9", type: "diaper", timestamp: ts(2, 12, 0), createdAt: ts(2, 12, 0),
    data: { type: "pee" } },
  { id: "d10", type: "diaper", timestamp: ts(2, 15, 0), createdAt: ts(2, 15, 0),
    data: { type: "pee" } },
  { id: "d11", type: "diaper", timestamp: ts(2, 18, 0), createdAt: ts(2, 18, 0),
    data: { type: "poo" } },
  { id: "d12", type: "diaper", timestamp: ts(2, 21, 0), createdAt: ts(2, 21, 0),
    data: { type: "pee" } },
  { id: "s3", type: "sleep", timestamp: ts(2, 21, 0), createdAt: ts(2, 21, 0),
    data: { startTime: ts(2, 21, 0), endTime: ts(1, 6, 30) } },
];

// ── Sample growth ─────────────────────────────────────────────────────────────
const growthHistory: GrowthEntry[] = [
  { id: "g1", date: "2026-03-15", weight: 6.2, weightUnit: "kg", height: 62, heightUnit: "cm", createdAt: ts(6, 9, 0) },
  { id: "g2", date: "2026-03-01", weight: 5.9, weightUnit: "kg", height: 61, heightUnit: "cm", createdAt: ts(20, 9, 0) },
];

// ── Sample milestones ─────────────────────────────────────────────────────────
const milestones: Milestone[] = [
  { id: "ms1", title: "First social smile", date: "2026-03-10", category: "social",
    notes: "smiled at mum during morning feed, repeated twice", createdAt: ts(11, 10, 0) },
  { id: "ms2", title: "Holds head steady", date: "2026-03-18", category: "motor",
    notes: "", createdAt: ts(3, 10, 0) },
];

// ── Build and print ───────────────────────────────────────────────────────────
const context = buildAIContext(profile, events, growthHistory, milestones, null);

console.log("=".repeat(80));
console.log("SAMPLE AI CONTEXT STRING");
console.log(`Total length: ${context.length} characters`);
console.log("=".repeat(80));
console.log(context);
console.log("=".repeat(80));
