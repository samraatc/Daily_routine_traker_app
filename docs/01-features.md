# 01 — Feature Catalogue

> Maps to PRD section 4.
> **When to read:** At sprint planning; whenever new scope is proposed.

This is the canonical inventory of every feature module in v2.0. Each module has a priority (P0 must ship at launch; P1 stretch; P2 post-launch), an owner area of the codebase, the persona(s) it serves, and explicit acceptance criteria so engineers know when "done" is done.

---

## Priority legend

| Priority | Meaning |
|---|---|
| **P0** | Must ship in v2.0 soft launch (week 12). Blocks release. |
| **P1** | Should ship; can slip one to two weeks past soft launch if needed. |
| **P2** | Post-launch. Designed-for-but-not-built. |

---

## P0 features (launch blockers)

### Auth & Onboarding

- Email + password sign-up and sign-in
- OAuth: Google (Android + iOS) + Apple (iOS required for App Store)
- Animated 4-screen onboarding (welcome → goal selection → notification permission → first routine)
- Timezone captured automatically; user can override
- Password reset by email; account verification optional

**Done when:** A new user can sign up via any of the three methods and reach the home tab in under 90 seconds.

### Routine Tracker

- Create / edit / soft-delete tasks
- Fields: title, description, category, time, repeat days, optional linked book
- Drag-reorder within today's list
- Categories: morning, work, health, evening, study, reading, other
- Optimistic UI — task appears instantly even if the API hasn't responded

**Done when:** A user can create a 7-task routine and reorder it, with zero perceptible lag on a mid-range Android.

### Completion Engine

- Mark done / undo from the today list
- One `Completion` row per task per day
- Streak counter updates immediately on completion
- Skip option (counts toward the day without breaking the streak — see [`14-stats-engine.md`](14-stats-engine.md))

**Done when:** Marking a task done updates the daily ring and the streak flame in the same frame.

### Push Reminders

- Per-task schedule honoring user's timezone
- FCM (Android) + APNs (iOS)
- Notification payload contains a **Mark Done** action button that completes the task without opening the app
- In-app banner overlay shown when the app is in foreground
- Local fallback via Notifee so reminders fire offline
- Quiet hours (silent push only)

**Done when:** A reminder fires on time, the Mark Done action persists the completion, and there is no duplicate firing if both server push and local Notifee trigger.

### Stats & Results

- Daily progress ring (done ÷ total today)
- Weekly heatmap (7-day completion %)
- Current and best streaks
- Category breakdown
- Reading minutes (from `ReadingProgress.secondsRead`)
- Consistency rate (% of scheduled days done over 30 days)

**Done when:** Every metric in [`14-stats-engine.md`](14-stats-engine.md) renders within 200ms p95 from cache.

### 3D / Neumorphic UI

- Soft outer + inner shadows; no hard borders anywhere
- Pressed states with inner shadows + scale 0.98 + medium haptic
- Dark/light parity (every token has both values)
- High-contrast theme that swaps shadows for WCAG-AA borders

**Done when:** Every interactive surface (button, card, toggle, ring, slider, book cover) uses a `Neu*` primitive from `packages/ui`. Engineers never hand-style shadows.

### E-Book Reader — Online

- Streamed PDF and EPUB rendering via signed S3 URLs (15-minute TTL)
- Pagination with smooth swipe
- Bookmarks list (per user)
- Font size +/-, line spacing
- Light / Sepia / Night themes
- Reading position synced every 5 seconds (debounced)

**Done when:** A 400-page PDF loads first page in <3 seconds on Wi-Fi and reading position survives across sessions on multiple devices.

### E-Book Reader — Offline

- Download full file to encrypted local storage
- AES-256-GCM encryption at rest
- Per-user encryption key in Keychain (iOS) / EncryptedSharedPreferences (Android)
- Storage Manager screen with per-book size and a Remove action
- Reading position syncs to backend once online

**Done when:** Airplane mode, open downloaded book, read, mark progress, restore network → progress reflects on a second device within 60 seconds.

### User Uploads

- Upload PDF or EPUB up to 50 MB
- Pre-signed S3 upload URL
- Content-type validation client + server
- ClamAV scan post-upload
- Auto-extract title, author, page count, cover image
- Visibility defaults to **private**

**Done when:** A 50 MB PDF can be uploaded over 4G in under 2 minutes; metadata extraction completes within 30 seconds post-upload.

### Admin Panel (web + mobile)

- Dashboard: DAU/MAU, reading minutes, completion rate, pending moderation count
- User management: search, view, suspend, reset password, force-logout, role change
- Moderation queue with preview + approve/reject (templated reasons)
- Feature flags with rollout percentage + audience targeting
- Broadcast push composer with cohort filters
- Reports workflow (open → resolved/dismissed)
- Immutable audit log

