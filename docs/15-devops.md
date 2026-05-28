# 15 — DevOps & Deployment Pipeline

> Maps to PRD section 18.
> **When to read:** Phase 1 (week 2) when CI is being wired up; phase 8 (weeks 11-12) for release.

This document specifies the path from a commit on a developer's laptop to a build live in TestFlight, Play Store, and the production API. Every stage exists for a reason — each is described below.

---

## 1. Pipeline overview

```
┌──────────┐  push     ┌────────┐  green  ┌──────────────┐  merge   ┌──────────────────┐
│ feature  │ ─────►    │   PR   │ ──────► │ static + test│ ────►   │   main branch    │
│  branch  │           │        │         │   pipeline   │         │  (CI green)      │
└──────────┘           └────────┘         └──────────────┘         └────────┬─────────┘
                                                                            │
                ┌───────────────────────────────────────────────────────────┤
                ▼                                                           ▼
        ┌────────────────┐                                       ┌────────────────────┐
        │ Backend build  │                                       │ Mobile build (EAS) │
        │ + deploy to    │                                       │ + admin web deploy │
        │ STAGING        │                                       │ (Vercel)           │
        └─────┬──────────┘                                       └────────┬───────────┘
              │                                                           │
              ▼                                                           ▼
       Smoke tests pass                                          Internal QA channel
              │                                                  (TestFlight + Play
              │                                                   Internal track)
              ▼                                                           │
       Manual approval                                                    │
              │                                                           │
              ▼                                                           ▼
        ┌────────────────┐                                       ┌────────────────────┐
        │ Backend → PROD │                                       │ Store submission   │
        │ + workers      │                                       │ (Fastlane)         │
        └────────────────┘                                       └────────────────────┘
```

---

## 2. Pipeline stages

### Stage 1 — Code push

| Rule | Enforcement |
|---|---|
| Feature branches only — `main` is protected | GitHub branch protection |
| Conventional commits (`feat:`, `fix:`, `chore:`, etc.) | `commitlint` in pre-commit + CI |
| Linear history (rebase, no merge commits) | Branch protection: "Require linear history" |
| Signed commits | Branch protection: "Require signed commits" |

### Stage 2 — Static checks (every PR)

Run in parallel:

| Check | Tool | Time budget |
|---|---|---|
| Type check | `tsc --noEmit` (each workspace) | 2 min |
| Lint | ESLint | 1 min |
| Format | Prettier `--check` | 30s |
| Detox/Maestro lint (mobile only) | `detox lint` | 30s |
| Dependency vulnerabilities | `pnpm audit --audit-level=high` | 30s |
| Secret scan | `gitleaks` | 30s |
| License check | `pnpm license-checker` against allowlist | 30s |

A failure on any of these blocks the PR.

### Stage 3 — Tests (every PR)

| Suite | Tool | Coverage target | Where |
|---|---|---|---|
| Unit | Vitest | > 80% across `apps/*` + `packages/*` | All workspaces |
| Component | RTL + jest-native | > 70% | `apps/mobile` |
| API | Supertest + Vitest | 100% of routes | `apps/api` |
| Perf budgets | Reassure | No > 10% regression | `apps/mobile` |

Mobile E2E (Maestro) and admin E2E (Playwright) run only on `main` to keep PR feedback fast.

### Stage 4 — Backend build & deploy to staging

When a PR merges to `main`:

1. GitHub Actions builds the API Docker image (multi-stage, < 200MB) tagged with the commit SHA.
2. Image pushed to the registry (GitHub Container Registry or AWS ECR).
3. Worker images built (one per worker) and pushed.
4. Railway / Fly.io picks up the new tags and rolls out to staging.
5. DB migration runs as a one-off job **before** the app rolls (Prisma `migrate deploy`).
6. Health-check probes the new pods; if any fails, rollout aborts.

### Stage 5 — Mobile builds (EAS)

On merge to `main` (or on a release tag):

- `eas build --profile preview --platform all` produces signed dev-client builds.
- On a `v*.*.*` tag: `eas build --profile production --platform all` produces store-ready binaries.
- Builds are uploaded to TestFlight (iOS internal) and the Play Store Internal Track automatically.

### Stage 6 — QA channels

| Channel | Audience | Promote how |
|---|---|---|
| TestFlight internal | Team + designated testers | Auto on every `main` build |
| Play Store Internal track | Same | Same |
| TestFlight external (beta) | Wider beta cohort (max 10k) | Manual promote |
| Play Store Closed track | Same | Manual promote |

QA testers exercise the demo flows in [`00-overview.md`](00-overview.md) §5 plus any feature-specific test plan.

### Stage 7 — Production release (manual approval)

| Surface | Gate |
|---|---|
| Backend | Manual approval in GitHub Actions environment `production` |
| Admin web | Auto-deploy to Vercel on `main` (staging) or on release tag (prod) |
| Mobile | `fastlane release` lane submits TestFlight build → App Store and promotes the Play Internal → Production |

Releases happen Tuesday or Wednesday morning UTC — never Friday afternoon.

### Stage 8 — Post-deploy

| Activity | Tool |
|---|---|
| Release tracking | Sentry release tag with source maps uploaded |
| Smoke tests | Synthetic monitors hit critical endpoints every minute |
| Auto-rollback | If error rate > 2× baseline for 10 min, the previous Docker tag is redeployed |
| Dashboards | Datadog / Grafana — request rate, error rate, latency, queue depth |

---

## 3. GitHub Actions workflows

