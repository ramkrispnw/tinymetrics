import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { protectedProcedure } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  sharing: router({
    // Generate an invite code for the current user
    createInvite: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await db.createInvite(ctx.user.id);
      return { code: result.code };
    }),

    // Accept an invite code from a partner
    acceptInvite: protectedProcedure
      .input(z.object({ code: z.string().min(4).max(10) }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.acceptInvite(input.code, ctx.user.id);
        return result;
      }),

    // Get current partner info
    getPartner: protectedProcedure.query(async ({ ctx }) => {
      const partner = await db.getPartnerInfo(ctx.user.id);
      return partner;
    }),

    // Get pending invite code
    getPendingInvite: protectedProcedure.query(async ({ ctx }) => {
      const invite = await db.getPendingInvite(ctx.user.id);
      return invite ? { code: invite.code } : null;
    }),

    // Revoke sharing
    revokeSharing: protectedProcedure.mutation(async ({ ctx }) => {
      return db.revokeSharing(ctx.user.id);
    }),
  }),

  // Household shared data (profile, growth, milestones)
  // Photo upload to S3
  upload: router({
    photo: protectedProcedure
      .input(
        z.object({
          base64: z.string().max(5000000), // base64-encoded image data
          mimeType: z.string().default("image/jpeg"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.mimeType === "image/png" ? "png" : "jpg";
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const fileKey = `baby-photos/${ctx.user.id}-${Date.now()}-${randomSuffix}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        return { url };
      }),
  }),

  household: router({
    // Sync baby profile to cloud (shared across linked accounts)
    syncProfile: protectedProcedure
      .input(
        z.object({
          profile: z.string().max(10000), // JSON-encoded BabyProfile
        })
      )
      .mutation(async ({ ctx, input }) => {
        const householdId = await db.getHouseholdId(ctx.user.id);
        return db.saveHouseholdData(householdId, "profile", input.profile);
      }),

    // Get baby profile from cloud
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      const householdId = await db.getHouseholdId(ctx.user.id);
      return db.getHouseholdData(householdId, "profile");
    }),

    // Sync growth history to cloud
    syncGrowth: protectedProcedure
      .input(
        z.object({
          growthHistory: z.string().max(100000), // JSON-encoded GrowthEntry[]
        })
      )
      .mutation(async ({ ctx, input }) => {
        const householdId = await db.getHouseholdId(ctx.user.id);
        return db.saveHouseholdData(householdId, "growthHistory", input.growthHistory);
      }),

    // Get growth history from cloud
    getGrowth: protectedProcedure.query(async ({ ctx }) => {
      const householdId = await db.getHouseholdId(ctx.user.id);
      return db.getHouseholdData(householdId, "growthHistory");
    }),

    // Sync milestones to cloud
    syncMilestones: protectedProcedure
      .input(
        z.object({
          milestones: z.string().max(100000), // JSON-encoded Milestone[]
        })
      )
      .mutation(async ({ ctx, input }) => {
        const householdId = await db.getHouseholdId(ctx.user.id);
        return db.saveHouseholdData(householdId, "milestones", input.milestones);
      }),

    // Get milestones from cloud
    getMilestones: protectedProcedure.query(async ({ ctx }) => {
      const householdId = await db.getHouseholdId(ctx.user.id);
      return db.getHouseholdData(householdId, "milestones");
    }),
  }),

  events: router({
    // Sync events to cloud
    sync: protectedProcedure
      .input(
        z.object({
          events: z.array(
            z.object({
              clientId: z.string(),
              type: z.string(),
              eventTimestamp: z.string(),
              data: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const householdId = await db.getHouseholdId(ctx.user.id);
        const result = await db.saveCloudEvents(ctx.user.id, householdId, input.events);
        return result;
      }),

    // Fetch all events for the household
    list: protectedProcedure.query(async ({ ctx }) => {
      const householdId = await db.getHouseholdId(ctx.user.id);
      const events = await db.getCloudEvents(householdId);
      return events.map((e) => ({
        id: e.id,
        clientId: e.clientId,
        type: e.type,
        eventTimestamp: e.eventTimestamp,
        data: e.data,
        userId: e.userId,
        createdAt: e.createdAt,
      }));
    }),

    // Update an event
    update: protectedProcedure
      .input(
        z.object({
          clientId: z.string(),
          type: z.string().optional(),
          eventTimestamp: z.string().optional(),
          data: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const householdId = await db.getHouseholdId(ctx.user.id);
        // Find the event by clientId
        const allEvents = await db.getCloudEvents(householdId);
        const event = allEvents.find((e) => e.clientId === input.clientId);
        if (!event) return { success: false, error: "Event not found" };
        const updates: any = {};
        if (input.type) updates.type = input.type;
        if (input.eventTimestamp) updates.eventTimestamp = input.eventTimestamp;
        if (input.data) updates.data = input.data;
        return db.updateCloudEvent(event.id, householdId, updates);
      }),

    // Delete an event
    delete: protectedProcedure
      .input(z.object({ clientId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const householdId = await db.getHouseholdId(ctx.user.id);
        return db.deleteCloudEventByClientId(input.clientId, householdId);
      }),

    // List all deleted event clientIds for the household (used by partner devices to purge locally)
    listDeleted: protectedProcedure.query(async ({ ctx }) => {
      const householdId = await db.getHouseholdId(ctx.user.id);
      return db.getDeletedEventClientIds(householdId);
    }),
  }),

  ai: router({
    // AI Q&A endpoint
    ask: publicProcedure
      .input(
        z.object({
          question: z.string().min(1).max(2000),
          context: z.string().max(20000).optional(),
          babyProfile: z.object({
            name: z.string().optional(),
            ageLabel: z.string().optional(),
            weight: z.number().optional(),
            weightUnit: z.string().optional(),
            height: z.number().optional(),
            heightUnit: z.string().optional(),
          }).optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Import baby coacher system prompt
        const { getBabyCoachSystemPrompt } = await import("../lib/ai-system-prompt");
        
        let systemPrompt = getBabyCoachSystemPrompt(input.babyProfile?.ageLabel || "Unknown age") || "";
        
        // Add formatting rules
        systemPrompt = systemPrompt + `\n\nFORMATTING RULES (ALWAYS follow these):
- Use **bold** for key terms, numbers, and important points
- Use emojis to make responses friendly and scannable (🍼 feeding, 😴 sleep, 🧷 diapers, 📊 trends, ⚠️ concerns, ✅ good, 💡 tips)
- Use bullet points (- ) for lists
- Use numbered lists (1. 2. 3.) for step-by-step instructions
- Use markdown tables (| Header | Header |) when comparing data or showing schedules
- Use ## headers to organize sections in longer responses
- Keep paragraphs short (2-3 sentences max)
- Always start with a brief direct answer, then elaborate with details
- End with a 💡 tip or reassuring note when appropriate`;

        if (input.babyProfile) {
          const bp = input.babyProfile;
          const profileParts: string[] = [];
          if (bp.name) profileParts.push(`Name: ${bp.name}`);
          if (bp.ageLabel) profileParts.push(`Age: ${bp.ageLabel}`);
          if (bp.weight != null) profileParts.push(`Weight: ${bp.weight} ${bp.weightUnit || "kg"}`);
          if (bp.height != null) profileParts.push(`Height: ${bp.height} ${bp.heightUnit || "cm"}`);
          if (profileParts.length > 0) {
            systemPrompt += `\n\nBaby profile information:\n${profileParts.join("\n")}\n\nTailor your advice to this baby's specific age, weight, and height. Reference age-appropriate milestones, feeding amounts, and sleep patterns. If weight or height seems outside normal ranges for the age, gently mention it.`;
          }
        }

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: input.context
                ? `Context about my baby:\n${input.context}\n\nQuestion: ${input.question}`
                : input.question,
            },
          ],
        });
        const rawAnswer = response?.choices?.[0]?.message?.content;
        const answer = typeof rawAnswer === "string" ? rawAnswer : "I'm sorry, I couldn't generate a response.";
        return { answer };
      }),

    // Image analysis for bottles (before/after feed)
    analyzeBottle: publicProcedure
      .input(
        z.object({
          imageBase64: z.string(),
          mimeType: z.string().default("image/jpeg"),
        })
      )
      .mutation(async ({ input }) => {
        // Upload to S3 first
        const buffer = Buffer.from(input.imageBase64, "base64");
        const key = `bottle-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { url } = await storagePut(key, buffer, input.mimeType);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an image analysis assistant for a baby tracking app. 
Analyze the baby bottle image and determine the milk/formula level based on the markings on the bottle.
Return a JSON response with:
- amountMl: estimated amount in milliliters (number)
- confidence: "high", "medium", or "low"
- description: brief description of what you see`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Analyze this baby bottle image and tell me the amount of milk/formula visible based on the bottle markings." },
                { type: "image_url", image_url: { url, detail: "high" } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        });

        try {
          const rawContent = response?.choices?.[0]?.message?.content;
          const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent) || "{}";
          const parsed = JSON.parse(content);
          return {
            amountMl: parsed.amountMl || 0,
            confidence: parsed.confidence || "low",
            description: parsed.description || "Could not analyze the image",
            imageUrl: url,
          };
        } catch {
          return {
            amountMl: 0,
            confidence: "low" as const,
            description: "Could not parse the analysis result",
            imageUrl: url,
          };
        }
      }),

    // Image analysis for diapers
    analyzeDiaper: publicProcedure
      .input(
        z.object({
          imageBase64: z.string(),
          mimeType: z.string().default("image/jpeg"),
        })
      )
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.imageBase64, "base64");
        const key = `diaper-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { url } = await storagePut(key, buffer, input.mimeType);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an image analysis assistant for a baby tracking app.
Analyze the diaper image and classify it.
Return a JSON response with:
- type: "pee", "poo", or "both"
- pooColor: if poo is present, one of "yellow", "green", "brown", "black", "red" (or null)
- pooConsistency: if poo is present, one of "liquid", "soft", "firm", "hard" (or null)
- confidence: "high", "medium", or "low"
- description: brief description of what you observe`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Analyze this diaper image and classify the contents." },
                { type: "image_url", image_url: { url, detail: "high" } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        });

        try {
          const rawContent2 = response?.choices?.[0]?.message?.content;
          const content = typeof rawContent2 === "string" ? rawContent2 : JSON.stringify(rawContent2) || "{}";
          const parsed = JSON.parse(content);
          return {
            type: parsed.type || "pee",
            pooColor: parsed.pooColor || null,
            pooConsistency: parsed.pooConsistency || null,
            confidence: parsed.confidence || "low",
            description: parsed.description || "Could not analyze the image",
            imageUrl: url,
          };
        } catch {
          return {
            type: "pee" as const,
            pooColor: null,
            pooConsistency: null,
            confidence: "low" as const,
            description: "Could not parse the analysis result",
            imageUrl: url,
          };
        }
      }),

    // Parse PDF with prior baby logs and extract events
    parsePdfLogs: publicProcedure
      .input(
        z.object({
          fileBase64: z.string(),
          mimeType: z.string().default("application/pdf"),
          fileName: z.string().default("notes.pdf"),
        })
      )
      .mutation(async ({ input }) => {
        // Upload PDF to S3 first
        const buffer = Buffer.from(input.fileBase64, "base64");
        const key = `pdf-imports/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
        const { url } = await storagePut(key, buffer, input.mimeType);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a data extraction assistant for a baby tracking app. Parse the uploaded document which contains baby care notes/logs.

The document likely contains daily aggregated data with columns like: date, daily intake (ml or oz), number of wet diapers (pee), number of poo diapers, and possibly sleep duration or observations.

Extract each row/day and return a JSON object with a "daily_rows" array. Each row should have:
- date: the date in YYYY-MM-DD format
- intakeMl: total daily feed intake in milliliters (number). If the value is in oz, convert to ml (1 oz = ~30 ml). If not available, use 0.
- wetDiapers: number of wet/pee diapers that day (number). If not available, use 0.
- pooDiapers: number of poo diapers that day (number). If not available, use 0.
- sleepMin: total sleep in minutes for the day (number, optional). If not available, omit or use 0.
- notes: any extra observations or notes for that day (string, optional).

Be thorough — extract every day/row mentioned. If amounts are in oz, convert to ml (1 oz ≈ 30 ml). If dates use formats like "Jan 5" or "1/5/2026", convert to YYYY-MM-DD. Return valid JSON only.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Please parse all daily baby care data from this document and return them as structured JSON with a daily_rows array." },
                { type: "file_url", file_url: { url, mime_type: "application/pdf" } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        });

        try {
          const rawContent = response?.choices?.[0]?.message?.content;
          const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent) || "{}";
          const parsed = JSON.parse(content);
          const dailyRows = Array.isArray(parsed.daily_rows) ? parsed.daily_rows : [];

          // Expand daily aggregated rows into individual events
          const events: any[] = [];
          for (const row of dailyRows) {
            const date = row.date || new Date().toISOString().split("T")[0];
            const noonTimestamp = `${date}T12:00:00.000Z`;

            // One feed event per day for the total intake
            const intakeMl = typeof row.intakeMl === "number" ? row.intakeMl : Number(row.intakeMl) || 0;
            if (intakeMl > 0) {
              events.push({
                type: "feed",
                timestamp: noonTimestamp,
                data: {
                  method: "bottle",
                  amountMl: intakeMl,
                  notes: `Imported daily total for ${date}`,
                },
              });
            }

            // Individual pee diaper events
            const wetCount = typeof row.wetDiapers === "number" ? row.wetDiapers : Number(row.wetDiapers) || 0;
            for (let i = 0; i < wetCount; i++) {
              // Spread events across the day (every ~2 hours starting at 6am)
              const hour = 6 + Math.floor((i * 12) / Math.max(wetCount, 1));
              const ts = `${date}T${String(hour).padStart(2, "0")}:${String(i * 5 % 60).padStart(2, "0")}:00.000Z`;
              events.push({
                type: "diaper",
                timestamp: ts,
                data: {
                  type: "pee",
                  notes: `Imported for ${date}`,
                },
              });
            }

            // Individual poo diaper events
            const pooCount = typeof row.pooDiapers === "number" ? row.pooDiapers : Number(row.pooDiapers) || 0;
            for (let i = 0; i < pooCount; i++) {
              const hour = 8 + Math.floor((i * 10) / Math.max(pooCount, 1));
              const ts = `${date}T${String(hour).padStart(2, "0")}:${String(30 + i * 5 % 30).padStart(2, "0")}:00.000Z`;
              events.push({
                type: "diaper",
                timestamp: ts,
                data: {
                  type: "poo",
                  notes: `Imported for ${date}`,
                },
              });
            }

            // Optional sleep event
            const sleepMin = typeof row.sleepMin === "number" ? row.sleepMin : Number(row.sleepMin) || 0;
            if (sleepMin > 0) {
              events.push({
                type: "sleep",
                timestamp: `${date}T20:00:00.000Z`,
                data: {
                  startTime: `${date}T20:00:00.000Z`,
                  durationMin: sleepMin,
                  notes: `Imported daily total for ${date}`,
                },
              });
            }

            // Optional observation from notes
            if (row.notes && row.notes.trim()) {
              events.push({
                type: "observation",
                timestamp: noonTimestamp,
                data: {
                  category: "other",
                  severity: "mild",
                  description: row.notes.trim(),
                  notes: `Imported for ${date}`,
                },
              });
            }
          }

          return {
            events,
            totalFound: events.length,
            dailyRowCount: dailyRows.length,
            sourceUrl: url,
          };
        } catch {
          return {
            events: [],
            totalFound: 0,
            dailyRowCount: 0,
            sourceUrl: url,
            error: "Could not parse the PDF contents",
          };
        }
      }),

    // Parse images (screenshots, photos of notes) for baby log data
    parseImageLogs: publicProcedure
      .input(
        z.object({
          imageBase64: z.string(),
          mimeType: z.string().default("image/jpeg"),
        })
      )
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.imageBase64, "base64");
        const key = `image-imports/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { url } = await storagePut(key, buffer, input.mimeType);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a data extraction assistant for a baby tracking app. The user has uploaded a photo that contains baby care notes or logs. This could be a screenshot from Apple Notes, a photo of handwritten notes, or any image with baby tracking data.\n\nExtract the data and return a JSON object with a "daily_rows" array. Each row should have:\n- date: the date in YYYY-MM-DD format (infer the year if not shown, use 2025 or 2026 as reasonable)\n- intakeMl: total daily feed intake in milliliters (number). If in oz, convert to ml (1 oz = ~30 ml). If not available, use 0.\n- wetDiapers: number of wet/pee diapers that day (number). If not available, use 0.\n- pooDiapers: number of poo diapers that day (number). If not available, use 0.\n- sleepMin: total sleep in minutes for the day (number, optional). If not available, use 0.\n- notes: any extra observations or notes for that day (string, optional).\n\nRead dates, times, and details carefully from the image. Be thorough — extract every day/row visible. Return valid JSON only.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Please parse all baby care data from this image and return them as structured JSON with a daily_rows array." },
                { type: "image_url", image_url: { url } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        });

        try {
          const rawContent = response?.choices?.[0]?.message?.content;
          const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent) || "{}";
          const parsed = JSON.parse(content);
          const dailyRows = Array.isArray(parsed.daily_rows) ? parsed.daily_rows : [];

          const events: any[] = [];
          for (const row of dailyRows) {
            const date = row.date || new Date().toISOString().split("T")[0];
            const noonTimestamp = `${date}T12:00:00.000Z`;

            const intakeMl = typeof row.intakeMl === "number" ? row.intakeMl : Number(row.intakeMl) || 0;
            if (intakeMl > 0) {
              events.push({
                type: "feed",
                timestamp: noonTimestamp,
                data: { method: "bottle", amountMl: intakeMl, notes: `Imported from image for ${date}` },
              });
            }

            const wetCount = typeof row.wetDiapers === "number" ? row.wetDiapers : Number(row.wetDiapers) || 0;
            for (let i = 0; i < wetCount; i++) {
              const hour = 6 + Math.floor((i * 12) / Math.max(wetCount, 1));
              const ts = `${date}T${String(hour).padStart(2, "0")}:${String(i * 5 % 60).padStart(2, "0")}:00.000Z`;
              events.push({
                type: "diaper",
                timestamp: ts,
                data: { type: "pee", notes: `Imported from image for ${date}` },
              });
            }

            const pooCount = typeof row.pooDiapers === "number" ? row.pooDiapers : Number(row.pooDiapers) || 0;
            for (let i = 0; i < pooCount; i++) {
              const hour = 8 + Math.floor((i * 10) / Math.max(pooCount, 1));
              const ts = `${date}T${String(hour).padStart(2, "0")}:${String(30 + i * 5 % 30).padStart(2, "0")}:00.000Z`;
              events.push({
                type: "diaper",
                timestamp: ts,
                data: { type: "poo", pooColor: "yellow", notes: `Imported from image for ${date}` },
              });
            }

            const sleepMin = typeof row.sleepMin === "number" ? row.sleepMin : Number(row.sleepMin) || 0;
            if (sleepMin > 0) {
              events.push({
                type: "sleep",
                timestamp: `${date}T20:00:00.000Z`,
                data: { startTime: `${date}T20:00:00.000Z`, durationMin: sleepMin, notes: `Imported from image for ${date}` },
              });
            }

            if (row.notes && row.notes.trim()) {
              events.push({
                type: "observation",
                timestamp: noonTimestamp,
                data: { category: "other", severity: "mild", description: row.notes.trim(), notes: `Imported from image for ${date}` },
              });
            }
          }

          return { events, totalFound: events.length, dailyRowCount: dailyRows.length };
        } catch {
          return { events: [], totalFound: 0, dailyRowCount: 0, error: "Could not parse the image contents" };
        }
      }),

    // Weekly digest summary
    weeklyDigest: publicProcedure
      .input(
        z.object({
          eventsJson: z.string().max(50000),
          babyProfile: z.object({
            name: z.string().optional(),
            ageLabel: z.string().optional(),
            weight: z.number().optional(),
            weightUnit: z.string().optional(),
            height: z.number().optional(),
            heightUnit: z.string().optional(),
          }).optional(),
        })
      )
      .mutation(async ({ input }) => {
        let systemPrompt = `You are a baby care assistant generating a weekly digest summary for parents.
Analyze the provided baby care events from the past week and create a comprehensive but concise summary.
Include:
1. Feeding summary (total feeds, average intake, any patterns)
2. Sleep summary (total sleep, average naps, longest stretch)
3. Diaper summary (total changes, pee/poo ratio)
4. Any observations or concerns noted
5. Encouraging note for the parents
6. Any recommendations based on the patterns

Format the response as a well-structured summary with clear sections. Keep it warm and supportive.`;

        if (input.babyProfile) {
          const bp = input.babyProfile;
          const parts: string[] = [];
          if (bp.name) parts.push(`Name: ${bp.name}`);
          if (bp.ageLabel) parts.push(`Age: ${bp.ageLabel}`);
          if (bp.weight != null) parts.push(`Weight: ${bp.weight} ${bp.weightUnit || "kg"}`);
          if (bp.height != null) parts.push(`Height: ${bp.height} ${bp.heightUnit || "cm"}`);
          if (parts.length > 0) {
            systemPrompt += `\n\nBaby profile:\n${parts.join("\n")}`;
          }
        }

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Here are the baby care events from the past week:\n${input.eventsJson}\n\nPlease generate a weekly digest summary.` },
          ],
        });
        const raw = response?.choices?.[0]?.message?.content;
        const summary = typeof raw === "string" ? raw : "Could not generate weekly digest.";
        return { summary };
      }),

    // Chart summary - short AI insight for a specific chart
    chartSummary: publicProcedure
      .input(
        z.object({
          chartType: z.string(),
          dataJson: z.string().max(10000),
          babyProfile: z.object({
            name: z.string().optional(),
            ageLabel: z.string().optional(),
          }).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const babyName = input.babyProfile?.name || "your baby";
        const ageLabel = input.babyProfile?.ageLabel || "";
        const ageContext = ageLabel ? ` (${ageLabel} old)` : "";

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a baby care data analyst. Given chart data for a baby tracker app, write a 2-3 sentence insight summary. Be specific with numbers. Be warm and supportive. Do not use markdown formatting. Baby: ${babyName}${ageContext}.`,
            },
            {
              role: "user",
              content: `Chart type: ${input.chartType}\nData: ${input.dataJson}\n\nWrite a brief 2-3 sentence insight.`,
            },
          ],
        });
        const raw = response?.choices?.[0]?.message?.content;
        const insight = typeof raw === "string" ? raw : "";
        return { insight };
      }),

    // General photo analysis (premium)
    analyzePhoto: publicProcedure
      .input(
        z.object({
          imageBase64: z.string(),
          mimeType: z.string().default("image/jpeg"),
          question: z.string().max(1000).optional(),
          babyProfile: z.object({
            name: z.string().optional(),
            ageLabel: z.string().optional(),
            weight: z.number().optional(),
            weightUnit: z.string().optional(),
            height: z.number().optional(),
            heightUnit: z.string().optional(),
          }).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.imageBase64, "base64");
        const key = `photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { url } = await storagePut(key, buffer, input.mimeType);

        let systemPrompt = `You are a helpful baby care assistant with image analysis capabilities.
Analyze the uploaded image in the context of baby health and care.
Provide helpful, accurate observations. If you notice anything concerning, recommend consulting a pediatrician.`;

        if (input.babyProfile) {
          const bp = input.babyProfile;
          const profileParts: string[] = [];
          if (bp.name) profileParts.push(`Name: ${bp.name}`);
          if (bp.ageLabel) profileParts.push(`Age: ${bp.ageLabel}`);
          if (bp.weight != null) profileParts.push(`Weight: ${bp.weight} ${bp.weightUnit || "kg"}`);
          if (bp.height != null) profileParts.push(`Height: ${bp.height} ${bp.heightUnit || "cm"}`);
          if (profileParts.length > 0) {
            systemPrompt += `\n\nBaby profile information:\n${profileParts.join("\n")}\n\nTailor your analysis and advice to this baby's specific age, weight, and size.`;
          }
        }

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: input.question || "Please analyze this image and provide any relevant observations about my baby's health or care.",
                },
                { type: "image_url", image_url: { url, detail: "high" } },
              ],
            },
          ],
        });

        const rawPhotoAnswer = response?.choices?.[0]?.message?.content;
        const answer = typeof rawPhotoAnswer === "string" ? rawPhotoAnswer : "I couldn't analyze the image.";
        return { answer, imageUrl: url };
      }),
  }),
});

export type AppRouter = typeof appRouter;
