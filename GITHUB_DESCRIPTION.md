# GitHub Repository Description

## Short Description (for GitHub repo header)

Smart baby tracking for modern parents. Log feeding, sleep, diapers & health with AI-powered insights and real-time partner sync.

---

## Full Description (for README or About section)

### TinyMetrics — Intelligent Baby Tracking for Modern Parents

**TinyMetrics** is a production-ready iOS mobile app that helps new parents track their baby's daily activities and health patterns with speed, simplicity, and AI-powered insights.

#### Core Features

🎯 **Quick Event Logging** — One-handed UI for logging feeds, sleep, diapers, medications, observations, and milestones in seconds

🤖 **Smart Projections** — AI-powered end-of-day predictions for feeding intake, sleep duration, and diaper counts based on weighted historical trends and real-time pace

💬 **AI Assistant** — Ask questions about baby patterns, get personalized guidance, and receive AI-generated daily/weekly summaries powered by Manus LLM

📸 **Image Recognition** — Upload photos of bottles or diapers for automatic intake/type classification (premium feature)

👥 **Partner Sync** — Real-time cloud sync for linked accounts; both parents see the same data instantly with user attribution

📊 **Trend Analytics** — Interactive charts for feeding, sleep, diapers, growth, and pump output over customizable date ranges with WHO percentile overlays

💊 **Medication Tracking** — Schedule medications with preset templates, custom reminders, and full audit trail

🏆 **Milestone Logging** — Track developmental milestones with photos and notes

📤 **Data Export** — Export all tracking data as CSV for sharing or backup

#### Tech Stack

- **Frontend**: React Native 0.81, Expo 54, TypeScript 5.9, NativeWind 4 (Tailwind CSS)
- **Backend**: Node.js + Express, tRPC 11.7, MySQL + Drizzle ORM
- **AI**: Manus built-in LLM (no external API keys)
- **Auth**: Manus OAuth with secure token storage
- **Storage**: S3-compatible file storage
- **Testing**: Vitest with 118 passing tests, 0 TypeScript errors

#### Key Innovations

1. **Weighted Projection Engine** — Blends 7-day historical baseline with time-of-day adjusted pace and trend multipliers to predict end-of-day metrics. Includes ceiling caps to prevent outlier days from inflating projections.

2. **Rich AI Context** — AI receives baby profile (age, weight, height), 7-day event history with all notes, growth trends, and milestones—enabling personalized, evidence-based guidance.

3. **Dynamic Date Range Detection** — AI assistant parses natural language questions ("How was last week?") and automatically fetches matching data.

4. **Overnight Sleep Accounting** — Properly splits multi-day sleep sessions across calendar boundaries without double-counting.

5. **Real-Time Partner Sync** — 30-second polling interval (configurable to 10s) ensures linked accounts see events instantly with full user attribution.

6. **Markdown Table Rendering** — AI responses with frozen first column, horizontal scroll, and proportional widths for legible data tables.

#### Project Status

✅ **Production Ready** — All core features implemented and tested
- 118 unit and integration tests passing
- 0 TypeScript errors
- Full cloud sync with partner collaboration
- AI-powered analysis and projections
- Image recognition for bottles and diapers
- Comprehensive trend analytics

#### Getting Started

```bash
# Install dependencies
pnpm install

# Set up database
pnpm db:push

# Start development
pnpm dev

# Run tests
pnpm test

# Type check
pnpm check
```

#### Project Structure

```
app/                    # Expo Router screens (Home, Activity, Trends, AI)
components/             # Reusable UI components and modals
lib/                    # Core logic (projections, AI context, tRPC)
server/                 # Backend API (tRPC endpoints, database)
drizzle/                # Database schema and migrations
__tests__/              # Unit and integration tests
```

#### Documentation

- **[README.md](./README.md)** — Full feature guide and API reference
- **[design.md](./design.md)** — UX/UI design specifications
- **[todo.md](./todo.md)** — Feature checklist and roadmap
- **[server/README.md](./server/README.md)** — Backend development guide

#### Deployment

- **Web**: Progressive web app (PWA) deployable to any static host
- **iOS/Android**: Built with Expo, generates .ipa and .apk via Manus platform

#### Known Limitations

- Poo diaper projections capped at `max(last 7 days) + 1` to prevent outlier inflation
- Foreground sync interval is 30 seconds (can be reduced to 10s)
- Wet diaper projections not yet capped (planned)

#### Future Roadmap

- Shorter sync interval (10s) for near-real-time updates
- Offline-first architecture with sync queue
- Pediatrician portal integration
- PDF and Excel export formats
- Wearable device integration (e.g., smart pacifiers)

---

## Keywords for GitHub

`baby-tracking`, `react-native`, `expo`, `typescript`, `ai-powered`, `health-tracking`, `mobile-app`, `parenting`, `cloud-sync`, `tRPC`, `real-time-sync`, `growth-tracking`, `smart-projections`, `ai-assistant`, `ios-app`

---

## Topics to Add

- `baby-tracker`
- `parenting`
- `react-native`
- `expo`
- `typescript`
- `ai`
- `health-tech`
- `mobile-app`
- `real-time-sync`
- `cloud-sync`
