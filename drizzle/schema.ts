import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Sharing / Partner Invite ────────────────────────────────────────────────

/** Invite codes that link two parents to the same baby account */
export const shareInvites = mysqlTable("share_invites", {
  id: int("id").autoincrement().primaryKey(),
  /** The user who created the invite */
  ownerUserId: int("ownerUserId").notNull(),
  /** 6-char alphanumeric invite code */
  code: varchar("code", { length: 10 }).notNull().unique(),
  /** The user who accepted the invite (null until accepted) */
  partnerUserId: int("partnerUserId"),
  /** Status */
  status: mysqlEnum("status", ["pending", "accepted", "revoked"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
});

export type ShareInvite = typeof shareInvites.$inferSelect;
export type InsertShareInvite = typeof shareInvites.$inferInsert;

// ─── Cloud Events ───────────────────────────────────────────────────────────

/** Baby care events stored in the cloud for cross-device sync */
export const babyEvents = mysqlTable("baby_events", {
  id: int("id").autoincrement().primaryKey(),
  /** The user who created this event */
  userId: int("userId").notNull(),
  /** Household group ID — owner's userId, shared with partner */
  householdId: int("householdId").notNull(),
  /** Client-generated UUID for dedup */
  clientId: varchar("clientId", { length: 64 }).notNull(),
  /** Event type: feed, sleep, diaper, observation */
  type: varchar("type", { length: 32 }).notNull(),
  /** ISO timestamp of the event */
  eventTimestamp: varchar("eventTimestamp", { length: 64 }).notNull(),
  /** JSON-encoded event data */
  data: text("data").notNull(),
  /** Soft delete flag */
  deleted: int("deleted").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BabyEvent = typeof babyEvents.$inferSelect;
export type InsertBabyEvent = typeof babyEvents.$inferInsert;
