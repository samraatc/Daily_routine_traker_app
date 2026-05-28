# 07 — Admin Panel & Role Model

> Maps to PRD section 10.
> **When to read:** Phase 7 (week 10). Also any time RBAC behaviour is being changed.

Operators (Persona Ravi from [`00-overview.md`](00-overview.md)) manage the platform through two surfaces: a dedicated **Next.js admin web app** and a slimmed-down **RN admin tab** inside the mobile app. Both share the same backend with fine-grained role-based access control.

This document defines roles, permissions, admin features, and the audit log. The implementation lives in `apps/admin-web` (web) and `apps/mobile/app/(admin)` (mobile tab), backed by `/api/v1/admin/*`.

---

## 1. Role model

We use five roles. Each role is a strict superset of the one above it, except for `contributor` which forks off `user`.

```
        super_admin
            │
          admin
            │
        moderator
            │
        contributor  (sibling track)
            │
          user
```

| Role | Default | How granted | Scope |
|---|---|---|---|
| `user` | ✓ | Self-signup | Use the app (routines, uploads private, read) |
| `contributor` | | Auto-promoted after 1 published book OR manually by moderator+ | Same as `user` + can request public publication |
| `moderator` | | Granted by admin+ | + Review moderation queue, suspend users, resolve reports |
| `admin` | | Granted by super_admin | + Feature flags, broadcast push, category management, quiet-hour defaults |
| `super_admin` | | Manually provisioned (no UI flow) | + Manage other admins, rotate keys, full data export/delete |

### Why `contributor` exists separately

A `user` who never publishes is still a valid app user; we don't want to clutter their account with publish-related UI. Promoting them to `contributor` after their first publish is a friction reducer, not a privilege gate. The `contributor` role itself does not grant any new write privileges over `user` — it merely marks them as having accepted the publishing terms.

---

## 2. Permission matrix

| Action | user | contributor | moderator | admin | super_admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Create / edit routines | ✓ | ✓ | ✓ | ✓ | ✓ |
| Upload book (private) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Toggle book → public | | ✓ | ✓ | ✓ | ✓ |
| Read public library | ✓ | ✓ | ✓ | ✓ | ✓ |
| Report a book | ✓ | ✓ | ✓ | ✓ | ✓ |
| Approve / reject upload | | | ✓ | ✓ | ✓ |
| Suspend user | | | ✓ | ✓ | ✓ |
| Resolve report | | | ✓ | ✓ | ✓ |
| Change user role to moderator | | | | ✓ | ✓ |
| Change user role to admin | | | | | ✓ |
| Edit feature flags | | | | ✓ | ✓ |
| Send broadcast (≤ 10k users) | | | | ✓ | ✓ |
| Send broadcast (> 10k users) | | | | requires super_admin co-sign | ✓ |
| Edit categories | | | | ✓ | ✓ |
| Rotate keys / secrets | | | | | ✓ |
| Force-delete user data | | | | | ✓ |
| View audit log | | | ✓ (own actions) | ✓ (all) | ✓ (all) |

Permissions are enforced by middleware (`requireRole('moderator')`) at the route layer in `apps/api/src/middleware/rbac.ts` AND re-checked in the service layer. Defence in depth: a buggy router must not be the only thing between a `user` and `/admin/users/:id`.

---

## 3. Admin features (detailed)

### 3.1 Dashboard

The landing page shows real-time + historical metrics:

| Widget | Source | Refresh |
|---|---|---|
| DAU / MAU | `analytics_event` aggregations | 5 min |
| Reading minutes (today, 7d, 30d) | `SUM(ReadingProgress.secondsRead)` | 5 min |
| Average routine completion | Completion ratio over scheduled tasks | 1 hour |
| Pending moderation queue depth | `COUNT(Book WHERE visibility='pending_review')` | live (WebSocket) |
| Open reports count | `COUNT(Report WHERE status='open')` | live |
| Active broadcasts | `BullMQ` jobs in flight | live |
| Crash-free sessions (mobile) | Sentry API | hourly |

Each widget links to its detail view.

### 3.2 User management

- Search by email, name, or ID
- Profile view: account info, current role, suspension state, last active, devices, recent activity (last 50 events)
- Actions: **Suspend** (sets `User.suspendedAt`; forces logout next API call), **Reset password** (sends email), **Force-logout** (revokes all refresh tokens), **Change role**

Suspended users see a "Your account has been suspended" screen with a contact email.

### 3.3 Moderation queue

See [`06-uploads-public-library.md`](06-uploads-public-library.md) section 3 for the full review UI. Quick summary:

- List view sorted by oldest-first, with severity (size, owner history) annotations.
- Detail view shows file preview, metadata, owner history, ClamAV result.
- Approve / Reject (templated reasons) / Request edits.
- Real-time updates via WebSocket — moderators see new uploads appear without refreshing.

### 3.4 Content management

- Categories: name, slug, icon, order
- Featured books carousel: drag-reorder selected books that appear on the public library landing
- "Recommended for routine" mapping: which BookCategory belongs to each Task category

### 3.5 Feature flags

A simple key/value store with rollout %:

| Field | Notes |
|---|---|
| `key` | e.g. `new_reader_ui`, `ab_onboarding_v2` |
| `enabled` | global on/off |
| `rolloutPercent` | 0-100, deterministically hashed on userId so the same user always lands the same way |
| `audience` | optional JSONB filter: `{ "minAppVersion": "2.1.0", "platforms": ["ios"] }` |

