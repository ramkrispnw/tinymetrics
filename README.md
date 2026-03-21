# TinyMetrics

**Smart baby tracking for modern parents.** Log feeding, sleep, diapers, and health observations with AI-powered insights and partner collaboration.

---

## Overview

TinyMetrics is a mobile-first iOS app that helps new parents track their baby's daily activities and health with a focus on simplicity, speed, and intelligent analysis. Built with React Native and Expo, it combines real-time event logging, cloud sync for partner collaboration, and AI-powered summaries to give parents actionable insights into their baby's patterns.

### Key Features

- **Quick Event Logging** — One-handed UI for logging feeds, sleep, diapers, medications, observations, and milestones in seconds
- **Smart Projections** — AI-powered end-of-day predictions for feeding intake, sleep duration, and diaper counts based on historical trends and current pace
- **AI Assistant** — Ask questions about baby patterns, get personalized guidance, and receive AI-generated daily/weekly summaries
- **Image Recognition** — Upload photos of bottles or diapers for automatic intake/type classification (premium feature)
- **Partner Sync** — Real-time cloud sync for linked accounts; both parents see the same data instantly
- **Trend Analytics** — Visual charts for feeding, sleep, diapers, and growth over customizable date ranges
- **Growth Tracking** — Log weight and height over time with WHO percentile overlays
- **Milestone Logging** — Track developmental milestones with photos and notes
- **Medication Reminders** — Schedule and track medications with preset templates and custom reminders
- **Data Export** — Export all tracking data as CSV for sharing or backup

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React Native 0.81, Expo 54, TypeScript 5.9 |
| **Styling** | NativeWind 4 (Tailwind CSS for React Native) |
| **Navigation** | Expo Router 6 |
| **State** | React Context + AsyncStorage (local), tRPC + React Query (cloud) |
| **Backend** | Node.js with Express, tRPC 11.7 |
| **Database** | MySQL with Drizzle ORM |
| **AI** | Manus built-in LLM (no external API keys required) |
| **Storage** | S3-compatible file storage |
| **Auth** | Manus OAuth |
| **Testing** | Vitest 2.1 (118 tests passing) |

---

## Project Structure

```
baby_tracker/
├── app/                          # Expo Router screens
│   ├── (tabs)/                   # Tab-based navigation
│   │   ├── index.tsx             # Home screen (dashboard)
│   │   ├── activity.tsx          # Activity log with filters
│   │   ├── trends.tsx            # Charts and analytics
│   │   └── assistant.tsx         # AI assistant chat
│   ├── _layout.tsx               # Root layout with providers
│   └── oauth/                    # OAuth callback handler
├── components/
│   ├── screen-container.tsx      # SafeArea wrapper
│   ├── themed-view.tsx           # Theme-aware View
│   ├── log-*.tsx                 # Event logging modals
│   ├── markdown-text.tsx         # AI response renderer
│   ├── today-projection-card.tsx # Smart projections UI
│   └── ui/                       # Icon mappings, primitives
├── lib/
│   ├── projections.ts            # Smart projection engine
│   ├── ai-context-builder.ts     # AI context aggregation
│   ├── ai-system-prompt.ts       # AI persona & guidelines
│   ├── trpc.ts                   # tRPC client
│   └── utils.ts                  # Utilities (cn, etc.)
├── hooks/
│   ├── use-auth.ts               # Auth state
│   ├── use-colors.ts             # Theme colors
│   └── use-color-scheme.ts       # Dark/light mode
├── server/
│   ├── routers.ts                # tRPC API endpoints
│   ├── db.ts                     # Database queries
│   ├── storage.ts                # S3 helpers
│   └── _core/                    # Framework code
├── drizzle/
│   ├── schema.ts                 # Database tables
│   ├── relations.ts              # Table relationships
│   └── migrations/               # Auto-generated migrations
├── __tests__/                    # Unit and integration tests
├── assets/images/                # App icons, splash screen
├── theme.config.js               # Design tokens
├── tailwind.config.js            # Tailwind configuration
├── app.config.ts                 # Expo configuration
└── package.json                  # Dependencies
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm 9+
- Expo CLI
- iOS Simulator or physical device (for native testing)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd baby_tracker

# Install dependencies
pnpm install

# Set up database
pnpm db:push

# Start development servers
pnpm dev
```

