# Architecture Overview

> A single bird's-eye view of the Daily Routine & E-Book Tracker. For the section-by-section depth, follow the links to [`docs/`](docs/).

This document exists so a new engineer can answer **"how does this whole thing work?"** in 15 minutes. The detailed answers live in the numbered docs.

---

## 1. One-paragraph summary

A React Native + Expo mobile app (iOS + Android) and a Next.js admin web app talk to a Fastify/Postgres/Redis backend over a versioned REST + WebSocket API. The mobile app uses a Neumorphic 3D design system with Reanimated worklets for motion, MMKV for persistence, and an at-rest-encrypted offline library. Push reminders flow through BullMQ workers to FCM and APNs, with a local Notifee fallback for offline devices. User uploads (PDF/EPUB) go through ClamAV before entering a moderated public library governed by an admin panel with full RBAC and an immutable audit log.

---

## 2. The pieces

```
┌──────────────────────────────────────────────────────────────────┐
│                            USER                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│  CLIENTS                                                         │
│  • Mobile (Expo + Reanimated 3 + Moti + Skia + MMKV)             │
│  • Admin Web (Next.js 14 + Tailwind + shadcn/ui)                 │
└─────────────────────────────┼────────────────────────────────────┘
                              │  HTTPS (TLS 1.2+) + WSS
┌─────────────────────────────┼────────────────────────────────────┐
│  EDGE                                                            │
│  Load balancer, HSTS, cert pinning (mobile), DDoS / WAF          │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│  API                                                             │
│  Fastify + Zod + Prisma. Stateless. /api/v1 + /ws.               │
│  Modules: auth · tasks · completions · stats · books ·           │
│           reading-progress · bookmarks · reports ·               │
│           notifications · admin · feature-flags · account        │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│  WORKERS (separate processes via BullMQ on Redis)                │
│  reminder · upload-ingest · virus-scan · broadcast ·             │
│  report-triage · audit-shipper                                   │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌────────────┬────────────────┼────────────┬─────────────────┐
│   DATA     │   QUEUES/CACHE │   FILES    │  3rd-party       │
│  Postgres  │     Redis      │   S3 / R2  │  Clerk, FCM,     │
│            │                │  (private) │  APNs, Sentry    │
└────────────┴────────────────┴────────────┴──────────────────┘
```

The full Mermaid version: [`diagrams/system-architecture.mmd`](diagrams/system-architecture.mmd).

---

## 3. Cross-cutting concerns and where they live

| Concern | Decision | Doc |
|---|---|---|
| How it looks | Neumorphic 3D — soft outer/inner shadows, no borders | [`docs/03-design-system.md`](docs/03-design-system.md) |
| How it moves | Reanimated worklets only; no JS-thread animations | [`docs/04-motion.md`](docs/04-motion.md) |
| Who can do what | 5-role RBAC; defence in depth (middleware + service + DB grants) | [`docs/07-admin-panel.md`](docs/07-admin-panel.md), [`docs/13-security-privacy.md`](docs/13-security-privacy.md) |
| How data is shaped | Prisma + Postgres; userId on every user-owned row; append-only audit log | [`schema/schema.prisma`](schema/schema.prisma), [`docs/09-database-schema.md`](docs/09-database-schema.md) |
| How clients call the server | Versioned REST + WebSocket; Zod schemas shared across client and server; RFC 7807 errors | [`docs/10-api-contracts.md`](docs/10-api-contracts.md) |
| Where business logic lives | API modules — routes → service → Prisma; no cross-module imports | [`docs/12-backend-architecture.md`](docs/12-backend-architecture.md) |
| Where the mobile app's logic lives | Hooks + Zustand + React Query; screens are thin | [`docs/11-frontend-architecture.md`](docs/11-frontend-architecture.md) |
| How reminders actually fire | BullMQ delayed jobs → worker → FCM/APNs, with local Notifee fallback | [`docs/08-push-notifications.md`](docs/08-push-notifications.md), [`diagrams/reminder-flow.mmd`](diagrams/reminder-flow.mmd) |
| How books move from upload to public | Upload → ClamAV → metadata extraction → moderation queue → approve | [`docs/06-uploads-public-library.md`](docs/06-uploads-public-library.md), [`diagrams/moderation-flow.mmd`](diagrams/moderation-flow.mmd) |
| How offline reading is safe | AES-256-GCM with per-user key in Keychain / Encrypted Prefs | [`docs/05-ebook-reader.md`](docs/05-ebook-reader.md) §7, [`diagrams/reader-flow.mmd`](diagrams/reader-flow.mmd) |
| How we know it's healthy | Sentry + Grafana + synthetic monitors + per-release accessibility/performance audit | [`docs/15-devops.md`](docs/15-devops.md), [`docs/17-non-functional.md`](docs/17-non-functional.md) |

---

## 4. How a request flows (worked example)

A user opens the app, the Today tab loads, and a reminder fires later in the day. Here's the trace:

1. **Cold launch.** App reads MMKV (sync) → finds a refresh token → calls `POST /auth/refresh` → gets a fresh access JWT. (Total cold-start budget: 2.5s.)
2. **Hydrate cache.** React Query rehydrates from MMKV; the Today tab renders the last-known task list instantly. In parallel, `GET /tasks?date=2026-05-20` fires.
3. **Server responds.** Fastify auth plugin verifies the JWT against Clerk's JWKS, attaches `req.user`. The tasks module's route handler invokes `tasksService.listForToday(req.user.id, today)`. Prisma's scoping extension auto-injects `userId`. Response: 200 with a typed body.
4. **User completes a task.** Tap → optimistic UI update via React Query `onMutate`. POST `/completions` with the `X-Idempotency-Key` header. Server inserts in a transaction with the Streak update; returns the new `currentStreak`. Client confirms the optimistic write.
5. **Reminder fires later.** BullMQ delayed job pops in the reminder worker. The worker checks the task still exists, the user isn't suspended, isn't in quiet hours; sends to FCM. Phone receives it. User taps Mark Done from the lock screen; the action handler sends `POST /completions` directly via an iOS Notification Service Extension. The same idempotency key dedupes against any double-fire.
6. **Stats refresh.** Next time the Stats tab opens, `GET /stats/weekly` returns a Redis-cached aggregation (5-min TTL).