`.github/workflows/`:

| File | Trigger | What it runs |
|---|---|---|
| `pr-check.yml` | pull_request | Static checks + unit + component + API tests + perf |
| `e2e-mobile.yml` | push to `main` | Maestro E2E flows on a hosted Android emulator |
| `e2e-admin.yml` | push to `main` | Playwright E2E for admin |
| `api-deploy-staging.yml` | push to `main` | Build & deploy API + workers to staging |
| `api-deploy-prod.yml` | release tag `v*.*.*` | Deploy to prod with environment approval |
| `mobile-build.yml` | push to `main` or release tag | EAS Build (preview or production) |
| `admin-deploy.yml` | push to `main` (staging) / tag (prod) | Vercel deploy |
| `security-scan.yml` | nightly | OWASP ZAP + npm audit + CodeQL |
| `dependabot.yml` | weekly | Renovate / Dependabot opens dependency PRs |

---

## 4. Environments

| Environment | Purpose | URL |
|---|---|---|
| Local | Developer machines | `http://localhost:4000`, Expo dev client |
| Preview | One per PR (API only) | `https://api.pr-<num>.<domain>` |
| Staging | Pre-prod testing | `https://api.staging.<domain>` + Vercel staging |
| Production | Live | `https://api.<domain>`, store apps |

Each environment has:

- Its own Postgres database (no shared schemas).
- Its own Redis (separate cluster or DB index).
- Its own S3 bucket prefix.
- Its own Clerk instance + FCM/APNs project.

---

## 5. Secrets

Stored in Doppler (or AWS Secrets Manager), pulled into:

- GitHub Actions via `doppler secrets download` step
- Runtime via Doppler's runtime injection (no `.env` files on disk in prod)

Local development uses `.env.local` (gitignored). A `.env.example` lives in each app, listing required vars.

Rotation policy is documented in [`13-security-privacy.md`](13-security-privacy.md) §9.

---

## 6. Database migrations

| Rule | Why |
|---|---|
| Migrations run **before** the new app code rolls | Old code must work against new schema |
| Migrations are **reversible** unless explicitly approved | Safe rollback |
| Destructive migrations require an ADR | Force the team to think |
| Long-running migrations use Prisma's `migrate dev --create-only` + manual SQL splits | Avoid lock contention |

The pattern for breaking changes is two-step:

1. Add new column / table; deploy code that writes both old and new.
2. Backfill (separate script).
3. Switch code to read from new.
4. Drop old column (separate migration).

---

## 7. Mobile binary signing

| Platform | Cert / key | Storage |
|---|---|---|
| iOS | Apple distribution cert + provisioning profile | EAS-managed (Apple Developer account access via CI secret) |
| Android | Upload key + Play App Signing | Upload key in EAS; Play handles app-signing key |

`fastlane match` is the alternative for teams that prefer self-managed certs. Either works.

---

## 8. Release branches & versioning

- We use a trunk-based workflow with release tags, **not** long-lived release branches.
- Mobile app version follows SemVer (`MAJOR.MINOR.PATCH`).
- Backend version is the git SHA; clients are forward-compatible across minor versions.
- A release tag (`v2.0.0`) triggers:
  - Backend production deploy
  - Mobile store submission
  - Sentry release marker
  - Changelog entry generation (from conventional commits)

---

## 9. Local development

`docker-compose up` brings Postgres, Redis, MinIO, MailHog, and ClamAV up. Then:

```
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm dev` runs API + admin web + Expo dev server concurrently. Mobile dev requires Xcode (iOS) or Android Studio (Android).

A `pnpm fresh` command resets all local state (Docker volumes, MMKV, simulator) — useful when debugging onboarding.

---

## 10. Monitoring & alerts

| Signal | Tool | Alert threshold |
|---|---|---|
| API 5xx rate | Grafana | > 1% over 5 min → pager |
| API p95 latency | Grafana | > 500ms over 10 min → pager |
| Queue depth (reminders) | Grafana | > 10k jobs backlog → pager |
| Crash-free sessions | Sentry | < 99% over 1h → pager |
| FCM delivery rate | Custom | < 95% over 15 min → pager |
| Disk usage on DB | Grafana | > 80% → on-call notification |
| TLS cert expiry | Synthetic | < 30 days → engineering notification |

On-call rotation is configured in PagerDuty (or equivalent).

---

## 11. Rollback procedures

| Surface | Procedure |
|---|---|
| Backend | Redeploy previous Docker tag (`api-deploy-prod.yml` accepts a `tag` input) |
| Workers | Same |
| Admin web | Vercel one-click revert |
| Mobile | Cannot roll back app-store binaries — fix forward; emergency feature-flag disable instead |
| Database | PITR (point-in-time recovery) via managed Postgres backup |

Feature flags (see [`07-admin-panel.md`](07-admin-panel.md) §3.5) are the primary rollback tool for mobile features.

---

## 12. Bill of materials per release

Every release ships with:

- Conventional-commit changelog (`CHANGELOG.md`).
- Bundle size delta (mobile) compared to previous release.
- Coverage report comparison.
- List of feature flags toggled at release.

These are appended to the release notes automatically.

---

## Next reading

- **The 12-week phase plan that this pipeline supports** → [`16-roadmap.md`](16-roadmap.md)
- **What gets tested** → [`18-testing-strategy.md`](18-testing-strategy.md)
- **Security hardening for the pipeline** → [`13-security-privacy.md`](13-security-privacy.md)