The app will be available at:
- **Web**: http://localhost:8081
- **API**: http://localhost:3000

### Running on Device

```bash
# Generate QR code for Expo Go
pnpm qr

# Scan QR code with Expo Go app on iPhone or Android
```

---

## Core Features

### 1. Event Logging

Log seven types of events with rich metadata:

| Event Type | Data Captured | Features |
|------------|---------------|----------|
| **Feed** | Amount (ml/oz), type (breast/bottle/solid), duration, notes | Image capture for bottle reading |
| **Sleep** | Start/end time, duration, quality notes | Overnight tracking across 2 calendar days |
| **Diaper** | Type (pee/poo/both), color, consistency, size, notes | Image capture for AI classification |
| **Pump** | Amount (ml), side (left/right/both), duration, notes | Tracks milk production |
| **Formula** | Amount prepared (ml/oz), timestamp, notes | Separate from feeding logs |
| **Medication** | Name, dosage, frequency, schedule, notes | Preset templates + custom entries |
| **Observation** | Category, severity, description, photos | Health concerns (rash, fever, etc.) |
| **Milestone** | Title, category, date, photos, notes | Developmental tracking |

### 2. Smart Projections

The projection engine blends historical trends with real-time pace:

```
Projection = weighted_baseline × trend_multiplier × time_of_day_blend

- Weighted Baseline: 7-day history (D-1=30%, D-2=25%, ... D-7=3.3%)
- Trend Multiplier: 3-day avg ÷ 7-day avg, capped at ±20%
- Time-of-Day Blend: Quadratic interpolation (history early, today's pace late)
- Ceiling Cap: Poo projections capped at max(last 7 days) + 1
```

**Example**: If baby typically has 2 poos/day but had 7 yesterday (illness), projection won't exceed 3.

### 3. AI Assistant

Powered by Manus LLM with rich context:

- **Baby Profile**: Age, weight, height, birth weight, prematurity
- **Event History**: 7-day summary with all notes, observations, medications
- **Growth Trends**: Weight/height changes, WHO percentiles
- **Milestones**: Recent developmental achievements
- **Dynamic Date Ranges**: Parse user questions ("How was last week?") and fetch matching data

**Capabilities**:
- Answer questions about baby patterns
- Generate personalized feeding/sleep guidance
- Provide age-specific developmental milestones
- Analyze trends and flag anomalies
- Offer evidence-based recommendations

### 4. Cloud Sync & Partner Collaboration

- **Linked Accounts**: One parent invites the other via invite code
- **Real-Time Sync**: All events sync within 30 seconds (configurable)
- **Shared Data**: Both parents see identical event history, growth, milestones
- **User Attribution**: Each event shows who logged it
- **Push Notifications**: Optional alerts when partner logs activity

### 5. Trend Analytics

Interactive charts with customizable date ranges:

- **Feed Intake**: Daily totals (ml/oz) with trend line
- **Sleep Duration**: Hours per day with trend line
- **Diaper Counts**: Separate pee/poo charts with trend lines
- **Pump Output**: Daily milk production
- **Growth Curves**: Weight/height with WHO percentile overlays
- **Summaries**: AI-generated 2–3 line insights per chart (premium)

---

## Development

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test --watch

# Coverage
pnpm test --coverage
```

**Current Status**: 118 tests passing, 0 TypeScript errors

### Type Checking

```bash
pnpm check
```

### Linting & Formatting

```bash
pnpm lint
pnpm format
```

### Building for Production

```bash
# Build server
pnpm build

