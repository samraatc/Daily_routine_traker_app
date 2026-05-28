# 09 — Database Schema

> Maps to PRD section 12. Companion to [`../schema/schema.prisma`](../schema/schema.prisma).
> **When to read:** Phase 1 (week 1) before the first migration; whenever a new feature changes the data shape.

The canonical schema is the Prisma file. This document explains *why* each table exists, how the tables relate, and the conventions every model follows.

---

## 1. Schema conventions

| Convention | Applies to | Why |
|---|---|---|
| UUID primary keys (`gen_random_uuid()`) | every table | Globally unique; safe to expose; no sequential leaks |
| `userId` on every user-owned table | Task, Completion, Book, ReadingProgress, BookDownload, Bookmark, Report, NotificationLog, DeviceToken | Every query must scope by `userId` (see [`13-security-privacy.md`](13-security-privacy.md)) |
| Soft delete via `deletedAt` | Task, Book | Allows undo + GDPR-safe purge later |
| `createdAt` / `updatedAt` | most tables | Audit + cache-busting |
| ENUM columns | role, category, format, visibility, etc. | Type safety + constraint at DB layer |
| Append-only `AuditLog` | AuditLog | DB-level grants block UPDATE/DELETE |
| Idempotency unique constraint | `Completion(taskId, userId, completedAt)` | Mark Done can't double-count |

---

## 2. Entity-relationship overview

```
                       ┌──────────┐
                       │   User   │
                       └────┬─────┘
                            │ 1
       ┌────────┬───────────┼────────────┬─────────────┬───────────┐
       │        │           │            │             │           │
       ▼ M      ▼ M         ▼ 1          ▼ M           ▼ M         ▼ M
   ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐  ┌─────────┐  ┌──────────┐
   │  Task  │ │Completion│ │ Streak │ │  Book  │  │Bookmark │  │  Report  │
   └───┬────┘ └────┬─────┘ └────────┘ └───┬────┘  └─────────┘  └──────────┘
       │           │                      │
       │ linked    │ task →               │
       ▼           ▼                      ▼
       Book ◄──────┘ (one-to-one          BookCategory
                     per day idempotent)
                                          │ N
                                          ▼
                                  ReadingProgress  BookDownload

   ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
   │ FeatureFlag  │    │ DeviceToken  │    │ NotificationLog  │
   └──────────────┘    └──────────────┘    └──────────────────┘
   (no user FK)        (per-user)          (per-user)

                       ┌──────────────┐
                       │   AuditLog   │   (append-only)
                       └──────────────┘
```

The full Mermaid version lives in [`../diagrams/data-model.mmd`](../diagrams/data-model.mmd).

---

## 3. Table-by-table

### 3.1 User

The root tenant. Carries identity, locale, timezone, role, and quiet-hour preferences. Soft-suspension via `suspendedAt`. Deleting a user cascades through their content (Tasks, Books, etc.) — for full GDPR cascade behaviour see [`13-security-privacy.md`](13-security-privacy.md).

`mutedCategories` is an array of `TaskCategory` enum values — Postgres handles this natively as `enum[]`. Eliminates a junction table for this tiny config field.

### 3.2 Task

A routine item. The combination of `time` + `repeatDays[]` (0=Sunday through 6=Saturday) defines when reminders fire. `linkedBookId` ties a task to a recommended book ("Reading: Atomic Habits, Ch. 3") — nullable because most tasks don't have one.

`orderIndex` allows drag-reorder without renumbering — we use a fractional approach (insert between 100 and 200 with index 150) to avoid mass updates.

`deletedAt` is set on user delete; the completion history survives so stats stay accurate.

### 3.3 Completion

One row per `(task, user, day)`. The unique constraint is the **idempotency primitive** that lets the Mark Done action button on a push notification fire twice without creating duplicates (section 3.4 of [`08-push-notifications.md`](08-push-notifications.md)).

`skipped: true` means "I didn't do this and I'm acknowledging it" — still counts toward "the day is closed", but doesn't break the streak in the same way that a missing record does. The Streak engine logic is detailed in [`14-stats-engine.md`](14-stats-engine.md).

### 3.4 Streak

Denormalised aggregate — `currentStreak`, `longestStreak`, `lastCompletedDate`. Updated transactionally after each Completion insert/delete by the completion service. We accept the denormalisation cost because reading the streak on every Home tab render must be a single-row lookup.

### 3.5 Book

The biggest model, because the library is the biggest feature. Notable fields:

- `fileKey` — S3 object key (e.g., `users/{uid}/books/{bid}.pdf`); never the URL itself
- `fileHash` — SHA-256 of the file, used for duplicate detection
- `coverKey` — separate object so we can serve covers without minting a full-file URL
- `visibility` — enum drives the state machine in [`06-uploads-public-library.md`](06-uploads-public-library.md)
- `reviewedById` / `reviewedAt` / `rejectionReason` — moderation outcome
- `rightsAcceptedAt` — immutable timestamp from the rights checkbox; legal evidence
- `downloadsCount` — denormalised counter, updated when `BookDownload` is created
- `tags` — Postgres `text[]`, queried with `&&` operator
- `deletedAt` — soft-delete; reads continue to work for users with offline copies

### 3.6 BookCategory

Static-ish list managed by admins. The slug (`self-help`, `fiction`) is the stable identifier — names can be localised but slugs never change. Categories are seeded from `apps/api/prisma/seed.ts` with the nine starter categories from [`06-uploads-public-library.md`](06-uploads-public-library.md).

