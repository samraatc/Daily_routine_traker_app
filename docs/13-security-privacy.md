# 13 — Security, Auth & Privacy

> Maps to PRD section 16.
> **When to read:** Phase 1 (week 1) before the first user table is created; reviewed at the end of every phase.

Security is not a checklist applied at the end. It is woven into auth, RBAC, validation, transport, storage, audit, and incident response. This document specifies each control, where it lives in the codebase, and how it is tested.

---

## 1. Defence-in-depth summary

| Layer | Control |
|---|---|
| Network | TLS 1.2+; HSTS; cert pinning on mobile |
| Identity | Clerk-managed auth; 2FA mandatory for `moderator+` |
| Session | Short access JWT (15 min) + rotating refresh (7d, 24h for admin+); device-bound |
| Authorization | RBAC middleware + service-layer re-check |
| Tenancy | Every user-owned query scoped by `userId` via Prisma extension |
| Input | Zod schema on every request body/query/params |
| Rate limit | Global IP + per-route caps |
| Files | ClamAV scan; signed URLs ≤ 15 min; private buckets only |
| At-rest (cloud) | SSE-KMS on S3/R2 objects; encrypted DB volumes |
| At-rest (device) | AES-256-GCM on downloaded books; key in Keychain/Encrypted Prefs |
| Audit | Append-only `AuditLog` for every privileged action |
| Privacy | GDPR export + delete; data minimisation; regional storage if required |
| Monitoring | Sentry + audit shipper + alerting on anomalies |

---

## 2. Authentication

### 2.1 Token model

| Token | TTL | Storage | Purpose |
|---|---|---|---|
| Access JWT | 15 min | client memory + MMKV `secure` | Bearer on every API request |
| Refresh token | 7 days (24h for `admin+`) | server-side rotation; client stores opaque value | Used to mint a fresh access token |
| Device fingerprint | per device | server | Binds refresh to a device |

Access JWT claims: `sub` (userId), `role`, `sid` (session id), `iat`, `exp`, `dev` (device id).

### 2.2 Refresh flow

```
POST /auth/refresh
Body: { refreshToken, deviceId }

Server:
  - Look up session by hashed refreshToken
  - Verify deviceId matches session.deviceId
  - Verify session not revoked
  - Rotate: mint new access + new refresh, invalidate old refresh
Response: { accessToken, refreshToken, expiresIn }
```

Token reuse detection: if a *revoked* refresh token is presented, **all sessions for that user are invalidated** (suspected token theft).

### 2.3 OAuth providers

Google + Apple OAuth handled by Clerk. Callback URLs are configured per environment. The backend receives a verified JWT — it never sees the OAuth secret.

### 2.4 2FA

- Optional for `user` / `contributor`.
- **Mandatory** for `moderator`, `admin`, `super_admin`. Login is blocked until TOTP or passkey is configured.
- 2FA configured during account upgrade — when role is changed to `moderator`, the user is forced through a 2FA setup screen on next login.

### 2.5 Re-auth for sensitive actions

Certain admin actions require a fresh authentication within the last 5 minutes:

- Changing a user's role
- Suspending a user
- Sending a broadcast > 1k recipients
- Rotating keys (super_admin)

Implementation: a `freshAuthAt` claim is added on login/refresh. Sensitive routes assert `now() - freshAuthAt < 5 min` and return 401 with a custom code (`STEP_UP_REQUIRED`) if not. The client opens a re-auth modal.

---

## 3. Authorization (RBAC)

### 3.1 Roles & permissions

Defined in [`07-admin-panel.md`](07-admin-panel.md) sections 1 and 2.

### 3.2 Enforcement layers

| Layer | What it checks |
|---|---|
| **Route middleware** (`requireRole('moderator')`) | First gate; 403 if missing |
| **Service layer** | Re-checks role + ownership; 403/404 if not satisfied |
| **Prisma scoping extension** | Auto-filters `userId` on user-owned tables |
| **DB grants (prod)** | App role has no `UPDATE/DELETE` on `audit_log` |

A bug in any one layer must not be sufficient to escalate privilege. Tests exist for each layer independently.

### 3.3 Ownership check pattern

```ts
async function update(userId: string, taskId: string, data: ...) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError('task');
  if (task.userId !== userId) throw new ForbiddenError(); // (renders as 404 to hide existence)
  ...
}
```

We return 404 (not 403) when the resource exists but the caller has no rights — preventing enumeration attacks.

---

## 4. Input validation

Every route declares its Zod schemas:

