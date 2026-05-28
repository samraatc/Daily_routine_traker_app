# 17 — Non-Functional Requirements

> Maps to PRD section 20.
> **When to read:** Phase 1 (set targets); end of every phase (verify); phase 8 (final gate).

Functional requirements describe **what** the product does. NFRs describe **how well**. Each requirement below has a measurable target and the mechanism by which we hit it. Targets are not aspirational — they gate the launch.

---

## 1. Master NFR table

| # | Requirement | Target | How achieved | Verified by |
|---|---|---|---|---|
| 1 | App cold start | < 2.5s on a mid-range Android (Samsung A-series, 4GB RAM) | Hermes engine, asset preloading, lazy screen imports, sync MMKV rehydrate | Per-release device-lab measurement |
| 2 | Animation perf | 60fps p95 (120fps where supported) | Reanimated worklets, no JS-thread animations, Reassure budgets in CI | Reassure + real-device traces |
| 3 | API latency | p95 < 250ms | Indexed Postgres queries, Redis cache, HTTP/2, p99 alerting | Grafana percentile dashboards |
| 4 | Offline support | Reading + completing tasks fully offline | MMKV-backed React Query cache, Notifee local reminders, queued mutations | Maestro flow with airplane mode |
| 5 | Accessibility | WCAG 2.1 AA | Labels, focus order, high-contrast theme, reduced motion, 44pt/48dp targets | Accessibility audit per release |
| 6 | Scalability | 100k MAU on launch infra | Stateless API, horizontal autoscale, connection pooling, Redis-backed counters | k6 load tests + soak |
| 7 | Reliability | 99.9% API uptime | Multi-AZ DB, health checks, auto-restart, blue/green deploys | Synthetic monitor 5-min interval |
| 8 | Privacy | GDPR + CCPA compliant | Export + delete endpoints, minimal collection, DPA in place | Legal review + audit |
| 9 | Crash-free sessions (mobile) | > 99.5% | Sentry monitoring + smoke tests before release | Sentry release dashboard |
| 10 | Push delivery rate | > 95% | FCM + APNs reliability, retries, stale-token cleanup | Custom worker counter |
| 11 | Reader page swipe | 60fps p95 | Skia for page-curl; deferred decode | Profiler on a mid-range device |
| 12 | First reader page (online, 5MB PDF) | < 3s on Wi-Fi | Ranged streaming, parallel cover + page fetch | Per-release measurement |
| 13 | Time to interactive (admin web) | < 2s on broadband | Next.js App Router, server components for the dashboard, edge caching for static | Lighthouse CI |
| 14 | DB query p95 | < 50ms for reads, < 100ms for writes | Indexed by query pattern, connection pool tuned | Postgres `pg_stat_statements` |
| 15 | Queue latency | Reminder fires within 5s of scheduled time | BullMQ delayed jobs, low contention worker pool | Custom telemetry |
| 16 | Bundle size (mobile) | < 50 MB on Android, < 80 MB on iOS | Image optimisation, no duplicate libs, expo prebuild | EAS build report per release |
| 17 | Initial download size (admin web) | < 250 KB JS gzipped | Next.js dynamic imports, RSC where possible | Lighthouse CI |

---

## 2. How we measure each (details)

### 2.1 Cold start (NFR #1)

- Measured from `applicationDidFinishLaunchingWithOptions` (iOS) / `Application.onCreate` (Android) to the first frame of the Today tab.
- Measured on a Samsung Galaxy A23 (Android) and an iPhone 12 (iOS) in airplane mode (no network calls).
- Captured via `expo-build-properties` startup metrics; manually verified each release.

### 2.2 Animation perf (NFR #2)

- Reanimated worklets log frame drops via `__reanimatedJSI` callbacks.
- Reassure runs in CI on representative interactions; a regression > 10% blocks merge.
- Real-device traces (Xcode Instruments + Android Studio Profiler) once per release.

### 2.3 API latency (NFR #3)

- Server-side timing via Fastify's `onResponse` hook → Prometheus histogram.
- p50 / p95 / p99 per route; alerts at p95 > 500ms over 10 minutes.
- Synthetic monitors hit critical routes from three geographic regions.

### 2.4 Offline (NFR #4)

- Maestro flow: enable airplane mode → complete task → cold restart → verify completion present → restore network → verify sync.
- Reader: airplane mode → open downloaded book → read → mark progress → restore network → verify progress synced.

### 2.5 Accessibility (NFR #5)

- Per release: run `react-native-accessibility-engine` static checks; manual VoiceOver / TalkBack walkthrough of critical flows.
- Storybook a11y addon flags issues at component level.
- WCAG audit checklist in `docs/runbooks/a11y-checklist.md` signed off pre-launch.

### 2.6 Scalability (NFR #6)

- k6 load test plan: ramp from 100 to 10,000 concurrent users on `/auth/login`, `/tasks`, `/completions`, `/books?scope=public`.
- Soak test for 4 hours at sustained 1000 RPS; memory + DB pool + Redis stay flat.

### 2.7 Reliability (NFR #7)

- Synthetic monitors (e.g., Checkly) ping `/health` from 3 regions every 1 minute.
- SLO budget: 99.9% = 43m of allowable downtime per month.
- Postmortems for every breach, filed in `docs/runbooks/postmortems/`.

### 2.8 Privacy (NFR #8)

- GDPR/CCPA self-assessment in `docs/legal/`.
- DPA (Data Processing Agreement) with each subprocessor (Clerk, Firebase, Sentry, AWS/Cloudflare, etc.).
- Quarterly review of data flows; map maintained as a Mermaid diagram in `diagrams/data-flows.mmd`.

### 2.9 Crash-free sessions (NFR #9)

