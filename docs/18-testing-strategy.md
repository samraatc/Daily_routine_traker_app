# 18 — Testing Strategy

> Maps to PRD section 21.
> **When to read:** Phase 1 (test scaffolding); whenever a new feature is being implemented.

The test strategy is a **pyramid**: many fast unit tests at the base, fewer integration tests in the middle, very few end-to-end tests at the top. This document defines what each layer covers, with which tool, against which threshold.

---

## 1. Test pyramid

```
                       ┌──────────────────┐
                       │   E2E (Maestro / │   slow, full system
                       │    Playwright)   │   ~20 flows
                       └──────────────────┘
                  ┌──────────────────────────┐
                  │  API integration         │   Supertest + Vitest
                  │  (all routes)            │   ~150 tests
                  └──────────────────────────┘
              ┌────────────────────────────────┐
              │  Component (RTL + jest-native) │   UI behaviour
              │                                │   ~250 tests
              └────────────────────────────────┘
        ┌──────────────────────────────────────────┐
        │  Unit (Vitest)                           │   pure logic
        │                                          │   ~600 tests
        └──────────────────────────────────────────┘
```

---

## 2. Layer-by-layer specification

### 2.1 Unit tests — Vitest

**Scope:** pure functions and business logic. No I/O.

**Coverage target:** > 80% lines across `apps/*/src/utils`, `apps/*/src/services`, and `packages/*`.

**Examples:**

- Streak engine edge cases (timezone, DST, skipped days).
- Reminder time computation across DST transitions.
- Idempotency key generation.
- Stats aggregations.
- Feature flag rollout hash determinism.
- Zod schema validation.

**Convention:** files named `*.test.ts` next to the source they test.

### 2.2 Component tests — React Testing Library + jest-native

**Scope:** mobile components in isolation. Mock all hooks that fetch data.

**Coverage target:** > 70% components.

**Examples:**

- `NeuButton` renders rest / pressed / disabled states.
- `TaskCard` calls `onComplete` when swiped right.
- `<RequireRole>` renders children or fallback.
- Reader `<FontSheet />` updates store state on change.
- Onboarding flow advances through screens.

**Convention:** `*.test.tsx` next to the component. Storybook stories double as visual regression bases.

### 2.3 API tests — Supertest + Vitest

**Scope:** every HTTP route. Hit the real Fastify instance against a test Postgres + Redis. Use Testcontainers (or a single shared docker-compose) for isolation.

**Coverage target:** **100% of routes**, including all RBAC edge cases.

**Examples:**

- `POST /tasks` happy path returns 201.
- `POST /tasks` with invalid body returns 422 with field errors.
- `PATCH /admin/users/:id` returns 403 for non-admin.
- `POST /completions` is idempotent on the same `(taskId, date)`.
- `DELETE /account` cascades correctly and creates a tombstone row.
- WebSocket: subscribing to `admin` topic as a `user` returns an error.

**Convention:** one test file per module under `apps/api/test/`.

### 2.4 E2E mobile — Maestro (preferred) or Detox

**Scope:** critical end-to-end flows on real device + emulator. Slow; only the most important paths.

**Coverage target:** every "Done when" flow in [`01-features.md`](01-features.md).

**Required flows:**

1. Sign up (email) → onboarding → create routine → mark task done.
2. Sign in (existing) → today tab → swipe to complete → see streak update.
3. Notification fires → tap Mark Done from lock screen → completion persists, app never opened.
4. Library → upload PDF → toggle public → moderator approves (separate session) → discover via search.
5. Reader → open online book → toggle offline → airplane mode → still readable.
6. Settings → export data → email arrives with signed URL.
7. Settings → delete account → cascade complete, sign-in fails.

**Convention:** flows in `apps/mobile/.maestro/flows/`. Run in CI on Android emulator (cloud) for `main`; daily on a physical-device cloud (BrowserStack / Sauce Labs) before release.

### 2.5 E2E admin — Playwright

**Scope:** the moderator and admin journeys through the web app.

**Required flows:**

1. Sign in as moderator → see queue → approve a book → book transitions to public.
2. Sign in as admin → create feature flag at 50% rollout → audit log records.
3. Sign in as admin → compose broadcast to a cohort of <1k → preview → send → progress completes.
4. Sign in as moderator → resolve a report → reporter sees resolution.

**Convention:** `apps/admin-web/e2e/`. Runs on every push to `main` plus pre-release.

### 2.6 Performance — Reassure (mobile) + Lighthouse (web)

**Scope:** per-screen render budgets and admin web Lighthouse scores.

**Targets:**

- Reassure: see budgets in [`17-non-functional.md`](17-non-functional.md) §3.
- Lighthouse: > 90 for performance, accessibility, best-practices, SEO.

