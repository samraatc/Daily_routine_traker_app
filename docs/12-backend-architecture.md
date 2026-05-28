# 12 — Backend Architecture

> Maps to PRD section 15.
> **When to read:** Phase 1 (week 1-2) when scaffolding the API; whenever a new module or worker is being added.

The backend is a **Fastify** server in TypeScript, talking to **PostgreSQL** via **Prisma**, with **Redis** + **BullMQ** for queues and rate-limits. Long-running and bursty work runs in **separate worker processes**. Files live in **S3-compatible** storage (Cloudflare R2 or AWS S3) — never on the API host.

This document specifies module boundaries, worker responsibilities, infra topology, and the engineering rules backend developers follow.

---

## 1. Process topology

```
                   ┌───────────────┐
                   │  Load balancer│
                   └──────┬────────┘
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
        ┌──────────────┐    ┌──────────────┐
        │  API node    │    │  API node    │  ◄── stateless; horizontal scaling
        │  (Fastify)   │    │  (Fastify)   │
        └──────┬───────┘    └──────┬───────┘
               │                   │
               └─────────┬─────────┘
                         │
            ┌────────────┼─────────────┬───────────────┐
            ▼            ▼             ▼               ▼
       ┌──────────┐ ┌───────────┐ ┌────────────┐ ┌────────────────┐
       │PostgreSQL│ │   Redis   │ │  S3 / R2   │ │  3rd-party     │
       │   16     │ │   7       │ │            │ │  (Clerk, FCM,  │
       └──────────┘ └─────┬─────┘ └────────────┘ │  APNs, Sentry) │
                          │                       └────────────────┘
                          ▼
                ┌─────────────────────┐
                │  WORKERS (separate  │
                │  Node processes)    │
                │                     │
                │  • reminder        │
                │  • upload-ingest   │
                │  • virus-scan      │
                │  • broadcast-sender│
                │  • report-triage   │
                │  • audit-shipper   │
                └─────────────────────┘
```

API nodes are stateless: any node can serve any request. Workers consume from BullMQ queues in Redis and write back to Postgres.

---

## 2. Folder structure (`apps/api`)

```
apps/api/
├── prisma/
│   ├── schema.prisma         # ← symlink/copy of /schema/schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── server.ts             # Fastify bootstrap
│   ├── plugins/              # Fastify plugins
│   │   ├── auth.ts           # JWT verification (Clerk) + req.user
│   │   ├── rbac.ts           # role enforcement
│   │   ├── prisma.ts         # prisma client on req.app
│   │   ├── rate-limit.ts
│   │   ├── error-handler.ts  # RFC 7807 problem-details
│   │   ├── logger.ts         # pino + trace IDs
│   │   ├── swagger.ts        # OpenAPI generation
│   │   └── websocket.ts
│   ├── modules/
│   │   ├── auth/             # routes + service + schema
│   │   ├── tasks/
│   │   ├── completions/
│   │   ├── stats/
│   │   ├── books/
│   │   ├── reading-progress/
│   │   ├── bookmarks/
│   │   ├── reports/
│   │   ├── notifications/
│   │   ├── admin/
│   │   ├── feature-flags/
│   │   └── account/          # GDPR export + delete
│   ├── ws/                   # WebSocket gateway
│   ├── lib/
│   │   ├── s3.ts             # signed URL helpers
│   │   ├── encryption.ts     # AES helpers (not for offline files; for envelope encryption of e.g. backups)
│   │   ├── time.ts           # DST-safe scheduling
│   │   ├── idempotency.ts    # Redis-backed idempotency keys
│   │   ├── audit.ts          # writes AuditLog rows
│   │   ├── fcm.ts
│   │   ├── apns.ts
│   │   └── email.ts
│   ├── types/                # local types; most types in packages/types
│   └── ws/
├── workers/
│   ├── reminder.worker.ts
│   ├── upload-ingest.worker.ts
│   ├── virus-scan.worker.ts
│   ├── broadcast.worker.ts
│   ├── report-triage.worker.ts
│   └── shared/               # queue declarations, prisma client, telemetry
├── test/                     # Supertest + Vitest
│   ├── auth.test.ts
│   ├── tasks.test.ts
│   └── ...
├── Dockerfile
├── Dockerfile.worker
├── package.json
└── tsconfig.json
```

---

## 3. Module conventions

Each module under `src/modules/` follows the same shape:

```
modules/tasks/
├── routes.ts         # Fastify route registration
├── service.ts        # business logic (uses Prisma, throws domain errors)
├── schema.ts         # Zod schemas (request body, params, query, response)
├── types.ts          # inferred types re-exported
└── tasks.test.ts     # module-level integration tests
```

### Module rules

1. **Routes import services, not Prisma.** Routes orchestrate; services do work.
2. **Services import their own Prisma and the audit lib — that's it.** No cross-module service imports inside a module — if module A needs something from module B, call B's service via DI.
3. **Schemas are exported from `packages/types/api`.** The web/mobile clients import the same shapes.
4. **Errors are typed.** Services throw `AppError` subclasses (`NotFoundError`, `ForbiddenError`, `ValidationError`, ...). The error-handler plugin maps them to RFC 7807 responses.
5. **No SQL outside Prisma.** Raw SQL is allowed for materialised-view refreshes and migrations only.