### 3.7 ReadingProgress

One row per `(user, book)`. Stores `currentLocator` as either a CFI string (EPUB) or a `page:N` token (PDF). `percent` is denormalised for sorting "Continue reading" — we compute it client-side and trust the server-side last-write-wins.

`secondsRead` accumulates the 1s ticks from the reader (section 6 of [`05-ebook-reader.md`](05-ebook-reader.md)). The stats engine reads this for the weekly reading-minutes chart.

### 3.8 BookDownload

Tracks which books a user has on which device. Status enum (`pending` → `ready` / `failed`) lets the storage manager show progress. We do **not** store the encryption key here — that lives on-device in Keychain/EncryptedSharedPreferences.

### 3.9 Bookmark (carries highlights too)

Schema compromise: bookmarks and highlights have almost the same shape, so they share a table.

- Pure bookmark: `note = null`, `color = null`
- Highlight: `color` set, `note` optional

`locator` is the CFI range (EPUB) or `page:N[x,y,w,h]` (PDF). The application layer distinguishes the two by inspecting `color`.

### 3.10 Report

User-flagged content. `reason` enum keeps moderation triage straightforward. `status` transitions `open → resolved | dismissed`. The 3-strike auto-re-review rule (section 4.2 of [`06-uploads-public-library.md`](06-uploads-public-library.md)) is implemented in a worker that watches new Report rows.

### 3.11 DeviceToken

One row per device per platform. Multiple per user is the common case (phone + tablet). `staleAt` is set when FCM/APNs reject the token; the worker skips stale tokens but doesn't delete them until the user signs out (so we can repopulate if the same token re-validates).

### 3.12 NotificationLog

Every push the server attempts gets a row. `payload` is JSONB so the schema can evolve without migrations. `deliveredAt` / `openedAt` are populated from delivery receipts (FCM) and analytics events from the client.

### 3.13 FeatureFlag

`rolloutPercent` (0-100) hashed deterministically on `userId` (so the same user sees the same value across launches). `audience` is a JSON filter — kept flexible to avoid migrations every time we add a targeting dimension.

### 3.14 AuditLog

The most important table for compliance. Append-only at the DB level: prod role grants `SELECT, INSERT` but **not** `UPDATE` or `DELETE` on this table. `diff` is a JSONB before/after payload — generated by a Prisma middleware that diffs the row pre- and post-mutation.

Indexed three ways (by actor, by target, by action) so the audit-log browser in the admin panel is responsive.

---

## 4. Index strategy

The indexes in the Prisma file aim at the queries actually issued by the app:

| Query | Index |
|---|---|
| List today's tasks | `Task(userId, deletedAt)` |
| Get user's completions in a week | `Completion(userId, completedAt)` |
| Public library landing | `Book(visibility)` + `Book(downloadsCount desc)` |
| User's books in library | `Book(ownerId)` |
| Moderation queue | `Book(visibility)` filtered to `pending_review` |
| Continue reading | `ReadingProgress(userId, lastReadAt desc)` |
| Open reports | `Report(status, createdAt)` |
| Audit log by actor | `AuditLog(actorId, createdAt desc)` |
| Email lookup at sign-in | `User(email)` unique |

If a new query lands on production, the perf review checks whether it's covered by an existing index or needs a new one.

---

## 5. Migrations & seed

- Migrations are generated by Prisma (`pnpm prisma migrate dev`) and committed.
- Each migration is **reversible**; destructive migrations require an ADR.
- Seed script (`apps/api/prisma/seed.ts`) creates:
  - 1 super_admin + 1 admin + 1 moderator + 2 users
  - 9 BookCategory rows
  - 5 sample books (mix of visibility states)
  - 7 days of sample completions for the 2 users
  - A handful of feature flags

Run with `pnpm --filter @app/api db:seed`.

---

## 6. Soft-delete vs hard-delete policy

| Trigger | Behaviour |
|---|---|
| User deletes a task | `Task.deletedAt = now()`; completions stay (so stats are honest about the past) |
| User deletes a book they own | `Book.deletedAt = now()`; signed URLs no longer minted; offline copies still readable |
| Admin moderates a book to `rejected` | Stays visible to owner only; no `deletedAt` |
| User exports + deletes their account (GDPR) | Hard delete cascades through all user-owned rows; their `User` row is replaced with a tombstone (`anonymous@deleted.local`) so foreign-key relationships in `AuditLog` (where they were the *target*) survive |
| 1 year after suspension | Eligible for hard delete via super_admin script |

The GDPR deletion process is detailed in [`13-security-privacy.md`](13-security-privacy.md).

---

## 7. Things deliberately *not* in the schema

To keep the surface small:

- **No `Tag` table.** Tags are a `string[]` on Book. If tag analytics become valuable, promote to a table; until then, denormalise.
- **No `Session` table.** Clerk owns sessions; we trust the JWT.
- **No `Friend`/`Follow` table.** Social is non-goal (v2.0).
- **No `Subscription`/`Plan` table.** Monetisation is post-launch.
- **No `Highlight` table.** Bookmark carries this with optional `color`/`note` columns.

Each of these can be added later without major schema churn.

---

## Next reading

- **How the API consumes this schema** → [`10-api-contracts.md`](10-api-contracts.md)
- **Where each table is queried** → [`12-backend-architecture.md`](12-backend-architecture.md)
- **Security around these queries** → [`13-security-privacy.md`](13-security-privacy.md)