```ts
const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.enum(['morning','work','health','evening','study','reading','other']),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  repeatDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  remindEnabled: z.boolean().default(false),
  linkedBookId: z.string().uuid().nullable().optional(),
});
```

The Fastify plugin uses these for both runtime validation **and** OpenAPI generation. A validation failure returns 422 with the field-level error list (see [`10-api-contracts.md`](10-api-contracts.md) §1.5).

---

## 5. Rate limiting

Detailed in [`10-api-contracts.md`](10-api-contracts.md) §1.6. Implementation:

- `@fastify/rate-limit` plugin
- Redis store (so limits hold across API node restarts)
- Key by IP (anonymous) or userId (authenticated)
- 429 with `Retry-After` header

Special cases:

- Failed login attempts: 5 per 15 min per IP; account is **not** locked out (mitigation, not disablement).
- Upload URL: 10/hour/user — prevents quota abuse.

---

## 6. Transport security

| Control | Where |
|---|---|
| TLS 1.2+ enforced | Load balancer config |
| HSTS preload (1y) | Response header on all API responses |
| HTTPS-only cookies | Refresh-cookie variant (if used) marked `Secure`, `HttpOnly`, `SameSite=Strict` |
| Cert pinning (mobile) | Two pinned certs (current + next rotation) configured in `app.json` and used via `react-native-cert-pinner` |
| WebSocket security | `wss://` only; auth via subprotocol header |

Cert pinning is rotated 60 days before the previous cert expires; both old and new pins ship in the app binary.

---

## 7. Data isolation

- Prisma extension scopes every query on a user-owned model by `userId` from request context (see [`12-backend-architecture.md`](12-backend-architecture.md) §6.1).
- The extension throws if `userId` is missing — explicit `req.adminPrisma` required for cross-user queries.
- Postgres row-level security (RLS) is a stretch: enable it on `audit_log` first since admin queries are the highest-risk surface.

---

## 8. File handling

### 8.1 Upload

- Content-type enforced by S3 signed URL policy.
- Server re-validates magic bytes after upload (defeats type spoofing).
- Size cap 50 MB enforced both client and server.
- Per-user quota (100 books or 5 GB) enforced at upload-URL issuance.

### 8.2 Scanning

- Every uploaded file scanned by ClamAV before activation.
- Infected files → `visibility=rejected`; file deleted from S3.
- ClamAV signature database refreshed daily.

### 8.3 At-rest in the cloud

- S3 SSE-KMS encryption on every object.
- Bucket policies deny all public access.
- Access only via signed URLs, 15-min TTL.

### 8.4 At-rest on device (offline books)

- Per-user 256-bit symmetric key generated client-side.
- Stored in Keychain (iOS) with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — excluded from iCloud/Google backup.
- Files encrypted with AES-256-GCM (96-bit IV per file, auth tag stored with ciphertext).
- Reader decrypts to a temp file in app cache directory, deletes on unmount.

Full detail in [`05-ebook-reader.md`](05-ebook-reader.md) §7.

---

## 9. Secrets management

- Secrets live in Doppler (or AWS Secrets Manager) — **never** in source, **never** in env files committed to git.
- CI pulls secrets at build time; runtime nodes read from the secrets manager.
- Rotation procedure:
  - Database password: rolling, via Postgres `pg_rewrite_password` script.
  - Clerk JWT signing key: rotated by Clerk; we read JWKS endpoint.
  - APNs/FCM keys: rotated quarterly.

Each rotation procedure is documented in `apps/api/docs/operations/rotation.md`.

---

## 10. Audit log

Every action by `moderator+` writes a row to `AuditLog`. See [`09-database-schema.md`](09-database-schema.md) §3.14.

**Append-only at the DB level:** in production, the application's Postgres role has `SELECT, INSERT` on `audit_log` but **no `UPDATE`, no `DELETE`**. Even a compromised application server cannot tamper with the log.

A separate worker (`audit-shipper`) reads recent entries every 5 minutes and ships them to immutable cold storage (S3 with Object Lock, or Grafana Loki with retention policies). The two stores are reconciled nightly.

---

## 11. Privacy & GDPR

### 11.1 Lawful basis

- **Account data** (email, name, role): contract performance.
- **Usage analytics** (event counts, reading minutes): legitimate interest, opt-out via Settings.
- **Push tokens**: contract (necessary to deliver the service).
- **Uploaded books**: contract; copyright responsibility on user.

### 11.2 Data subject rights