### Example route (sketch)

```ts
// modules/tasks/routes.ts
export default async function (app: FastifyInstance) {
  app.post('/tasks', {
    schema: { body: createTaskSchema, response: { 201: taskSchema } },
    handler: async (req, reply) => {
      const task = await tasksService.create(req.user.id, req.body);
      return reply.code(201).send(task);
    }
  });
}
```

---

## 4. Plugins

| Plugin | Purpose | Order |
|---|---|---|
| `logger` | pino + trace IDs propagated to `req.log` | 1 |
| `error-handler` | catches all errors, emits RFC 7807 | 2 |
| `prisma` | shared client on `app.prisma`; transaction helper | 3 |
| `auth` | verifies JWT, populates `req.user`; honors `Authorization: Bearer` and WS subprotocol | 4 |
| `rbac` | exposes `req.requireRole('moderator')` and `req.requireOwnership(...)` | 5 |
| `rate-limit` | route-scoped limits | 6 |
| `idempotency` | reads `X-Idempotency-Key`, hashes responses to Redis | 7 |
| `websocket` | `/ws` gateway | 8 |
| `swagger` | exposes `/api/v1/docs` in non-prod | 9 |

Plugins are registered in `server.ts` in the order above. Order matters — auth must run before rbac, error-handler before everything that throws.

---

## 5. Workers (BullMQ)

Each worker is its own process, packaged in its own Docker image (`Dockerfile.worker`). Reasons:

- Memory isolation (a leaking ingest worker doesn't take down the API).
- Independent scaling (broadcast worker scales horizontally; reminder worker stays at 1-2 instances).
- Independent deploy.

### 5.1 Reminder worker

Consumes: `reminders` queue.
Produces: FCM/APNs sends + `NotificationLog` rows.

Logic detailed in [`08-push-notifications.md`](08-push-notifications.md). Key responsibilities:

- Check task still exists, user not suspended, not in quiet hours.
- Fan out to all user's device tokens; mark stale tokens.
- Write `NotificationLog`.
- Re-enqueue next occurrence (rolling 14-day window).

### 5.2 Upload ingest worker

Consumes: `book.ingest` queue.
Produces: updated `Book` row + cover image + WebSocket event.

Steps:

1. Download the file from S3 (the just-uploaded fileKey).
2. Compute SHA-256 hash for duplicate detection.
3. Extract metadata (`pdf-lib` for PDF; `epubjs` for EPUB): title, author, page count.
4. Render cover image (page 1 of PDF or cover-image item from EPUB).
5. Upload cover to S3 under `users/{uid}/covers/{bid}.webp`.
6. Update `Book` row.
7. Enqueue to `book.virusScan` queue.
8. Emit WebSocket `book.ready` to the owner once virus scan completes.

### 5.3 Virus scan worker

Consumes: `book.virusScan` queue.
Produces: pass/fail decision; `Book.visibility` stays `private` or moves to `rejected('clamav:<sig>')`.

Runs ClamAV in a sidecar container; the worker pipes the file via TCP socket. On infection, the file in S3 is deleted and the row marked `rejected`.

### 5.4 Broadcast worker

Consumes: `broadcasts` queue.
Produces: FCM/APNs fan-out + `NotificationLog` rows + progress events.

Builds the audience query, paginates in batches of 500, sends in parallel with concurrency 8. Emits `broadcast.progress` to the WebSocket topic so the admin composer shows live progress.

### 5.5 Report triage worker

Consumes: `report.created` queue (one event per new `Report` row).
Produces: maybe moves a Book back to `pending_review`.

Counts open reports per book. On the 3rd open report against the same `bookId`, transitions the book to `pending_review` automatically and writes an `AuditLog` entry (actor = `system`).

### 5.6 Audit shipper

Runs as a cron worker (every 5 min). Reads recent `AuditLog` rows and ships them to an immutable store (e.g., S3 Object Lock or Loki) for tamper-evident retention.

---

## 6. Data access patterns

### 6.1 Tenant isolation

A custom Prisma extension wraps all queries on user-owned tables to inject the `userId` filter from the request context. The extension throws if no userId is set. This means:

```ts
// in a route handler
const tasks = await req.scopedPrisma.task.findMany({}); // ← automatically scoped
```

There is no way to issue an unscoped query against a user-owned table from a request handler without explicitly using `req.adminPrisma` (which requires `role >= admin`).

### 6.2 Transactions

Multi-step mutations use `prisma.$transaction(async (tx) => {...})`. Examples:

- `POST /completions`: create Completion + update Streak in one transaction.
- `POST /admin/moderation/:id/approve`: update Book + write AuditLog in one transaction.

### 6.3 Soft delete

`deletedAt`-aware models default to filtering out soft-deleted rows. To include them (e.g., for undo), pass `{ includeDeleted: true }` to the service method — never bypass the filter at the query layer.

---

## 7. S3 / R2 usage

| Bucket | Visibility | Contents |
|---|---|---|
| `books-files` | private | `users/{uid}/books/{bid}.{pdf\|epub}` — original uploads |
| `books-covers` | private | `users/{uid}/covers/{bid}.webp` — rendered covers |
| `exports` | private | `gdpr/{uid}/{exportId}.json.gz` — short-lived (24h) |

All access via **signed URLs only** with 15-minute TTL. Never set bucket policies that allow public reads. Cover images are *also* served via signed URLs — using a CDN with edge-signed URLs is a stretch optimisation.

### Object naming convention

Object keys include the user ID even when the object is public, so cold-storage lifecycle rules can sweep per-user. A book moving private→public→private does **not** change its `fileKey`.

---

## 8. Redis usage

| Use | Key pattern | TTL |
|---|---|---|
| BullMQ queues | `bull:<queue>:*` | per-job |
| Rate-limit counters | `rl:<route>:<key>` | window |
| Idempotency cache | `idem:<key>` | 24h |
| Stats cache | `stats:<userId>:weekly` | 5min |
| Feature flag cache | `flags:<userId>` | 60s |
| Live WS topic subscribers | `ws:topic:<topic>` | — |

Redis is treated as a cache + queue, never the primary store. If Redis is wiped, the worst case is users have to log in again (no — refresh tokens live in Postgres) and broadcasts in flight are lost.

---

## 9. Auth implementation

Two supported paths — pick one per deployment:

### 9.1 Clerk (default per PRD)

- `apps/api/src/plugins/auth.ts` calls Clerk's JWKS endpoint, verifies the token, populates `req.user`.
- Webhooks (`/webhooks/clerk`) sync user data into our `User` table.
- Sign-up / sign-in / password-reset flows happen client-side via Clerk SDK; the API only sees authenticated requests.

### 9.2 Lucia + JWT (self-hosted fallback)

- Lucia owns sessions in Postgres (Session, Key tables).
- `apps/api/src/modules/auth/` exposes register, login, refresh, logout.
- Same Bearer JWT pattern for downstream routes.

The choice is recorded in [`../DECISIONS.md`](../DECISIONS.md).

---

## 10. Observability

| Signal | Tool | Where |
|---|---|---|
| Logs | pino → Grafana Loki | every request, structured JSON |
| Traces | OpenTelemetry → Grafana Tempo | per-request spans, propagated to workers |
| Metrics | Prometheus client → Grafana Mimir | request count, latency p50/p95/p99, queue depth, DB pool |
| Errors | Sentry | 5xx, unhandled rejections, worker failures |
| Audit | `AuditLog` in Postgres + shipped to immutable store | compliance |

A single dashboard ("API Overview") aggregates request rate, error rate, latency percentiles, queue depth, and DB pool saturation.

---

## 11. Configuration

`apps/api/src/config.ts` reads from environment variables via Zod. Required variables:

```
DATABASE_URL
REDIS_URL
S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY
S3_BUCKET_FILES, S3_BUCKET_COVERS, S3_BUCKET_EXPORTS
CLERK_SECRET_KEY, CLERK_JWT_KEY
FCM_SERVICE_ACCOUNT_JSON
APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_PRIVATE_KEY_PATH
SENTRY_DSN
NODE_ENV
PORT
```

The schema fails fast on missing/invalid variables — no booting in a half-configured state.

Local dev uses `.env.local`; CI/prod uses Doppler / AWS Secrets Manager.

---

## 12. Local dev (Docker Compose)

`infra/docker-compose.yml` brings up:

- `postgres:16` with a persistent volume
- `redis:7-alpine`
- `minio` (S3-compatible local storage)
- `mailhog` (email capture for password reset testing)
- `clamav/clamav` (sidecar for the virus-scan worker)

`pnpm dev` runs:

- `apps/api` via `tsx watch`
- workers via `pnpm --filter @app/api worker:reminder` etc.
- `apps/admin-web` via `next dev`
- `apps/mobile` via `expo start`

---

## 13. Engineering rules (enforced via lint / review)

1. **No cross-module Prisma imports.** A module that needs another module's data goes through that module's service.
2. **Every mutating route writes an audit entry if it's privileged.**
3. **Every signed URL is ≤ 15 min TTL.** No exceptions.
4. **No public S3 buckets.** Ever.
5. **No raw `req.body.userId` trust.** Always derive userId from `req.user`.
6. **Every queue has a dead-letter target.** Failed jobs land in `<queue>:dead` for inspection.
7. **No environment branching in handlers.** Env-specific config lives in `config.ts`.
8. **All new routes have a Supertest test.** 100% endpoint coverage is the bar.

---

## Next reading

- **What endpoints the modules expose** → [`10-api-contracts.md`](10-api-contracts.md)
- **What data each module reads/writes** → [`09-database-schema.md`](09-database-schema.md)
- **Security details** → [`13-security-privacy.md`](13-security-privacy.md)
- **CI/CD that ships this** → [`15-devops.md`](15-devops.md)