**Done when:** An operator can complete every privileged action in the system without engineering involvement, and every action appears in the audit log within 1 second.

---

## P1 features (stretch)

### Scroll-Triggered Motion

Detailed in [`04-motion.md`](04-motion.md). Effects include hero scale/fade/blur, section reveal slide-up, task tile stagger, shared-element transitions, Skia page-curl in the reader.

**Done when:** All effects ship behind a `useReducedMotion()` gate; perf budget is 60fps p95 (see [`17-non-functional.md`](17-non-functional.md)).

### Public Library

- Toggle private book → `pending_review`
- Moderation review (approve / reject with reason / request edits)
- Categories + tags
- Search (Postgres FTS or Meilisearch)
- Sorting: Newest, Trending (7-day downloads), Most read
- "Recommended for your routine" surface

**Done when:** A user can publish a book, see it approved within the moderation SLA, and discover it from another account via search.

### Notifications Center

- In-app inbox listing recent reminders, broadcasts and system messages
- Unread badge on the bell icon
- Mark-as-read on tap

**Done when:** Inbox count matches `NotificationLog` count for the user and unread tracking is consistent across devices.

### Settings

- Theme switcher (light / dark / high-contrast)
- Language (i18n scaffold; English required at launch; one more locale stretch)
- Quiet hours
- Per-category mute
- GDPR data export (signed-URL JSON)
- Account deletion with full cascade

**Done when:** A user can export their data and delete their account; deletion removes or anonymises every personal record per [`13-security-privacy.md`](13-security-privacy.md).

---

## P2 features (post-launch)

### Analytics

- Anonymised usage events (screen_view, task_completed, book_opened, reading_seconds)
- Retention cohort analysis
- Admin dashboard widgets for product KPIs

**Done when:** The three product KPIs from [`00-overview.md`](00-overview.md) section 1 render on the admin dashboard, refreshed daily.

---

## Master feature matrix (sortable view)

| Module | Capabilities | Priority | Persona | Phase |
|---|---|:---:|---|:---:|
| Auth & Onboarding | Email + OAuth (Google, Apple); animated onboarding; timezone capture | P0 | All | 1 |
| Routine Tracker | Create / edit / soft-delete tasks; repeat days; time; categories; drag-reorder | P0 | Priya, Marco, Anya | 2 |
| Completion Engine | Mark done / undo; per-day record; optimistic UI; streak counter | P0 | Priya, Marco, Anya | 2 |
| Push Reminders | FCM + APNs; per-task schedule; Mark Done action; quiet hours | P0 | Priya, Marco, Anya | 3 |
| Stats & Results | Daily ring, weekly heatmap, streaks, category breakdown, trends | P0 | All | 4 |
| 3D / Neumorphic UI | Soft shadows, pressed states, depth tokens, dark/light parity | P0 | Marco | 1 |
| Scroll-Triggered Motion | Section reveals, parallax, sticky headers, hero blur on scroll | P1 | Marco | 4 |
| E-Book Reader (Online) | Stream PDF/EPUB; pagination; bookmarks; font scaling; night mode | P0 | Priya, Marco, Anya | 5 |
| E-Book Reader (Offline) | Download for offline; encrypted local cache; storage manager | P0 | Priya, Anya | 5 |
| User Uploads | Upload PDF/EPUB; cover auto-extract; private by default | P0 | Priya, Anya | 6 |
| Public Library | Toggle public; moderation review; categories; search | P1 | Marco, Anya | 6 |
| Admin Panel | Web + RN admin app; user mgmt; moderation; feature flags; broadcasts | P0 | Ravi | 7 |
| Notifications Center | In-app inbox; system push; broadcasts from admin | P1 | All | 7 |
| Settings | Theme, language, quiet hours, data export, account delete (GDPR) | P1 | All | 8 |
| Analytics | Anonymised usage events; retention; reading minutes; admin dashboard | P2 | Ravi | post |

The **Phase** column maps directly to [`16-roadmap.md`](16-roadmap.md).

---

## Acceptance-criteria pattern

For every feature in this catalogue, the engineering ticket must include:

1. **Persona served** (from above).
2. **Definition of done** (from the "Done when" line on each feature).
3. **Test coverage required** (unit + component + API + E2E where applicable — see [`18-testing-strategy.md`](18-testing-strategy.md)).
4. **Accessibility checklist** (label, focus order, reduced-motion path).
5. **Audit log entry** if it's a privileged action.

Without these five, the ticket is not ready to start.

---

## Next reading

- **Tools to build with** → [`02-tech-stack.md`](02-tech-stack.md)
- **When to build what** → [`16-roadmap.md`](16-roadmap.md)
