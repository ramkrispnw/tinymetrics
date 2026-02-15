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

  ai: router({
    // AI Q&A endpoint
    ask: publicProcedure
      .input(
        z.object({
          question: z.string().min(1).max(2000),
          context: z.string().max(5000).optional(),
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
        let systemPrompt = `You are a helpful baby care assistant. You help new parents track and understand their baby's health patterns. 
You provide evidence-based advice about feeding, sleeping, diaper changes, and general baby health.
Always be supportive and reassuring while being accurate. If something seems concerning, recommend consulting a pediatrician.
Keep responses concise and practical. Use simple language.`;

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
              content: `You are a data extraction assistant for a baby tracking app. Parse the uploaded PDF document which contains baby care notes/logs.

Extract ALL events you can find and return them as a JSON object with an "events" array. Each event should have:
- type: one of "feed", "sleep", "diaper", "observation"
- timestamp: ISO 8601 datetime string (if only date is given, use noon of that day; if only time, use today's date)
- data: an object with type-specific fields:
  For "feed": { method: "bottle"|"breast_left"|"breast_right"|"solid", amountMl?: number, durationMin?: number, notes?: string }
  For "sleep": { startTime: ISO string, endTime?: ISO string, durationMin?: number, notes?: string }
  For "diaper": { type: "pee"|"poo"|"both", pooColor?: "yellow"|"green"|"brown"|"black"|"red", notes?: string }
  For "observation": { category: "rash"|"fast_breathing"|"fever"|"vomiting"|"cough"|"other", severity: "mild"|"moderate"|"severe", description?: string, notes?: string }

Be thorough — extract every event mentioned. If amounts are in oz, convert to ml (1 oz = ~30 ml). If times are ambiguous, make reasonable assumptions. Return valid JSON only.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Please parse all baby care events from this document and return them as structured JSON." },
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
          const events = Array.isArray(parsed.events) ? parsed.events : [];
          return {
            events,
            totalFound: events.length,
            sourceUrl: url,
          };
        } catch {
          return {
            events: [],
            totalFound: 0,
            sourceUrl: url,
            error: "Could not parse the PDF contents",
          };
        }
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
