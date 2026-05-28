# 10 — REST + Realtime API Contracts

> Maps to PRD section 13.
> **When to read:** Phase 1 (week 2) and any time a new endpoint or response shape is being changed.

The API is the contract that binds the mobile app, the admin web, and the workers. Every endpoint is versioned under `/api/v1`. Realtime events use a single WebSocket connection at `/ws`.

This document specifies endpoints, request/response shapes, auth requirements, RBAC, error format, and rate limits. Zod schemas in `apps/api/src/**/schema.ts` are the runtime source of truth — this document explains them.

---

## 1. Cross-cutting conventions

### 1.1 Base URL & versioning

| Env | URL |
|---|---|
| Local | `http://localhost:4000/api/v1` |
| Staging | `https://api.staging.<domain>/api/v1` |
| Production | `https://api.<domain>/api/v1` |

The version is in the URL path. Breaking changes ship under `/api/v2`. Within a major version, fields can be added but never removed or repurposed without an ADR.

### 1.2 Auth

- Every route except `/auth/*` and `/health` requires a valid Bearer JWT in the `Authorization` header.
- JWTs come from Clerk (or the Lucia fallback) and carry `sub` (userId), `role`, `sid` (session id), and `exp`.
- Access tokens expire after 15 minutes; refresh tokens after 7 days (24h for `admin+`).
- Device fingerprint (`X-Device-Id` header) is required for refresh — sessions are device-bound.

### 1.3 Content type

`application/json; charset=utf-8` for all bodies except `/books/upload-url` results (still JSON, but the URL inside is `application/octet-stream` for the upload itself).

### 1.4 Pagination

Cursor-based, never offset:

```
GET /books?scope=public&limit=20&cursor=eyJpZCI6IjEyMyJ9
```

Response shape:

```json
{
  "items": [...],
  "nextCursor": "eyJpZCI6IjE1MCJ9" // null when no more results
}
```

`limit` defaults to 20, max 100. `cursor` is opaque base64 — the server decides its contents.

### 1.5 Errors (RFC 7807)

All errors return a problem-detail object:

```json
{
  "type": "https://api.<domain>/errors/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "Request body did not conform to the expected schema.",
  "errors": [
    { "path": "title", "message": "Required" },
    { "path": "repeatDays", "message": "Must contain 1 or more entries" }
  ],
  "traceId": "01HXY9..."
}
```

Common status codes:

| Status | When |
|---|---|
| 400 | Malformed request (parse failure) |
| 401 | No / invalid Bearer token |
| 403 | Authenticated but lacking role |
| 404 | Resource doesn't exist OR caller can't see it (RBAC mask) |
| 409 | Conflict (duplicate, version mismatch) |
| 422 | Schema validation failed |
| 429 | Rate limit exceeded |
| 5xx | Server error — clients retry with exponential backoff |

### 1.6 Rate limits

Global default: **100 req / 15 min / IP**.
Stricter:

| Route | Limit |
|---|---|
| `POST /auth/login`, `/auth/register`, `/auth/refresh` | 10 / 15 min / IP |
| `POST /books/upload-url` | 10 / hour / user |
| `POST /books/:id/report` | 5 / hour / user |
| `POST /admin/broadcasts` | 1 / hour / admin |

Limits are enforced via Redis counters (`rl:{route}:{key}`).

### 1.7 Headers — request

| Header | Required? | Meaning |
|---|---|---|
| `Authorization: Bearer <jwt>` | All non-auth routes | Identity |
| `X-Device-Id` | Refresh + register-device | Device fingerprint |
| `X-App-Version` | Mobile only | App version for feature flags |
| `Accept-Language` | Optional | Localisation hint |
| `X-Idempotency-Key` | Mutating routes (recommended) | Client-generated UUID to dedupe retries |

### 1.8 Headers — response

| Header | Meaning |
|---|---|
| `X-Trace-Id` | Distributed trace id for support |
| `X-RateLimit-Remaining` | Requests left in current window |
| `Retry-After` | On 429 / 503, seconds until retry |

### 1.9 Idempotency

Mutating endpoints accept an `X-Idempotency-Key`. The server stores `(key, userId, response)` in Redis with a 24h TTL — replays return the cached response. Highly recommended for `POST /completions` (the Mark Done action) and `POST /books`.

