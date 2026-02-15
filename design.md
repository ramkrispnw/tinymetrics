# Baby Tracker — App Design

## Overview
A mobile-first iOS app for new parents to log and track baby events: feeding, sleep, diaper changes, and health observations. The app prioritizes one-handed, quick-logging UX with optional AI-powered image analysis and premium features.

---

## Screen List

### 1. Home / Dashboard (Tab 1)
- Baby name + age display at top
- Today's summary cards: total feed intake (ml/oz), diaper count (pee/poo), total sleep duration
- Quick-action buttons for logging events (large, thumb-reachable)
- Recent activity timeline (last 5-8 events)

### 2. Log Feed (Modal Sheet)
- Manual entry: amount (ml/oz), type (breast/bottle/solid), start time
- Image capture option: take photo of bottle before/after to auto-calculate intake
- Duration timer for breastfeeding
- Notes field

### 3. Log Sleep (Modal Sheet)
- Start/stop timer toggle
- Manual entry: start time, end time
- Sleep quality notes
- Quick preset durations (15m, 30m, 1h, 2h)

### 4. Log Diaper (Modal Sheet)
- Quick toggle: Pee / Poo / Both
- Color selector for poo (yellow, green, brown, black)
- Consistency selector (liquid, soft, firm)
- Image capture option: photo of diaper for AI classification
- Notes field

### 5. Log Observation (Modal Sheet)
- Category picker: Rash, Fast Breathing, Fever, Vomiting, Cough, Other
- Severity: Mild / Moderate / Severe
- Image capture option
- Notes/description field
- Timestamp

### 6. Activity Log (Tab 2)
- Chronological list of all events grouped by day
- Filter by event type (feed, sleep, diaper, observation)
- Each entry shows type icon, time, key details
- Tap to view/edit details

### 7. Trends / Dashboard (Tab 3)
- Date range selector (Today, 7 days, 30 days)
- Feed intake chart (bar chart, daily totals)
- Diaper count chart (pee vs poo per day)
- Sleep duration chart (hours per day)
- Summary statistics

### 8. Premium / AI (Tab 4)
- AI Summary: Generate daily/weekly health summary
- Ask AI: Text questions about baby's patterns
- Photo Analysis: Upload any photo for AI interpretation
- Premium gate: Free users see limited features, premium unlocks all AI

### 9. Settings (accessible from profile icon)
- Baby profile (name, birth date, photo)
- Units preference (ml/oz)
- Premium subscription status
- Theme (auto/light/dark)
- Data export

---

## Primary Content & Functionality

| Screen | Content | Functionality |
|--------|---------|---------------|
| Home | Summary cards, quick actions, timeline | Log events, view today's stats |
| Log Feed | Form with amount, type, timer | Manual entry + image capture |
| Log Sleep | Timer, manual time entry | Start/stop timer, manual log |
| Log Diaper | Toggle buttons, color/consistency | Quick categorization + photo |
| Log Observation | Category, severity, notes | Health event logging + photo |
| Activity Log | FlatList of events by day | Filter, view, edit, delete |
| Trends | Charts and statistics | Date range selection, data viz |
| Premium/AI | AI chat, summaries, photo upload | AI interactions (premium-gated) |
| Settings | Baby info, preferences | Profile management, export |

---

## Key User Flows

### Quick Feed Log
1. User taps "Feed" quick action on Home
2. Feed modal slides up
3. User enters amount or taps camera icon
4. If camera: takes photo of bottle → AI returns reading → auto-fills amount
5. User confirms and saves
6. Returns to Home with updated summary

### Quick Diaper Log
1. User taps "Diaper" quick action on Home
2. Diaper modal slides up
3. User taps Pee/Poo/Both
4. Optionally selects color/consistency or takes photo
5. If photo: AI classifies pee/poo and fills details
6. User confirms and saves

### Sleep Tracking
1. User taps "Sleep" quick action on Home
2. Sleep modal slides up with running timer
3. User taps "Start" when baby falls asleep
4. Later, user opens app and taps "Stop"
5. Duration auto-calculated and saved

### View Trends
1. User taps Trends tab
2. Sees daily feed, diaper, sleep charts
3. Swipes between date ranges
4. Taps on a day for detailed breakdown

### AI Summary (Premium)
1. User navigates to AI tab
2. Taps "Generate Summary"
3. AI analyzes recent data and produces health summary
4. User can ask follow-up questions

---

## Color Choices

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| primary | #6C63FF | #8B83FF | Main accent, buttons, active states |
| background | #FAFBFC | #121416 | Screen backgrounds |
| surface | #FFFFFF | #1C1E22 | Cards, modals |
| foreground | #1A1D21 | #F0F1F3 | Primary text |
| muted | #6B7280 | #9CA3AF | Secondary text, labels |
| border | #E5E7EB | #2D3139 | Dividers, card borders |
| success | #10B981 | #34D399 | Sleep events, positive states |
| warning | #F59E0B | #FBBF24 | Observations, alerts |
| error | #EF4444 | #F87171 | Errors, severe observations |
| feed | #3B82F6 | #60A5FA | Feed event accent |
| sleep | #8B5CF6 | #A78BFA | Sleep event accent |
| diaper | #F97316 | #FB923C | Diaper event accent |
| observation | #EC4899 | #F472B6 | Observation event accent |

---

## Data Architecture (Local-First)

All data stored locally via AsyncStorage with the following structure:
- Baby profile: name, birthDate, photo
- Events array: { id, type, timestamp, data, imageUrl?, notes? }
- Settings: units, premiumStatus, theme
- Server used only for: AI analysis (image + LLM), file storage (uploaded images)

---

## Navigation Structure

```
Tab Bar (4 tabs):
├── Home (house icon)
├── Activity (list icon) 
├── Trends (chart icon)
└── AI Assistant (sparkle icon)

Modal Sheets (presented from Home):
├── Log Feed
├── Log Sleep
├── Log Diaper
├── Log Observation
└── Settings (from header)
```
