# Project status

> Snapshot of what's built vs. what's still on the roadmap. Updated 2026-05-29.

The PRD describes a 12-week, 8-phase build. This session has scaffolded a working monorepo and shipped the core of phases 1, 2, 4, and 6/7 (in API form). Mobile and admin clients reach those endpoints today.

---

## Built

### Monorepo + tooling
- pnpm workspaces with 6 packages (3 apps + 3 shared)
- Shared `packages/config` (tsconfig + eslint + prettier)
- Shared `packages/types` (Zod schemas → inferred TS types)
- Shared `packages/ui` (Neumorphic primitives + motion wrappers)
- Root scripts: `dev`, `typecheck`, `lint`, `test`, `db:*`, `docker:*`, `fresh`
- `.gitignore`, `.editorconfig`, `.nvmrc`, `.prettierrc.json` all in place

### Infrastructure
- `infra/docker-compose.yml` — Postgres 16 + Redis 7 + MinIO + MailHog
- `.github/workflows/pr-check.yml` — lint + typecheck + API tests with a real Postgres service
- `.github/workflows/security.yml` — daily `pnpm audit` + gitleaks
- `.github/workflows/codeql.yml` — weekly + PR CodeQL scans

### Backend (apps/api) — Phases 1, 2, 4, 6, 7 ✅
- Fastify 4 + TS strict + Pino structured logging
- Prisma 5 schema with all 13 models from `schema/schema.prisma`
- Plugins: auth (JWT), RBAC, prisma, error-handler (RFC 7807), rate-limit, idempotency
- Deterministic seed script (5 users with 3 admin tiers + 9 categories + 2 books + 7 days of completions)
- Modules + routes:
  - `auth` — register / login / refresh / logout / me (Phase 1 ✅)
  - `tasks` — full CRUD + reorder + soft-delete (Phase 2 ✅)
  - `completions` — idempotent Mark Done + undo (Phase 2 ✅)
  - `streak` engine — transactional recompute with timezone-correct lookback (Phase 2 ✅)
  - `stats` — `/weekly`, `/streaks`, `/categories`, `/reading` (Phase 4 ✅)
  - `books` — upload-URL, register, list, get, patch, delete, report (Phase 6 ✅)
  - `notifications` — device registration + inbox (Phase 3 surface, no FCM/APNs delivery yet)
  - `feature-flags` — deterministic per-user resolution (Phase 7 ✅)
  - `admin` — dashboard, moderation queue + approve/reject, user role/suspend, feature-flag upsert, broadcast composer, audit log (Phase 7 ✅)
  - `account` — GDPR export + cascade-delete with tombstone (Phase 8 ✅)
- Tests (Supertest + Vitest):
  - `health.test.ts`, `auth.test.ts`, `tasks.test.ts`, `completions.test.ts`, `rbac.test.ts`
  - Covers idempotency, streak math, cross-user isolation (404 mask), RBAC denials

### Admin web (apps/admin-web) — Phase 7 ✅
- Next.js 14 App Router + Tailwind + Zustand persist
- Sign-in gate (rejects non-moderator+ at the UI layer; server re-checks)
- Dashboard, Moderation queue (approve/reject), Users placeholder, Feature flags toggle, Audit log table

### Mobile (apps/mobile) — Phases 1, 2, 4 ✅
- Expo Router with `(auth)` and `(tabs)` route groups + AuthGate
- Reanimated + Moti + react-native-mmkv configured
- Zustand stores: `auth` (persisted), `ui` (theme)
- React Query with offline-aware refresh-token interceptor
- Screens:
  - Sign in / Sign up (Phase 1 ✅)
  - Today tab: stagger-animated list, daily progress ring, streak flame, tap-to-toggle completions (Phase 2 + 4 ✅)
  - Stats tab: streak card, weekly heatmap, reading minutes (Phase 4 ✅)
  - Library tab: placeholder for Phase 5
  - Settings tab: theme toggles (light/dark/high-contrast), sign-out

### Docs (already in place from the spec phase)
- 20-file `docs/` set covering every PRD section
- `ARCHITECTURE.md`, `DECISIONS.md`, 7 Mermaid diagrams
- 200 internal links all verified

---

## Not yet built (mapped to phase)

### Phase 3 — Reminders
- BullMQ reminder worker
- FCM + APNs delivery
- Notifee local fallback wiring on mobile
- Quiet hours enforcement at fire time
- Snooze actions
- The DB models and `/notifications/devices` endpoint are in place; the worker + push integration are the next implementation chunk.

### Phase 5 — E-Book reader
- `react-native-pdf` + `epubjs-rn` rendering screens
- Signed-URL streaming
- AES-256-GCM offline encryption (per-user key in Keychain)
- Storage Manager screen
- Skia page-curl effect
- The Book CRUD + ReadingProgress endpoints are live; the mobile reader is the next implementation chunk.

### Phase 6 (extensions)
- ClamAV virus-scan worker
- Pre-signed S3 URL implementation (currently returns a stub URL pointing at MinIO)
- Cover + metadata extraction worker

### Phase 7 (extensions)
- WebSocket `/ws` realtime events for moderation
- Broadcast worker (currently writes a NotificationLog; doesn't fan out)
- Users search + suspend UI on admin web

### Phase 8 — Launch polish
- Accessibility audit walkthrough
- Performance pass with real-device traces
- App Store / Play Store listing prep
- TestFlight + Play Internal pipeline

### Cross-cutting
- Maestro mobile E2E flows
- Playwright admin E2E flows
- Reassure perf budgets
- Storybook (mobile + web)
- k6 load tests
- Sentry + Grafana integration

---

## Code metrics

| Workspace | Files | Lines |
|---|---:|---:|
| `@app/types` | 15 | 541 |
| `@app/ui` | 14 | 723 |
| `@app/config` | 0 (configs only) | — |
| `@app/api` | 37 | 2,484 |
| `@app/mobile` | 19 | 1,117 |
| `@app/admin-web` | 13 | 552 |
| **Total** | **98** | **5,417** |

Plus 20 docs (~7k lines), 7 Mermaid diagrams, the canonical Prisma schema, the seed, and 3 GitHub Actions workflows.

---

## Verification done in this session

- Every workspace import (`@app/types`, `@app/ui`, `@app/config`) resolves to a real workspace.
- All 70 `.ts` files parse cleanly under Node 22's `--experimental-strip-types --check`.
- All 27 `.tsx` files have balanced braces, brackets, and parentheses.
- All 200 internal documentation links resolve.

`pnpm install`, `tsc`, and `pnpm test` need network access (registry.npmjs.org) that the build sandbox doesn't have. On a connected machine, run:

```bash
pnpm install
pnpm typecheck
pnpm --filter @app/api db:migrate && pnpm --filter @app/api db:seed
pnpm test
```

---

## Next steps for whoever picks this up

1. `pnpm install` and run the test suite to confirm the API is fully green.
2. Open [`HOW_TO_RUN.md`](HOW_TO_RUN.md) to bring the local stack up.
3. Pick Phase 3 (reminders) or Phase 5 (reader) — both have everything they need on the data + endpoint side.
4. Update this file as phases land.