---

## 2. Endpoint catalogue

The full set, organised by area. Each row lists method, path, auth (required role), and a one-line purpose. Detailed schemas follow in section 3.

### 2.1 Auth (`/auth/*`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | none | Create user (email + password or OAuth callback handoff) |
| POST | `/auth/login` | none | Returns access + refresh JWT |
| POST | `/auth/refresh` | refresh JWT | Rotates refresh; returns new access |
| POST | `/auth/logout` | access JWT | Invalidates refresh + all sessions for this device |
| GET | `/auth/me` | user | Current user profile + role |

### 2.2 Tasks & completions

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/tasks` | user | List the caller's tasks (filter by `date` for today's schedule) |
| POST | `/tasks` | user | Create a task |
| GET | `/tasks/:id` | user (owner) | Task detail |
| PATCH | `/tasks/:id` | user (owner) | Update (partial) |
| DELETE | `/tasks/:id` | user (owner) | Soft-delete (sets `deletedAt`) |
| POST | `/tasks/:id/reorder` | user (owner) | Set new `orderIndex` |
| GET | `/completions` | user | List caller's completions (date range filter) |
| POST | `/completions` | user | Mark a task done for a date |
| DELETE | `/completions/:id` | user (owner) | Undo a completion |

### 2.3 Stats

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/stats/weekly` | user | Daily completion ratios for the last 7 days |
| GET | `/stats/streaks` | user | Current + best streak |
| GET | `/stats/categories` | user | Per-category completion ratio over `?period=week\|month` |
| GET | `/stats/reading` | user | Reading minutes per day (last 7/30 days) |

