# TinyMetrics — Product Requirements Document

**Version:** 1.0.0  
**Author:** Ram Subramonian, Product Marketing Manager  
**Date:** February 18, 2026  
**Status:** Build Complete — Ready for QA & Beta

---

## 1. Overview

TinyMetrics is a mobile-first baby tracking application designed for new parents who need a fast, reliable way to log daily infant care activities and monitor developmental progress over time. The app supports **two-parent households** through real-time account linking and cloud synchronization, ensuring both caregivers share a single, consistent view of their baby's data. An integrated AI assistant provides contextual insights tailored to the baby's age, weight, and feeding patterns.

The product targets parents of infants aged 0–24 months. It is built with Expo (React Native) and runs on iOS, Android, and mobile web. The backend uses PostgreSQL for cloud storage and a server-side LLM for AI-powered features.

---

## 2. Target Users & Key Personas

| Persona | Description | Primary Need |
|---------|-------------|--------------|
| **Primary Caregiver** | Stay-at-home parent logging events throughout the day | Quick one-tap logging with minimal friction |
| **Working Parent** | Partner who checks in remotely and logs when home | Real-time sync so they see what happened while away |
| **Shared Household** | Both parents actively co-tracking | Attribution (who logged what) and notification when partner logs |

---

## 3. Core Feature Set

### 3.1 Event Logging

TinyMetrics supports five distinct event types, each with a dedicated logging sheet accessible from the Home screen's quick-action buttons. Every event captures a timestamp (defaulting to the current device time, editable by the user), and all timestamps respect the user's local timezone for display and filtering.

| Event Type | Data Captured | Key Details |
|------------|---------------|-------------|
| **Feed** | Method (bottle / breast / solid), amount (ml or oz), duration | Breast supports left/right side selection |
| **Sleep** | Start time, end time, duration | Live timer with minimizable overlay; supports overnight tracking across calendar days |
| **Diaper** | Type (pee / poo / both), poo color, poo consistency | "Both" counts as 1 pee + 1 poo in charts |
| **Pump** | Output (ml or oz), side (left / right / both), duration | Summary card on Home screen alongside other vitals |
| **Observation** | Category, severity, free-text notes | Covers temperature, rash, medication, and general notes |

