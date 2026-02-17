import { eq, and, or, desc, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, shareInvites, babyEvents, householdData } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Sharing / Partner Invite Queries ─────────────────────────────────────

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/I/1 for clarity
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createInvite(ownerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user already has a pending invite
  const existing = await db
    .select()
    .from(shareInvites)
    .where(
      and(
        eq(shareInvites.ownerUserId, ownerUserId),
        eq(shareInvites.status, "pending")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { code: existing[0].code, id: existing[0].id };
  }

  const code = generateInviteCode();
  const result = await db.insert(shareInvites).values({
    ownerUserId,
    code,
    status: "pending",
  });
  return { code, id: Number(result[0].insertId) };
}

export async function acceptInvite(code: string, partnerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const invites = await db
    .select()
    .from(shareInvites)
    .where(
      and(
        eq(shareInvites.code, code.toUpperCase()),
        eq(shareInvites.status, "pending")
      )
    )
    .limit(1);

  if (invites.length === 0) {
    return { success: false, error: "Invalid or expired invite code" };
  }

  const invite = invites[0];
  if (invite.ownerUserId === partnerUserId) {
    return { success: false, error: "You cannot accept your own invite" };
  }

  await db
    .update(shareInvites)
    .set({
      partnerUserId,
      status: "accepted",
      acceptedAt: new Date(),
    })
    .where(eq(shareInvites.id, invite.id));

  // Get owner info
  const owner = await db
    .select()
    .from(users)
    .where(eq(users.id, invite.ownerUserId))
    .limit(1);

  return {
    success: true,
    ownerName: owner[0]?.name || "Partner",
    ownerUserId: invite.ownerUserId,
  };
}

export async function getPartnerInfo(userId: number) {
  const db = await getDb();
  if (!db) return null;

  // Check if user is an owner with an accepted invite
  const asOwner = await db
    .select()
    .from(shareInvites)
    .where(
      and(
        eq(shareInvites.ownerUserId, userId),
        eq(shareInvites.status, "accepted")
      )
    )
    .limit(1);

  if (asOwner.length > 0 && asOwner[0].partnerUserId) {
    const partner = await db
      .select()
      .from(users)
      .where(eq(users.id, asOwner[0].partnerUserId))
      .limit(1);
    return {
      partnerId: asOwner[0].partnerUserId,
      partnerName: partner[0]?.name || "Partner",
      partnerEmail: partner[0]?.email || null,
      inviteId: asOwner[0].id,
      role: "owner" as const,
    };
  }

  // Check if user is a partner
  const asPartner = await db
    .select()
    .from(shareInvites)
    .where(
      and(
        eq(shareInvites.partnerUserId!, userId),
        eq(shareInvites.status, "accepted")
      )
    )
    .limit(1);

  if (asPartner.length > 0) {
    const owner = await db
      .select()
      .from(users)
      .where(eq(users.id, asPartner[0].ownerUserId))
      .limit(1);
    return {
      partnerId: asPartner[0].ownerUserId,
      partnerName: owner[0]?.name || "Partner",
      partnerEmail: owner[0]?.email || null,
      inviteId: asPartner[0].id,
      role: "partner" as const,
    };
  }

  return null;
}

export async function getPendingInvite(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const invites = await db
    .select()
    .from(shareInvites)
    .where(
      and(
        eq(shareInvites.ownerUserId, userId),
        eq(shareInvites.status, "pending")
      )
    )
    .limit(1);

  return invites.length > 0 ? invites[0] : null;
}

export async function revokeSharing(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Revoke any invites where user is owner or partner
  await db
    .update(shareInvites)
    .set({ status: "revoked" })
    .where(
      and(
        or(
          eq(shareInvites.ownerUserId, userId),
          eq(shareInvites.partnerUserId!, userId)
        ),
        or(
          eq(shareInvites.status, "pending"),
          eq(shareInvites.status, "accepted")
        )
      )
    );

  return { success: true };
}

// ─── Cloud Events CRUD ────────────────────────────────────────────────────────────

/**
 * Get the household ID for a user.
 * The household is the owner's userId. If the user is a partner, use the owner's userId.
 */
export async function getHouseholdId(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return userId;

  // Check if user is a partner in an accepted invite
  const asPartner = await db
    .select()
    .from(shareInvites)
    .where(
      and(
        eq(shareInvites.partnerUserId!, userId),
        eq(shareInvites.status, "accepted")
      )
    )
    .limit(1);

  if (asPartner.length > 0) {
    return asPartner[0].ownerUserId; // Use owner's ID as household
  }

  return userId; // User is the owner (or solo)
}

/** Save events to the cloud */
export async function saveCloudEvents(
  userId: number,
  householdId: number,
  events: { clientId: string; type: string; eventTimestamp: string; data: string }[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (events.length === 0) return { inserted: 0 };

  // Filter out events that already exist (by clientId)
  const clientIds = events.map((e) => e.clientId);
  const existing = await db
    .select({ clientId: babyEvents.clientId })
    .from(babyEvents)
    .where(inArray(babyEvents.clientId, clientIds));
  const existingSet = new Set(existing.map((e) => e.clientId));

  const newEvents = events.filter((e) => !existingSet.has(e.clientId));
  if (newEvents.length === 0) return { inserted: 0 };

  await db.insert(babyEvents).values(
    newEvents.map((e) => ({
      userId,
      householdId,
      clientId: e.clientId,
      type: e.type,
      eventTimestamp: e.eventTimestamp,
      data: e.data,
    }))
  );

  return { inserted: newEvents.length };
}

/** Fetch all cloud events for a household */
export async function getCloudEvents(householdId: number) {
  const db = await getDb();
  if (!db) return [];

  const events = await db
    .select()
    .from(babyEvents)
    .where(
      and(
        eq(babyEvents.householdId, householdId),
        eq(babyEvents.deleted, 0)
      )
    )
    .orderBy(desc(babyEvents.id));

  return events;
}

/** Update a cloud event */
export async function updateCloudEvent(
  eventId: number,
  householdId: number,
  updates: { type?: string; eventTimestamp?: string; data?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(babyEvents)
    .set(updates)
    .where(
      and(
        eq(babyEvents.id, eventId),
        eq(babyEvents.householdId, householdId)
      )
    );

  return { success: true };
}

/** Soft-delete a cloud event */
export async function deleteCloudEvent(eventId: number, householdId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(babyEvents)
    .set({ deleted: 1 })
    .where(
      and(
        eq(babyEvents.id, eventId),
        eq(babyEvents.householdId, householdId)
      )
    );

  return { success: true };
}

// ─── Household Shared Data CRUD ──────────────────────────────────────────────

/** Save or update household shared data (profile, growth, milestones) */
export async function saveHouseholdData(
  householdId: number,
  dataKey: string,
  dataValue: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if entry exists
  const existing = await db
    .select()
    .from(householdData)
    .where(
      and(
        eq(householdData.householdId, householdId),
        eq(householdData.dataKey, dataKey)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db
      .update(householdData)
      .set({ dataValue })
      .where(eq(householdData.id, existing[0].id));
    return { success: true, action: "updated" as const };
  } else {
    // Insert new
    await db.insert(householdData).values({
      householdId,
      dataKey,
      dataValue,
    });
    return { success: true, action: "created" as const };
  }
}

/** Get household shared data by key */
export async function getHouseholdData(
  householdId: number,
  dataKey: string
): Promise<{ dataValue: string } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(householdData)
    .where(
      and(
        eq(householdData.householdId, householdId),
        eq(householdData.dataKey, dataKey)
      )
    )
    .limit(1);

  return result.length > 0 ? { dataValue: result[0].dataValue } : null;
}

/** Delete a cloud event by clientId */
export async function deleteCloudEventByClientId(clientId: string, householdId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(babyEvents)
    .set({ deleted: 1 })
    .where(
      and(
        eq(babyEvents.clientId, clientId),
        eq(babyEvents.householdId, householdId)
      )
    );

  return { success: true };
}