# Start production server
pnpm start
```

---

## API Reference

### tRPC Endpoints

#### Public

- `health.check()` — Server health status

#### Protected (Auth Required)

**Events**
- `events.create(data)` — Log a new event
- `events.list(dateRange?)` — Fetch events for date range
- `events.update(id, data)` — Edit an event
- `events.delete(id)` — Delete an event

**Growth**
- `growth.create(data)` — Log weight/height
- `growth.list()` — Fetch growth history
- `growth.delete(id)` — Delete growth entry

**Milestones**
- `milestones.create(data)` — Log milestone
- `milestones.list()` — Fetch milestones
- `milestones.update(id, data)` — Edit milestone
- `milestones.delete(id)` — Delete milestone

**AI**
- `ai.chat(message, context)` — Chat with AI assistant
- `ai.analyze(imageUrl)` — Analyze image (bottle/diaper)
- `ai.summary(dateRange)` — Generate summary for date range

**Accounts**
- `accounts.link(inviteCode)` — Link partner account
- `accounts.generateInviteCode()` — Create invite code
- `accounts.getLinked()` — Fetch linked household accounts

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Server
NODE_ENV=development
DATABASE_URL=mysql://user:password@localhost:3306/baby_tracker
API_PORT=3000

# Manus OAuth (provided by platform)
OAUTH_CLIENT_ID=<provided>
OAUTH_CLIENT_SECRET=<provided>

# S3 Storage (provided by platform)
S3_BUCKET=<provided>
S3_REGION=<provided>
```

### Theme Customization

Edit `theme.config.js` to customize colors:

```js
const themeColors = {
  primary: { light: '#6C63FF', dark: '#8B83FF' },
  background: { light: '#FAFBFC', dark: '#121416' },
  // ... more colors
};
```

All colors are automatically available in Tailwind and runtime via `useColors()`.

---

## Deployment

### Web Deployment

The app is deployed as a progressive web app (PWA):

```bash
# Build for web
pnpm build

# Deploy dist/ folder to hosting service
```

### Native App Deployment

For iOS/Android builds, use Expo's build service:

```bash
# Trigger build in Manus UI
# Generates .ipa (iOS) and .apk (Android)
```

---

## Known Limitations & Future Work

### Current Limitations

- Poo projections capped at `max(last 7 days) + 1` to prevent outlier inflation
- Foreground sync interval is 30 seconds (can be reduced to 10s for faster partner updates)
- "Unknown deleted:" attribution in Activity tab for some deletion events
- Wet diaper projections not yet capped (similar logic as poo)

### Planned Improvements

1. **Shorter Sync Interval** — Reduce to 10s for near-real-time partner updates
2. **Wet Diaper Ceiling** — Cap wet diaper projections like poo
3. **Better Attribution** — Fix deletion audit entries to show partner names
4. **Offline Support** — Queue events when offline, sync when connection restored
5. **Export Formats** — Add PDF and Excel export options
6. **Integrations** — Connect with pediatrician portals or health apps

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Branch**: Create a feature branch (`git checkout -b feature/your-feature`)
2. **Tests**: Add tests for new features (maintain >90% coverage)
3. **Types**: Ensure TypeScript has no errors (`pnpm check`)
4. **Commit**: Use descriptive commit messages
5. **PR**: Open a pull request with a clear description

---

## Support

For issues, feature requests, or questions:

- **GitHub Issues**: [Open an issue](https://github.com/your-repo/issues)
- **Email**: support@tinymetrics.app
- **Documentation**: See `/docs` folder for detailed guides

---

## License

TinyMetrics is proprietary software. All rights reserved.

---

## Acknowledgments

- Built with [Expo](https://expo.dev) and [React Native](https://reactnative.dev)
- AI powered by Manus LLM
- Design inspired by iOS Human Interface Guidelines
- Growth curves from WHO Child Growth Standards

---

**Made with ❤️ for new parents everywhere.**
