import { eq, and, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, shareInvites } from "../drizzle/schema";
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
