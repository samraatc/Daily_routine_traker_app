# Decisions Log

> An ADR-lite register of choices made where the PRD left a default open. New entries appended at the bottom; never edit history (correct via a follow-up entry).

Each entry uses this template:

```
## ADR-NNNN: <title>
**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded by ADR-XXXX
**Context:** ...
**Decision:** ...
**Consequences:** ...
```

---

## ADR-0001: Use Clerk (managed) for auth at launch

**Date:** 2026-05-20
**Status:** Accepted

**Context.** The PRD lists Clerk as the default with a Lucia + JWT fallback. The team is small; managing email + OAuth + multi-device sessions + 2FA in-house consumes engineering time that we'd rather spend on the reader and admin panel.

**Decision.** Use Clerk for v2.0. Document a Lucia migration plan in `docs/runbooks/auth-provider-migration.md` so we are not locked in.

**Consequences.**
- We accept a Clerk dependency (and its pricing) for the launch window.
- 2FA, OAuth (Google + Apple), and session management ship "for free".
- The API only verifies JWTs against Clerk's JWKS — no auth UI in our codebase.
- Migration to Lucia, if required later, is a backend swap; the mobile + admin clients see the same JWT-bearer pattern.

---

## ADR-0002: Cloudflare R2 for object storage

**Date:** 2026-05-20
**Status:** Accepted

**Context.** Books and covers need object storage. The PRD allows S3 or any S3-compatible store. R2 has zero egress costs, which matters if a public book goes viral.

**Decision.** Use R2 for `books-files`, `books-covers`, and `exports`. All access via signed URLs with 15-min TTL.

**Consequences.**
- We isolate from AWS-specific features (no S3 Object Lock; we use Backblaze B2 for the audit cold-storage instead).
- Egress is effectively free; storage cost dominates.
- Migration to AWS S3 is a config change if we need IAM-tighter integration later.

---

## ADR-0003: Postgres FTS at launch, Meilisearch later

**Date:** 2026-05-20
**Status:** Accepted

**Context.** The PRD allows either Postgres full-text search or Meilisearch. At launch we will have <1000 public books. Postgres FTS is good enough at that scale and saves operating a second datastore.

**Decision.** Postgres FTS at launch. Abstract behind a `searchService` interface so the implementation is a config swap.

**Consequences.**
- Less infra to operate, lower cost.
- Re-evaluate when public library hits ~10k books or when result quality degrades.

---

## ADR-0004: `Bookmark` table carries highlights and notes too

**Date:** 2026-05-20
**Status:** Accepted

**Context.** The PRD names both `Bookmark` and `Highlight`. The shapes are nearly identical — a locator, an optional note, an optional color.

**Decision.** Single `Bookmark` table. A row is a "pure bookmark" when `color = null` and `note = null`; otherwise it is a "highlight".

**Consequences.**
- One join instead of two for the reader.
- Application-layer distinction; clean enough at the API surface (`type` is derived).
- If highlights diverge sharply later (e.g., shared highlights), promote to a separate table — pure additive migration.

---

## ADR-0005: 14-day rolling reminder window

**Date:** 2026-05-20
**Status:** Accepted

**Context.** Reminder jobs in BullMQ live in Redis. Scheduling every occurrence forever bloats Redis and makes task edits expensive (delete + re-enqueue years of jobs).

**Decision.** Schedule the next 14 days of occurrences per task. The reminder worker enqueues day 15 each time a job fires, keeping the window rolling.

**Consequences.**
- Redis stays small.
- A task edit re-enqueues only 14 days of jobs.
- A user who stays offline for >14 days still gets reminders via local Notifee, which is also scheduled in 14-day windows on every app launch.

---

## ADR-0006: 5 roles, with `contributor` as a sibling track

**Date:** 2026-05-20
**Status:** Accepted

**Context.** The PRD lists user / contributor / moderator / admin / super_admin. Whether contributor is "above user" or a sibling track was ambiguous.

**Decision.** Contributor is a sibling of user — same write privileges, plus the publishing-eligible flag. It auto-promotes after the first published book OR on manual grant.

**Consequences.**
- We do not gate publishing behind a manual upgrade.
- The UI for "publishing terms accepted" is implicit in the contributor role.
- Permission matrix stays simple (see [`docs/07-admin-panel.md`](docs/07-admin-panel.md) §2).

---

## ADR-0007: Document the project before scaffolding code

**Date:** 2026-05-20
**Status:** Accepted

**Context.** Per the user's directive, this initial pass produces architecture + specification only — no implementation code. The PRD's master prompt is structured for a coding agent to consume, but a comprehensive doc set is more durable than a partial scaffold.

**Decision.** Phase 0 deliverable is the `docs/`, `schema/`, `diagrams/`, `ARCHITECTURE.md`, `DECISIONS.md` set in this repo. Phase 1 (per [`docs/16-roadmap.md`](docs/16-roadmap.md)) scaffolds the monorepo from these specs.

**Consequences.**
- The team — or a coding agent in a future session — has a single source of truth before writing any application code.
- The PRD's master AI build prompt can be combined with these docs to drive Phase 1 implementation without re-deriving decisions.
- Any drift between the docs and the code, once Phase 1 lands, must be corrected in the docs in the same PR.

---

<!--
To add a new decision, append a section like:

## ADR-0008: <title>
**Date:** YYYY-MM-DD
**Status:** Proposed
**Context:** ...
**Decision:** ...
**Consequences:** ...
-->