Every step is observable in Sentry traces and the Grafana dashboard.

---

## 5. What is *not* in this system

Stated explicitly so they aren't accidentally built:

- No social graph, no comments, no likes.
- No real-time chat.
- No DRM beyond at-rest encryption.
- No web client for end users (web is admin-only).
- No third-party highlight sync (Goodreads, Kindle).
- No in-app purchases / subscriptions at launch.

These are the **non-goals** from [`docs/00-overview.md`](docs/00-overview.md) §2.4.

---

## 6. The development flow this architecture supports

Eight phases over 12 weeks ([`docs/16-roadmap.md`](docs/16-roadmap.md)):

```
1 Foundations  ─▶  2 Routines  ─▶  3 Reminders  ─▶  4 Stats & Motion
                                                          │
                                                          ▼
5 Reader  ─▶  6 Uploads & Library  ─▶  7 Admin  ─▶  8 Polish & Launch
```

Each phase has explicit entry / exit criteria so the team knows when to move on. Within each phase, the per-feature flow is:

1. Read the relevant section docs.
2. Migrate the database (Prisma) if needed.
3. Build the API (route → service → schema → tests).
4. Update `packages/types` so the client gets the new contract.
5. Build the mobile screen using Neumorphic primitives + Reanimated wrappers.
6. Wire client state (Zustand + React Query).
7. Add motion (Reanimated + Moti).
8. Test (unit → component → API → E2E).
9. Document changes in a phase summary + any new defaults in [`DECISIONS.md`](DECISIONS.md).

---

## 7. Default choices and where they're recorded

The PRD pins most technologies and patterns; everywhere it's silent, [`DECISIONS.md`](DECISIONS.md) captures what the team chose and why. Two examples already recorded there: auth provider (Clerk vs Lucia) and search backend (Postgres FTS vs Meilisearch).

---

## 8. Quality gates baked into the architecture

| Gate | Enforced where | Failure consequence |
|---|---|---|
| Lint, type, format | CI per PR | PR blocked |
| Unit + component + API tests | CI per PR | PR blocked |
| Reassure perf budgets | CI per PR | PR blocked on > 10% regression |
| Audit log row on privileged action | Service layer + DB grants | Operational anomaly investigation |
| Signed URL ≤ 15 min TTL | `apps/api/src/lib/s3.ts` | Hard-coded; code review |
| User-scoped queries | Prisma extension | Throws if userId missing |
| Crash-free > 99.5% | Sentry release dashboard | Release rollback |
| OWASP ZAP high findings | Release pipeline | Release blocked |

The architecture isn't a set of suggestions — it's a set of guarantees.

---

## 9. How to extend safely

When adding a feature:

1. Find the persona it serves in [`docs/00-overview.md`](docs/00-overview.md) §3. If it serves no one, defer or cancel.
2. Add or extend a schema in [`schema/schema.prisma`](schema/schema.prisma); generate a migration.
3. Update [`docs/09-database-schema.md`](docs/09-database-schema.md) with the rationale for any new field or table.
4. Add a Zod schema in the relevant API module; the route and types follow.
5. If the UI changes are motion-relevant, add the pattern to [`docs/04-motion.md`](docs/04-motion.md) before implementing.
6. Write the tests at every pyramid layer ([`docs/18-testing-strategy.md`](docs/18-testing-strategy.md)).
7. Record any default chosen along the way in [`DECISIONS.md`](DECISIONS.md).

This sequence keeps the docs and the code aligned.

---

## 10. When to read which doc

| Situation | Read |
|---|---|
| First day on the team | This doc + [`docs/00-overview.md`](docs/00-overview.md) + [`docs/16-roadmap.md`](docs/16-roadmap.md) |
| Designing a screen | [`docs/03-design-system.md`](docs/03-design-system.md) + [`docs/04-motion.md`](docs/04-motion.md) |
| Adding an endpoint | [`docs/10-api-contracts.md`](docs/10-api-contracts.md) + [`docs/12-backend-architecture.md`](docs/12-backend-architecture.md) |
| Changing data shape | [`docs/09-database-schema.md`](docs/09-database-schema.md) + [`schema/schema.prisma`](schema/schema.prisma) |
| Working on auth/admin | [`docs/07-admin-panel.md`](docs/07-admin-panel.md) + [`docs/13-security-privacy.md`](docs/13-security-privacy.md) |
| Working on reminders | [`docs/08-push-notifications.md`](docs/08-push-notifications.md) |
| Working on books | [`docs/05-ebook-reader.md`](docs/05-ebook-reader.md) + [`docs/06-uploads-public-library.md`](docs/06-uploads-public-library.md) |
| Pre-release sign-off | [`docs/17-non-functional.md`](docs/17-non-functional.md) + [`docs/18-testing-strategy.md`](docs/18-testing-strategy.md) + [`docs/19-risks.md`](docs/19-risks.md) |
| Setting up CI/CD | [`docs/15-devops.md`](docs/15-devops.md) |