- Sentry release tracking with source map uploads.
- Smoke test (Maestro) runs against the build artifact before App Store / Play Store submission.
- A regression of crash-free rate below 99.5% in TestFlight gates promotion to production.

---

## 3. Quality budgets per surface

| Surface | Cold open | Re-renders / interaction | Frame budget |
|---|---|---|---|
| Today tab | 800ms | 5 | 6ms |
| Library grid | 1.2s | 10 (per scroll page) | 6ms |
| Reader | 1.5s online / 0.8s offline | 3 (per page swipe) | 8ms |
| Stats | 600ms | 8 | 6ms |
| Settings | 400ms | 4 | 6ms |
| Modal sheet open | 200ms | 4 | 5ms |

These are enforced by Reassure tests in CI.

---

## 4. Infrastructure sizing (launch baseline)

| Component | Initial sizing | Auto-scale rule |
|---|---|---|
| API nodes | 2 × 1 vCPU / 2GB | Scale on CPU > 70% for 3 min; max 8 |
| Reminder workers | 2 × 0.5 vCPU / 1GB | Scale on queue depth > 1k; max 8 |
| Ingest workers | 1 × 1 vCPU / 2GB | Scale on queue depth > 50; max 4 |
| ClamAV sidecar | 1 × 1 vCPU / 2GB | One per ingest worker |
| Broadcast worker | 1 × 0.5 vCPU / 1GB | Scale on active broadcast; max 4 |
| Postgres | Managed, 2 vCPU / 4GB, 100GB SSD | Vertical scale; PITR backups |
| Redis | Managed, 1GB | Vertical scale to 4GB at 70% memory |
| S3 / R2 | Pay-as-you-go | — |

These cover ~50k MAU comfortably; 100k MAU requires ~2× the API + worker capacity.

---

## 5. Cost guardrails

| Item | Soft cap | Hard cap (alert) |
|---|---|---|
| API + workers | $400 / month at 100k MAU | $1000 |
| Postgres | $80 / month | $250 |
| Redis | $30 / month | $100 |
| S3 / R2 storage | $0.015 / GB | budget alert at $200/month |
| FCM / APNs | Free tier sufficient at launch | n/a |
| Sentry | Team plan | budget alert |

Cost dashboards reviewed monthly; anomalies are P2 incidents.

---

## 6. Accessibility detail (NFR #5 expanded)

### 6.1 Contrast

| Token combination | Light theme contrast | Dark theme contrast |
|---|---|---|
| `text.primary` on `bg.surface` | 12.6:1 | 11.4:1 |
| `text.secondary` on `bg.surface` | 4.8:1 | 4.6:1 |
| `accent.primary` text on white | 6.1:1 | (dark mode equivalent verified) |

All ratios verified with an automated tool (e.g., `axe-core`-equivalent for RN).

### 6.2 Touch targets

44 × 44 pt iOS, 48 × 48 dp Android. Enforced by Neumorphic primitives.

### 6.3 Screen reader experience

Every screen has a logical reading order. Modal sheets trap focus. Icon-only buttons have `accessibilityLabel`. Dynamic content uses `accessibilityLiveRegion`.

### 6.4 Reduced motion

Detected via `useReducedMotion()`. All animations have a fallback (see [`04-motion.md`](04-motion.md) §4.2).

### 6.5 Text scaling

The app respects the OS text-size setting up to 200%. Layouts are tested at 100%, 150%, 200%.

---

## 7. Internationalisation readiness

Even if English-only at launch:

- All UI strings live in `apps/mobile/src/i18n/locales/en.json` (and analog for admin web).
- No hard-coded strings in components.
- Date/time formatting via `Intl.DateTimeFormat` with the user's locale.
- Number formatting via `Intl.NumberFormat`.
- RTL support: layout uses `start` / `end` instead of `left` / `right` where possible.

Adding a new locale is a translation task, not an engineering task.

---

## 8. Time zone correctness (a quality concern in its own right)

Tasks, reminders, completions, and stats all involve the user's local time. A single timezone bug can break the streak engine. Therefore:

- `User.timezone` is captured at signup and editable in Settings.
- All scheduling computes in user-local time, stores in UTC.
- DST transition test suite runs on every PR that touches scheduling code.
- Property-based tests cover ±12h boundaries.

---

## 9. Long-tail device coverage

| Tier | iOS | Android | Strategy |
|---|---|---|---|
| Tier 1 (premium) | iPhone 14 Pro+ | Pixel 7+, Samsung S22+ | Hero motion, 120fps where supported |
| Tier 2 (mid-range) | iPhone 11+ | Samsung A-series, Pixel 6a | Targets above; baseline for perf budgets |
| Tier 3 (low-end) | iPhone SE 2 | < 3GB RAM Android | Graceful degradation: reduced motion auto-on, Skia disabled, smaller image sizes |

The app reads `expo-device` info and applies tier-aware defaults.

---

## 10. Quality gates per release

A release goes to production only if **all** of the following are true:

- [ ] All NFR targets above met or documented exceptions (with ADR).
- [ ] Crash-free sessions > 99.5% on internal TestFlight for 24 hours.
- [ ] No P0 / P1 bugs open.
- [ ] All Maestro flows green.
- [ ] All Playwright admin flows green.
- [ ] Reassure: no regression > 10%.
- [ ] Lighthouse score > 90 for admin web (perf, a11y, best-practices, SEO).
- [ ] OWASP ZAP scan: no high-severity findings.
- [ ] `pnpm audit`: no high-severity vulns.

---

## Next reading

- **Testing that verifies these NFRs** → [`18-testing-strategy.md`](18-testing-strategy.md)
- **Roadmap that schedules NFR checks** → [`16-roadmap.md`](16-roadmap.md)