| Right | How |
|---|---|
| Access | `GET /account/export` returns a signed URL to a JSON dump of all the user's data |
| Rectification | All editable fields exposed in Settings |
| Erasure | `DELETE /account` cascades; produces a tombstone row |
| Restriction | Suspension (account holds, no further processing) |
| Portability | Export is machine-readable JSON; books are downloadable |
| Object | Opt-out toggles in Settings for analytics |

### 11.3 Account deletion cascade

When a user calls `DELETE /account`:

1. Mark `User.suspendedAt` immediately to stop further activity.
2. Enqueue `account.delete` job.
3. Worker:
   - Deletes all `Task`, `Completion`, `Streak`, `ReadingProgress`, `BookDownload`, `Bookmark`, `Report` (as reporter), `NotificationLog`, `DeviceToken` rows.
   - Deletes owned `Book` rows + files from S3.
   - Replaces `User` row's PII with tombstone values (`email = 'anonymous+<id>@deleted.local'`, name = `null`, avatar = `null`).
   - Marks the original `User.deletedAt`.
   - The User row survives because `AuditLog.actorId` and other historical foreign keys reference it. The tombstone makes the user re-identification impossible.
4. Confirmation email sent to the original address before tombstoning.

A user can cancel the deletion within 30 days by signing back in — the suspension is lifted and the cascade aborted.

### 11.4 Data minimisation

- We do not store IP addresses long-term (only in current request log; rotated after 30 days).
- We do not collect device-level analytics (no IDFA, no GAID).
- Reading content is not transmitted to analytics — we count seconds, never quotes.
- Stack traces in Sentry are scrubbed of PII via `beforeSend`.

### 11.5 Regional storage

For EU users (selected by signup country or explicit setting), data is stored in EU regions (Frankfurt for AWS, Western Europe for R2). The application's data-tenancy module routes Prisma queries to the correct region. (Stretch — initial launch is single-region with documented roadmap.)

---

## 12. Incident response

### 12.1 Classification

| Severity | Definition | Response time |
|---|---|---|
| SEV-0 | Auth bypass; data breach | Pager within 5 min |
| SEV-1 | API down; mass push delivery failure | Pager within 15 min |
| SEV-2 | Single-feature degradation | Best effort same-day |
| SEV-3 | Minor bug; cosmetic | Next sprint |

### 12.2 Playbooks

`docs/runbooks/` contains:

- `auth-bypass.md` — revoke all sessions, rotate JWT signing key, force re-login.
- `data-breach.md` — engage legal, notify within 72h per GDPR, audit `AuditLog` for blast radius.
- `mass-push-failure.md` — switch to in-app inbox only; engage FCM/APNs support.
- `db-outage.md` — failover sequence, read-only degraded mode.

### 12.3 Reporting channel

`security@<domain>` monitored by on-call; PGP key published in `SECURITY.md`. Coordinated disclosure window: 90 days.

---

## 13. Continuous security testing

| Check | Tool | Frequency |
|---|---|---|
| Dependency vulnerabilities | `pnpm audit`, Renovate | Per PR + nightly |
| SAST | GitHub Code Scanning (CodeQL) | Per PR |
| DAST | OWASP ZAP automated scan | Pre-release |
| Penetration test | External firm | Annually + before major release |
| Threat modelling | Internal review (STRIDE) | Quarterly |
| Secret scanning | gitleaks in pre-commit + CI | Per PR |

A `pnpm audit` failure on `high` severity blocks the release.

---

## 14. Where this lives in code

| Concern | File / module |
|---|---|
| JWT verification | `apps/api/src/plugins/auth.ts` |
| RBAC middleware | `apps/api/src/plugins/rbac.ts` |
| Zod schemas | `apps/api/src/modules/*/schema.ts` |
| Rate limit | `apps/api/src/plugins/rate-limit.ts` |
| Audit log writes | `apps/api/src/lib/audit.ts` |
| Prisma scoping | `apps/api/src/plugins/prisma.ts` |
| Encryption helpers (device) | `apps/mobile/src/lib/encryption/` |
| Keychain | `apps/mobile/src/lib/secure/` |
| Account export | `apps/api/src/modules/account/export.service.ts` |
| Account delete worker | `apps/api/workers/account-delete.worker.ts` |

---

## Next reading

- **Roles defined** → [`07-admin-panel.md`](07-admin-panel.md)
- **Schema with audit table** → [`09-database-schema.md`](09-database-schema.md)
- **Where workers run** → [`12-backend-architecture.md`](12-backend-architecture.md)