**Trigger:** every PR. Regressions > 10% block merge.

### 2.7 Load — k6

**Scope:** API + workers under realistic load.

**Targets:**

- 1000 concurrent users for 30 min with no error spike.
- 10,000 concurrent users for 5 min (peak burst).
- API p95 stays < 250ms.

**Trigger:** weekly (CI), before each release.

### 2.8 Security — OWASP ZAP + npm audit + CodeQL

**Scope:**

- ZAP: every release, full auth-aware scan.
- `pnpm audit --audit-level=high`: every PR.
- CodeQL: every PR + nightly.
- `gitleaks` + secret scanning: every PR.

**Targets:** zero high-severity findings to merge.

---

## 3. Test data

### 3.1 Seed data for local + CI

`apps/api/prisma/seed.ts` produces a deterministic dataset:

- 1 super_admin (`super@example.com`)
- 1 admin (`admin@example.com`)
- 1 moderator (`mod@example.com`)
- 2 users (`alice@example.com`, `bob@example.com`)
- 9 BookCategory rows
- 5 sample books (mix of `private`, `pending_review`, `public`)
- 7 days of completion history for Alice (varied: some 100%, some 60%)

The same seed runs in CI for API tests — making fixtures shared and predictable.

### 3.2 Reader smoke-test corpus

10 PDFs + 10 EPUBs of varying complexity (scanned, text-rich, RTL, embedded fonts, large size, broken TOC). Stored in `apps/api/test/fixtures/books/`. Used in phase 5 acceptance tests.

### 3.3 Push notification test devices

A documented set of physical iOS + Android devices used to verify notification delivery. Their FCM/APNs tokens are in 1Password (not in code).

---

## 4. CI integration

| Stage | Tests run | Time budget |
|---|---|---|
| Pre-commit (local) | Lint + format + changed-file unit tests | < 10s |
| PR | Lint + type + unit + component + API + Reassure | < 8 min |
| Push to `main` | + Maestro mobile E2E + Playwright admin E2E + ZAP partial scan | < 25 min |
| Nightly | Load test (k6) + full ZAP + CodeQL | < 1 hour |
| Pre-release | All of the above + physical device runs | < 2 hours |

---

## 5. Test ownership

| Layer | Owner |
|---|---|
| Unit | Authoring engineer |
| Component | Authoring engineer + design review for visual states |
| API | Authoring engineer |
| Maestro E2E | QA engineer + collaborating mobile engineer |
| Playwright E2E | QA engineer + web engineer |
| Reassure | Mobile lead |
| Load | Backend lead + SRE |
| Security | Backend lead + external pen-test annually |

---

## 6. Flakiness policy

- A test that flakes twice in a 30-day window is **quarantined** (marked `.skip` with a tracking issue).
- Quarantined tests have a 14-day SLA to fix or delete.
- A test marked `.only` blocks merge (lint rule).

---

## 7. Mocking philosophy

- **Unit tests:** mock heavily — pure functions need no I/O.
- **Component tests:** mock data fetching hooks, but render the real component tree.
- **API tests:** mock external services (Clerk, FCM, S3 — using MinIO + nock); use the real Postgres + Redis.
- **E2E:** mock as little as possible. Use real backend.

If you find yourself mocking the same thing in many places, consider whether the abstraction is right.

---

## 8. Coverage report

Coverage is reported per package:

```
@app/api          92.4% lines  ✓
@app/mobile       83.1% lines  ✓
@app/admin-web    78.2% lines  ✗ (target 80%)
@app/types        100%  lines  ✓
@app/ui           75.4% lines  ✓ (target 70%)
```

Coverage trend is posted to a Slack channel weekly.

---

## 9. What we don't test (deliberately)

- **Generated code** (Prisma client, OpenAPI types) — covered by the libraries themselves.
- **Visual layout pixel-perfect** — Storybook + Chromatic (stretch); we trust design tokens.
- **Native modules' internal behaviour** — react-native-pdf, epubjs-rn are battle-tested by the community.

---

## 10. Acceptance test template

For every feature in [`01-features.md`](01-features.md):

```
## <feature> tests

- [ ] Unit: <core algorithm or schema validation>
- [ ] Component: <key UI states>
- [ ] API: <happy + auth + RBAC + error paths>
- [ ] E2E: <one critical flow>
- [ ] Performance: <relevant Reassure budget>
- [ ] Accessibility: <labels, focus, reduced motion>
```

The ticket is not ready for review without these.

---

## Next reading

- **Risks the tests guard against** → [`19-risks.md`](19-risks.md)
- **CI pipeline that runs them** → [`15-devops.md`](15-devops.md)
