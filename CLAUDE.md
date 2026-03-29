# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev           # Run server (port 3000) + Metro bundler (port 8081) concurrently
pnpm dev:server    # Server only (tsx watch, hot reload)
pnpm dev:metro     # Metro/Expo web only
pnpm build         # Bundle server with esbuild → dist/index.js
pnpm start         # Run production server
pnpm check         # TypeScript type check (no emit)
pnpm lint          # ESLint
pnpm format        # Prettier
pnpm test          # Vitest (run all tests)
pnpm db:push       # Drizzle: generate migrations + apply to DB
```

Run a single test file:
```bash
pnpm vitest run __tests__/store.test.ts
```

Run a single test by name:
```bash
pnpm vitest run -t "test name pattern"
```

## Architecture Overview

TinyMetrics is a React Native baby tracking app (Expo 54) with a Node.js/tRPC backend. The frontend and backend share types via tRPC — no manual API contracts.

### Data flow

1. **Local-first**: All events are persisted to device via `AsyncStorage` through `lib/store.ts`. The app is fully functional offline.
2. **Cloud sync**: Events are pushed/pulled to MySQL via tRPC `events.sync` and `events.list`. Sync runs every 30 seconds and on every mutation.
3. **Household sharing**: Two accounts link via invite codes (`sharing.*` routes). Once linked, both accounts share the same `householdId` (the owner's `userId`), so their events are merged on pull.

### State management

- `lib/store.ts` — the central local state. Exports `useStore()` via `lib/store-provider.tsx`. Holds baby profile, all events, growth history, milestones, and settings. Everything writes through here first, then syncs.
- `@tanstack/react-query` + tRPC — used only for cloud operations. The tRPC client is configured in `lib/trpc.ts`.

### Key architectural patterns

**Event model**: All baby care events (feed, sleep, diaper, observation, growth, pump, formula, medication) share a single `BabyEvent` shape: `{ clientId, type, eventTimestamp, data }`. The `data` field is JSON-encoded and typed per event type in `shared/types.ts`. This same shape is used in AsyncStorage, in the DB (`baby_events` table), and in tRPC payloads.

**Household ID**: A user's `householdId` is always the invite owner's `userId`. Partners adopt the owner's ID. This is how all cloud queries scope data — `householdId` is the shared identifier, not per-user.

**Soft deletes**: Events are never physically deleted from the cloud. They get `deleted: 1` and a tombstone is synced back to all devices. The local store filters deleted events out. A daily job purges tombstones older than 30 days.

**Projections engine** (`lib/projections.ts`): Computes end-of-day forecasts by blending a 7-day weighted historical baseline with today's real-time pace. The `todayWeight` increases quadratically throughout the day (low early, high late). Poo diaper projections are capped at `max(last 7 days) + 1` to prevent illness outliers from inflating forecasts.

**AI layer** (`server/_core/llm.ts`): Single `invokeLLM()` function wraps the LLM provider. Used by three tRPC routes: `ai.chat` (conversational), `ai.analyze` (image classification for diapers/bottles), `ai.summary` (weekly/chart summaries). Context passed to the LLM is assembled in `lib/ai-context-builder.ts`, which aggregates baby profile, recent events, growth history, and age-appropriate targets.

### Directory map

```
app/               Expo Router screens (file-based routing)
  (tabs)/          5 main tabs: index, activity, trends, milestones, assistant
components/        28 UI components; log-*.tsx are event-logging bottom sheets
lib/               Client-side logic: store, projections, AI context, tRPC client
server/            Node.js backend
  routers.ts       All tRPC procedures (auth, sharing, upload, household, events, ai, growth)
  db.ts            All DB queries (Drizzle)
  storage.ts       S3-compatible file upload
  _core/           Auth, LLM, cookies, tRPC setup, Express server entry
drizzle/
  schema.ts        4 tables: users, share_invites, baby_events, household_data
  migrations/      Auto-generated SQL
shared/            Types shared between client and server
__tests__/         Vitest tests (118 tests, covering store, projections, sync, notifications)
```

### Environment variables required

```env
DATABASE_URL=mysql://...
JWT_SECRET=...
# Manus platform (auth, LLM, storage) — see server/_core/ for usage
BUILT_IN_FORGE_API_URL=...
BUILT_IN_FORGE_API_KEY=...
OAUTH_SERVER_URL=...
EXPO_PUBLIC_OAUTH_SERVER_URL=...
EXPO_PUBLIC_OAUTH_PORTAL_URL=...
```