The mobile client fetches all flags at app start and on resume; results cached in MMKV. SDK exposes `useFeatureFlag('new_reader_ui')` returning a boolean.

### 3.6 Broadcast push composer

| Step | UI |
|---|---|
| 1. Audience | All users / by timezone / by role / by last-active / by has-completed-X |
| 2. Composition | Title, body, optional deep link, optional image URL |
| 3. Schedule | Send now OR pick local time per user (respect quiet hours toggle) |
| 4. Preview | Estimated audience size + preview card |
| 5. Send | Audiences > 10k require super_admin co-sign |

Each broadcast becomes a BullMQ job that fans out FCM/APNs sends in batches of 500. Progress and delivery stats appear back in the composer.

### 3.7 Reports workflow

- Status workflow: `open` → `resolved` / `dismissed`
- Bulk-select to action multiple reports at once
- Filters: reason, age, severity (auto-elevated when 3+ reports on same book)
- Resolving a report updates `Report.resolvedAt` and `Report.resolvedBy`

### 3.8 Audit log

Every privileged action writes one `AuditLog` row containing:

| Field | Example |
|---|---|
| `actorId` | the admin's user ID |
| `action` | `book.moderate.approve`, `user.suspend`, `flag.update`, ... |
| `targetType` | `Book`, `User`, `FeatureFlag`, ... |
| `targetId` | UUID of the target row |
| `diff` | JSONB of before/after for mutated fields |
| `ip` | request IP |
| `userAgent` | client UA string |
| `createdAt` | server timestamp |

The audit log is **append-only** (no UPDATE, no DELETE allowed at the DB level). Retention is 1 year minimum.

Audit view is filterable by actor, action, time range, target.

---

## 4. RN admin tab vs Next.js admin web

| Surface | Best for | Mobile | Web |
|---|---|:---:|:---:|
| Dashboard widgets | Quick check-in | ✓ | ✓ |
| Moderation queue | Mobile is fine for quick approvals | ✓ | ✓ |
| User search + suspend | Mobile is fine | ✓ | ✓ |
| Feature flags | Web only (forms are easier) | | ✓ |
| Broadcast composer | Web only | | ✓ |
| Category management | Web only | | ✓ |
| Audit log browsing | Web only (data-dense) | | ✓ |
| Reports | Both | ✓ | ✓ |

The mobile admin tab is gated by `role >= moderator`. It uses the same backend endpoints — the difference is purely UI affordance.

---

## 5. Security requirements for admin roles

| Requirement | Applied at role | How |
|---|---|---|
| **2FA mandatory** | `moderator`+ | Clerk enforces TOTP or passkey; without it, login is blocked |
| **Re-auth for sensitive actions** | `admin`+ | Suspending a user, changing a role, sending a broadcast → 5-minute fresh auth token required |
| **IP allowlist** (optional) | `super_admin` only | Configurable in DECISIONS.md if compliance requires |
| **Session lifetime** | `admin`+ have shorter refresh: 24h instead of 7d | At Clerk session config |
| **Audit log immutability** | All | DB grants: no UPDATE/DELETE on `audit_log` |
| **Least privilege** | All | Default-deny middleware; explicit allow per role |

---

## 6. Real-time events to admin clients

Over the `/ws` WebSocket connection, admin clients receive:

| Event | Payload | Used for |
|---|---|---|
| `moderation.new` | `{ bookId, ownerId }` | Update queue count |
| `moderation.decided` | `{ bookId, decision }` | Optimistic UI confirmation |
| `report.new` | `{ reportId, bookId }` | Update report count |
| `flag.updated` | `{ key }` | Force flag re-fetch in admin UI |
| `broadcast.progress` | `{ broadcastId, sent, failed, total }` | Composer progress bar |

Server-side, events are emitted from the corresponding service after the DB write commits.

---

## 7. Provisioning the first admin

There is no public sign-up flow for any role above `user`. The first `super_admin` is provisioned manually:

```bash
pnpm --filter @app/api db:exec "UPDATE \"User\" SET role='super_admin' WHERE email='founder@<domain>';"
```

This is documented in `apps/api/README.md`. All subsequent admin promotions go through the admin UI, which calls `PATCH /admin/users/:id` and writes an audit log row.

---

## 8. Test coverage required

| Test | Tool | Scope |
|---|---|---|
| RBAC middleware rejects under-privileged role | Supertest | Every `/admin/*` route |
| Audit log row written per privileged action | Supertest | Every state-changing admin endpoint |
| 2FA-required actions blocked without re-auth | Supertest | Sensitive endpoints |
| Moderator can approve, owner sees status flip | Playwright | E2E moderation flow |
| Broadcast ≤ 10k allowed for admin; > 10k requires super_admin | Supertest | Cohort sizing logic |
| Feature flag rollout % is deterministic per user | Vitest | Hash function correctness |

---

## Next reading

- **Endpoints exposed** → [`10-api-contracts.md`](10-api-contracts.md) (`/admin/*`)
- **Schema for AuditLog, FeatureFlag, Report** → [`09-database-schema.md`](09-database-schema.md)
- **Security details** → [`13-security-privacy.md`](13-security-privacy.md)