All events are editable after creation. Users can edit from both the Home screen (Today's Activity) and the Activity tab. Batch delete is supported in both views via a select mode with checkboxes.

### 3.2 Growth Tracking

Parents can log weight and height entries over time through a dedicated "Log Growth" sheet. Each entry is stored as both a growth history record and a trackable event. Profile updates to weight or height are also treated as growth events, ensuring the growth curve remains complete. The Trends tab renders weight and height charts with **WHO growth percentile overlays** so parents can see where their baby falls relative to global standards.

### 3.3 Milestone Tracker

A dedicated Milestones tab allows parents to log developmental milestones with a title, date, category (motor, social, language, cognitive), optional notes, and an optional photo. Milestones are synced across linked accounts and display user attribution.

### 3.4 Data Import

TinyMetrics supports importing historical baby logs through two methods. **PDF upload** accepts documents containing daily aggregated data (date, total intake, wet/poo counts) and uses server-side AI to parse and expand them into individual events. **Image-based import** allows parents to photograph handwritten logs or hospital printouts, which the AI parses into structured events. All imported data appears in Trends charts with proper unit conversion.

### 3.5 Trends & Analytics

The Trends tab provides time-series visualizations for all tracked metrics. Each chart includes trend lines and clickable data labels. A metric/imperial toggle allows users to switch units, and all readings are converted to the selected system in real time.

| Chart | What It Shows |
|-------|---------------|
| Feed intake | Daily total volume (ml or oz) over time |
| Sleep duration | Daily total sleep (hours) over time |
| Pee diapers | Daily count over time |
| Poo diapers | Daily count over time |
| Pump output | Daily total volume (ml or oz) over time |
| Weight curve | Weight over time with WHO percentile overlay |
| Height curve | Height over time with WHO percentile overlay |

Each chart includes an AI-generated 2–3 line summary beneath it (available as a premium feature) that highlights notable patterns or changes.

### 3.6 AI Assistant

The AI tab provides a conversational interface where parents can ask questions about their baby's health, feeding patterns, and development. The assistant receives the full baby context — profile (name, DOB, weight, height), recent events, growth history, and pump data — to deliver personalized, age-appropriate responses. Responses are rendered with rich formatting including bullets, tables, and emojis. AI image analysis supports bottle-level reading from photos and diaper classification.

### 3.7 Weekly Digest

Accessible from Settings, the weekly digest generates an AI-powered summary of the past week's activity, highlighting feeding totals, sleep patterns, diaper counts, and any notable observations. This gives parents a quick snapshot without needing to review individual charts.

---

## 4. Multi-User & Sync Architecture

### 4.1 Account Linking

TinyMetrics uses an invite-code model for account linking. The primary account holder generates a unique code from Settings, which the second parent enters to join the household. Once linked, both accounts share a unified dataset — all events, growth entries, milestones, and the baby profile (including photo) are visible to both users.

### 4.2 Real-Time Synchronization

Sync operates on three layers. **Immediate push** occurs the moment any event is created, edited, or deleted — the change is pushed to the cloud database instantly. **Periodic polling** runs every 30 seconds in the background, pulling any new data from the partner's account. **Manual sync** is available via a "Sync Now" button at the top of the Home screen, which displays the last-synced timestamp for transparency.

### 4.3 User Attribution

Every event, growth entry, and milestone records which user logged it (`loggedBy` and `loggedByName` fields). The UI displays "Logged by You" or the partner's name in italics beneath each entry on the Home, Activity, and Milestones screens. This attribution is preserved through cloud sync and data import.

### 4.4 Notification Settings

A dedicated Notifications section in Settings provides two independent toggles. **Partner Activity** controls whether the user receives a local push notification when their linked partner logs any activity. **Feed Reminders** controls the configurable feeding interval alerts. Disabling feed reminders also hides the reminder interval picker from the settings UI.

---

## 5. Authentication & Platform

Authentication is handled via **Google OAuth**, providing a frictionless sign-in experience. The app stores session cookies for persistent login across sessions. The app runs on iOS (iPhone and iPad), Android, and mobile web (optimized as a PWA with appropriate meta tags and viewport configuration).

---

## 6. Settings & Configuration

| Setting | Options | Default |
|---------|---------|---------|
| Baby profile | Name, DOB, gender, photo, weight, height | Empty (setup prompt on first launch) |
| Units | Metric (ml, kg, cm) / Imperial (oz, lbs, in) | Metric |
| Feed reminder interval | 1–6 hours (configurable) | Off |
| Partner activity notifications | On / Off | On |
| Feed reminder notifications | On / Off | On |
| Data export | CSV via system share sheet | — |
| Account linking | Generate / enter invite code | Unlinked |

---

## 7. Information Architecture

The app is organized into five primary tabs, each serving a distinct purpose in the parent's workflow.

| Tab | Purpose | Key Components |
|-----|---------|----------------|
| **Home** | Dashboard and quick logging | Summary cards (feed, diapers, sleep, pump), quick-action buttons, Sync Now, Today's Activity list |
| **Activity** | Full event history with filtering | Date range filters (Today, Yesterday, Week, 3 Months, Custom), event type filters, batch select/delete |
| **Trends** | Visual analytics | 7 chart types with trend lines, WHO percentiles, unit toggle, AI summaries |
| **Milestones** | Developmental tracking | Category-filtered milestone list with photos, add milestone sheet |
| **AI** | Conversational assistant | Chat interface with rich formatting, image analysis, context-aware responses |

---

## 8. Non-Functional Requirements

**Performance.** Event logging must complete in under 200ms locally. Cloud sync should not block the UI — all network operations run in the background. The periodic polling interval of 30 seconds balances freshness against battery consumption.

**Offline Support.** All data is persisted locally via AsyncStorage. The app remains fully functional without network connectivity; events queue locally and sync when connectivity resumes.

**Privacy.** Baby data is stored per-household in a PostgreSQL database. No data is shared outside the linked household. AI processing uses the server's built-in LLM — no third-party API keys are required from users.

**Accessibility.** The app follows Apple Human Interface Guidelines for touch targets, contrast ratios, and one-handed usability. Filter labels use high-contrast foreground colors with bold weight for readability.

---

## 9. Known Limitations & Future Considerations

The current build represents a feature-complete v1.0. The following items are identified as potential enhancements for subsequent releases:

1. **Server-sent events or WebSocket sync** — Replace 30-second polling with push-based real-time updates for lower latency and reduced battery usage.
2. **Conflict resolution UI** — When both parents edit the same event simultaneously, surface a merge dialog rather than last-write-wins.
3. **Caregiver roles beyond two parents** — Support for nannies, grandparents, or daycare providers with configurable permissions.
4. **Export to pediatrician** — Generate a formatted PDF report suitable for sharing at well-baby visits.
5. **Apple Health / Google Fit integration** — Sync sleep and feeding data with platform health ecosystems.