### 2.4 Books & library

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/books/upload-url` | user | Pre-signed S3 PUT URL + assigned `fileKey` |
| POST | `/books` | user | Register a book after upload (metadata) |
| GET | `/books` | user | List with `scope=mine\|public&search=&category=&tag=&sort=` |
| GET | `/books/:id` | user (visibility-gated) | Book detail incl. signed read URL |
| PATCH | `/books/:id` | user (owner) | Update metadata or visibility |
| DELETE | `/books/:id` | user (owner) or admin | Soft-delete |
| POST | `/books/:id/download` | user | Issue download manifest + signed URL |
| POST | `/books/:id/report` | user | Flag a public book |
| GET | `/reading-progress/:bookId` | user | Read sync position |
| PUT | `/reading-progress/:bookId` | user | Write sync position |
| GET | `/bookmarks` | user | List the caller's bookmarks/highlights (filter by `bookId`) |
| POST | `/bookmarks` | user | Create a bookmark or highlight |
| DELETE | `/bookmarks/:id` | user (owner) | Remove |

### 2.5 Admin (`/admin/*`)

All require `role >= moderator` and many also require fresh re-auth (see [`13-security-privacy.md`](13-security-privacy.md)).

| Method | Path | Min role | Purpose |
|---|---|---|---|
| GET | `/admin/moderation` | moderator | Queue (filter `status=pending`) |
| GET | `/admin/moderation/:bookId` | moderator | Book detail incl. ClamAV result + preview link |
| POST | `/admin/moderation/:bookId/approve` | moderator | Set visibility=public; writes AuditLog |
| POST | `/admin/moderation/:bookId/reject` | moderator | Set visibility=rejected with reason |
| POST | `/admin/moderation/:bookId/request-edits` | moderator | Return to private with a note |
| GET | `/admin/users` | moderator | Search/paginate users |
| GET | `/admin/users/:id` | moderator | Profile + history |
| PATCH | `/admin/users/:id` | role-dependent | Suspend, force-logout, role change |
| GET | `/admin/feature-flags` | admin | List flags |
| POST | `/admin/feature-flags` | admin | Create/upsert |
| PATCH | `/admin/feature-flags/:id` | admin | Update enabled/rollout/audience |
| POST | `/admin/broadcasts` | admin (super_admin if >10k) | Enqueue broadcast |
| GET | `/admin/broadcasts/:id` | admin | Status + delivery stats |
| GET | `/admin/reports` | moderator | Reports queue |
| POST | `/admin/reports/:id/resolve` | moderator | Resolve a report |
| GET | `/admin/audit-log` | moderator (self) / admin (all) | Browse audit entries |
| GET | `/admin/dashboard` | moderator | Aggregated metrics |

### 2.6 Feature flags (read-only, public to authenticated users)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/feature-flags` | user | Resolves flags for the calling user (deterministic hash) |

### 2.7 Notifications

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/notifications/devices` | user | Register / refresh FCM/APNs token |
| DELETE | `/notifications/devices/:id` | user (owner) | Remove a token (sign-out) |
| GET | `/notifications/inbox` | user | In-app notification list |
| POST | `/notifications/inbox/:id/read` | user | Mark as read |

### 2.8 Account & GDPR

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/account/export` | user | Returns a signed URL to a JSON dump of the caller's data |
| DELETE | `/account` | user | Full account deletion + cascade |

### 2.9 Health & meta

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness + dependency check |
| GET | `/version` | none | Build SHA + version |

---

## 3. Selected request / response shapes

Only the non-obvious ones. Routine CRUD shapes follow the Prisma model directly (see [`09-database-schema.md`](09-database-schema.md)).

### 3.1 `POST /tasks`

Request:

```json
{
  "title": "Morning meditation",
  "description": "10 minutes of breathwork",
  "category": "morning",
  "time": "06:30",
  "repeatDays": [1, 2, 3, 4, 5],
  "remindEnabled": true,
  "quietHoursOverride": false,
  "linkedBookId": null
}
```

Response (201):

```json
{
  "id": "01HXY...",
  "title": "Morning meditation",
  "category": "morning",
  "time": "06:30",
  "repeatDays": [1, 2, 3, 4, 5],
  "remindEnabled": true,
  "createdAt": "2026-05-20T10:42:11Z",
  "orderIndex": 200
}
```

### 3.2 `POST /completions`

Request:

```json
{
  "taskId": "01HXY...",
  "completedAt": "2026-05-20", // YYYY-MM-DD in caller's timezone
  "skipped": false
}
```

Response (201 or 200 if idempotent replay):

```json
{
  "id": "01HXZ...",
  "taskId": "01HXY...",
  "completedAt": "2026-05-20",
  "skipped": false,
  "streak": {
    "currentStreak": 12,
    "longestStreak": 28
  }
}
```

The endpoint returns the updated streak so the client doesn't need a second round-trip.

### 3.3 `POST /books/upload-url`

Request:

```json
{
  "filename": "atomic-habits.pdf",
  "format": "pdf",
  "sizeBytes": 4_280_193
}
```

Response (200):

```json
{
  "bookId": "01HXY...",
  "fileKey": "users/.../books/01HXY....pdf",
  "uploadUrl": "https://r2.../...&Signature=...",
  "expiresAt": "2026-05-20T11:00:00Z",
  "maxBytes": 52428800
}
```

The client uploads the file directly to `uploadUrl` via PUT, then calls `POST /books` with `bookId` to confirm.

### 3.4 `POST /books`

Request:

```json
{
  "bookId": "01HXY...",
  "title": "Atomic Habits",
  "author": "James Clear",
  "description": null,
  "categoryId": "<uuid>",
  "tags": ["productivity", "habits"]
}
```

Response (201): `Book` row with `visibility="private"`. The actual metadata extraction (page count, cover) runs async and the client subscribes to `book.ready` on the WebSocket.

### 3.5 `GET /books/:id`

Response (200, when caller is the owner or the book is public):

```json
{
  "id": "01HXY...",
  "title": "Atomic Habits",
  "author": "James Clear",
  "format": "pdf",
  "sizeBytes": 4280193,
  "pageCount": 320,
  "coverUrl": "https://...&Signature=...",
  "readUrl": "https://...&Signature=...",
  "readUrlExpiresAt": "2026-05-20T11:00:00Z",
  "visibility": "private",
  "downloadsCount": 0,
  "tags": ["productivity", "habits"]
}
```

`readUrl` is a 15-minute signed URL for streaming. The client re-fetches before expiry.

### 3.6 `POST /admin/broadcasts`

Request:

```json
{
  "title": "New feature available",
  "body": "Try our new sepia reading theme tonight!",
  "audience": {
    "roles": ["user"],
    "timezones": ["Asia/Kathmandu", "Asia/Calcutta"],
    "minLastActiveDays": 0,
    "maxLastActiveDays": 7
  },
  "schedule": {
    "mode": "user-local",
    "localTime": "19:00"
  },
  "urgent": false,
  "deepLink": "/library?theme=sepia"
}
```

Response (202):

```json
{
  "broadcastId": "01HXZ...",
  "estimatedAudience": 4214,
  "requiresSuperAdminApproval": false
}
```

For audiences >10k, the response sets `requiresSuperAdminApproval: true` and the broadcast is `pending` until a super_admin POSTs `/admin/broadcasts/:id/approve`.

---

## 4. WebSocket (`/ws`)

A single WebSocket connection per client. Authenticated via the access JWT in the `Sec-WebSocket-Protocol` header (subprotocol value: `bearer.<jwt>`).

### 4.1 Client → server messages

| Type | Payload | Purpose |
|---|---|---|
| `subscribe` | `{ topics: string[] }` | Subscribe to topics relevant to caller's role |
| `unsubscribe` | `{ topics: string[] }` | Unsubscribe |
| `ping` | `{}` | Keepalive; server replies `pong` |

### 4.2 Server → client events

| Topic | Event | Payload | Sent to |
|---|---|---|---|
| `user:{id}` | `book.ready` | `{ bookId }` | Book owner after ingest |
| `user:{id}` | `notification.inbox` | `{ inboxId, title, body }` | Recipient |
| `admin` | `moderation.new` | `{ bookId, ownerId }` | All connected moderators |
| `admin` | `moderation.decided` | `{ bookId, decision }` | All connected moderators |
| `admin` | `report.new` | `{ reportId, bookId }` | All connected moderators |
| `admin` | `flag.updated` | `{ key }` | All connected admins |
| `broadcast:{id}` | `broadcast.progress` | `{ sent, failed, total }` | Composer admin |

Frame format:

```json
{ "type": "event", "topic": "admin", "event": "moderation.new", "data": { ... } }
```

Topics are subscribed explicitly; the server validates that the caller's role allows the topic (`admin` requires `role >= moderator`).

### 4.3 Reconnect strategy

Client retries with exponential backoff (1s, 2s, 5s, 15s, 30s, 60s cap). Re-subscribes on every reconnect.

---

## 5. Type sharing

All Zod schemas live in `apps/api/src/**/schema.ts` and are re-exported from `packages/types/api.ts`. Mobile and admin web import the inferred types:

```ts
import type { CreateTaskInput, TaskResponse } from '@app/types/api';
```

Generated React Query hooks (via `@hey-api/openapi-ts` or a custom codegen) live in `packages/types/hooks.ts`. This means **request shapes can never drift between server and client** — a server-side rename is a TypeScript compile error in mobile and admin.

---

## 6. Worked auth flow

```
[mobile]                              [api]
   │  POST /auth/login                    │
   │  { email, password }                 │
   ├─────────────────────────────────────►│
   │                                      │ Clerk verifies, mint JWTs
   │  200                                 │
   │  { accessToken, refreshToken,        │
   │    user: { id, role, ... } }         │
   │◄─────────────────────────────────────┤
   │  ─ store both in MMKV (encrypted)    │
   │                                      │
   │  GET /tasks (Bearer accessToken)     │
   ├─────────────────────────────────────►│
   │  200 [task[]]                        │
   │◄─────────────────────────────────────┤
   │                                      │
   │  ── 15min later, access expires ──   │
   │  POST /auth/refresh                  │
   │  { refreshToken, deviceId }          │
   ├─────────────────────────────────────►│
   │  200 { accessToken, refreshToken }   │
   │◄─────────────────────────────────────┤
```

---

## 7. OpenAPI

A Swagger UI is exposed at `/api/v1/docs` in non-production environments. The OpenAPI document is auto-generated from the Zod schemas via `fastify-swagger`. This document references the OpenAPI shape but does not replace it — the runtime spec is canonical.

---

## Next reading

- **Where the routes live** → [`12-backend-architecture.md`](12-backend-architecture.md)
- **What the schemas validate against** → [`09-database-schema.md`](09-database-schema.md)
- **Auth + RBAC details** → [`13-security-privacy.md`](13-security-privacy.md)
