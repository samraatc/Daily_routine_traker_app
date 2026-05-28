# 16 — Development Phases & Timeline

> Maps to PRD section 19.
> **When to read:** Day 1 (planning). At the start and end of every phase.

The product is built in **8 phases over 12 weeks**. Each phase has clear scope, entry criteria (what must be in place before starting), exit criteria (what must be true to move on), the deliverables it produces, and the risks specific to that window.

Phases overlap by design — design work for phase N+1 runs while engineering closes out phase N.

---

## 1. Timeline at a glance

```
Wk  1   2   3   4   5   6   7   8   9   10  11  12
    │───│   1 Foundations
        │───│  2 Routines
            │───│  3 Reminders (wk5)
                │   │  4 Stats & Motion (wk6)
                    │───│  5 E-Book Reader (wk7-8)
                            │  6 Uploads & Library (wk9)
                                │  7 Admin Panel (wk10)
                                    │───│  8 Polish & Launch
```

---

## 2. Phase 1 — Foundations (weeks 1-2)

**Goal:** A monorepo where a developer can sign up, sign in, see a (mostly empty) home screen, and an admin can log into a (mostly empty) admin web app.

### Scope

- pnpm monorepo with `apps/mobile`, `apps/admin-web`, `apps/api`, `packages/ui`, `packages/types`, `packages/config`.
- Backend: Fastify boot, Prisma + Postgres + Redis local stack via Docker Compose.
- Auth: Clerk integration (mobile + admin web) OR Lucia fallback if chosen.
- Database: User + Streak + FeatureFlag + AuditLog tables migrated; seed script.
- Mobile: Expo Router with `(auth)` and `(tabs)` groups; sign-in / sign-up / onboarding skeleton.
- Admin web: Next.js shell with sign-in gated by Clerk; empty dashboard.
- Neumorphic design tokens: `packages/ui/theme/{light,dark,highContrast}.ts` complete with the tokens from [`03-design-system.md`](03-design-system.md).
- Core Neu primitives: `NeuButton`, `NeuCard`, `NeuInput`, `NeuToggle` with Storybook stories.
- CI: PR checks (lint, type, unit, audit, license) running green.

### Entry criteria

- PRD has been read by every engineer.
- Tech stack agreed (PRD §5 + [`02-tech-stack.md`](02-tech-stack.md)).
- Clerk (or Lucia) decision made and recorded in [`../DECISIONS.md`](../DECISIONS.md).
- AWS/Cloudflare accounts and Clerk org provisioned.

### Exit criteria

- A new user can sign up via the mobile app and reach the (empty) Today tab.
- The same user can sign into the admin web; they see "Not authorised" because their role is `user`.
- `pnpm dev` runs all services locally with one command.
- All PRs pass the static + unit + API test suite in CI.
- ARCHITECTURE.md exists and the team has read it.

### Deliverables

| Artefact | Owner |
|---|---|
| Monorepo on `main` with green CI | Backend lead |
| Sign-up + sign-in flow on iOS + Android | Mobile lead |
| Admin shell deployed to Vercel staging | Web lead |
| Neumorphic Storybook published | Design lead |
| ADR-0001: Clerk vs Lucia | Tech lead |

### Risks

| Risk | Mitigation |
|---|---|
| Clerk pricing / quota issues | Document Lucia fallback path early |
| EAS Build access not approved | Apply on day 1; use local builds in the interim |
| Postgres + Redis local setup friction | Single `docker-compose up` should "just work" |

---

## 3. Phase 2 — Routines (weeks 3-4)

**Goal:** A user can fully manage their daily routine — create tasks, mark them done, see streaks grow.

### Scope

- Task model + endpoints (`/tasks`, `/tasks/:id`, `/tasks/:id/reorder`).
- Completion model + endpoints (`POST /completions`, `DELETE /completions/:id`).
- Streak engine + transactional updates (see [`14-stats-engine.md`](14-stats-engine.md) §3).
- Mobile: Today tab with task list, swipe-to-complete, optimistic UI, drag-reorder.
- Task create / edit modal with category picker, time picker, repeat-day chips.
- StaggerList motion wrapper (preview of phase 4).
- React Query offline-first cache hydrated from MMKV.

### Entry criteria

- Phase 1 exit criteria met.
- Reanimated installed and `babel.config.js` updated.
- StaggerList component prototype reviewed by design.

### Exit criteria

- User can create a 7-task routine in <2 minutes.
- Marking a task done updates the streak immediately and the change persists across cold launches.
- Offline: tasks can be created and completed; sync resumes when reconnected.
- Maestro flow `sign-up → create-task → mark-done` passes on iOS + Android.
- Unit test coverage on the streak engine ≥ 95%.

### Deliverables

| Artefact | Owner |
|---|---|
| Task + Completion API with Supertest coverage | Backend |
| Today screen with optimistic UI | Mobile |
| StaggerList + TaskCard | Mobile + Design |
| Maestro flow #1 (routine basics) | QA |

### Risks

| Risk | Mitigation |
|---|---|
| Streak edge cases (timezone, DST, deleted tasks backfilling history) | Property-based tests in Vitest |
| Optimistic UI rolling back creates jank | Test with high latency simulator |

---

## 4. Phase 3 — Reminders (week 5)

**Goal:** Reminders fire reliably on time, on all devices, online and offline.

### Scope

- Reminder service + BullMQ queue.
- Reminder worker (`apps/api/workers/reminder.worker.ts`).
- Notifee setup on mobile; FCM + APNs registration via `@react-native-firebase/messaging`.
- `POST /notifications/devices` + `/inbox` endpoints.
- Local fallback scheduling on app start (next 14 days).
- Quiet hours support; `Task.quietHoursOverride` field.
- Snooze action (5/15/60 min).
- In-app banner overlay when foreground.
- The **Mark Done** action button on the lock screen.

### Entry criteria

- Phase 2 done.
- Firebase project provisioned; APNs key uploaded.
- Test devices (physical iOS + physical Android) available — emulators are not sufficient.

### Exit criteria

- A task scheduled for "9:00 tomorrow" fires at exactly that local time on both iOS and Android.
- Lock-screen Mark Done writes the Completion without opening the app.
- Quiet hours suppress sound but deliver silently.
- DST transition test: a task scheduled for 02:30 the night DST starts/ends fires at the correct UTC time.
- Snooze re-enqueues correctly and visibly.

### Deliverables

| Artefact | Owner |
|---|---|
| Reminder worker + Notifee local fallback | Backend + Mobile |
| Mark Done lock-screen action (iOS notification category + Android headless task) | Mobile |
| Snooze flow | Mobile |
| Maestro flow #2 (notification → mark done → return to home) | QA |
| DST + timezone test suite | Backend |

### Risks

| Risk | Mitigation |
|---|---|
| iOS background-fetch quotas | Use Notification Service Extension; document limitations |
| Token rotation (FCM / APNs) | Refresh on every cold launch; mark stale tokens server-side |
| Notification permission denial | App still works; fall back to in-app inbox; explain in onboarding |

---

## 5. Phase 4 — Stats & Motion (week 6)

**Goal:** Stats tab is alive. The whole app feels animated and tactile.

### Scope

- Stats endpoints: `/stats/weekly`, `/streaks`, `/categories`, `/reading`, `/consistency`.
- Stats tab: daily ring, weekly heatmap, category bars, consistency rate, streak badges.
- Hero scroll-fade on Today tab.
- Section-reveal motion on Stats tab.
- Shared-element transition for the streak flame between Today and Stats.
- Reduced-motion fallback paths.
- Reassure baselines captured.

### Entry criteria

- Phase 3 done.
- React Native Skia installed (needed in phase 5 too; install now).
- Reanimated v3 worklets working on both platforms.

### Exit criteria

- Stats screen renders in <200ms p95 from cache.
- All animations 60fps p95 on a mid-range Android.
- Reduced motion delivers a clean, non-broken UX.
- Reassure baselines committed.

### Deliverables

| Artefact | Owner |
|---|---|
| Stats engine endpoints | Backend |
| NeuRing, HeatmapGrid, StreakFlame, CategoryBars | Mobile + Design |
| Motion wrappers (`<ScrollHero>`, `<FadeInOnScroll>`, `<SharedFlame>`) | Mobile |
| Reassure baselines | Mobile |

### Risks

| Risk | Mitigation |
|---|---|
| Worklet capture bugs | Lint rule + worklet checker; CI runs e2e on a real device |
| Skia perf on low-end Android | Profile early; have a CSS fallback for non-critical surfaces |

---

## 6. Phase 5 — E-Book Reader (weeks 7-8)

**Goal:** Users can read books online and offline. Reading is delightful.

### Scope

- Book + ReadingProgress + BookDownload + Bookmark models + endpoints.
- S3 / R2 wiring + signed URLs.
- Mobile reader screen with `react-native-pdf` and `epubjs-rn`.
- Tap-to-toggle chrome; settings sheet; font size; line spacing; themes.
- Bookmarks, highlights, notes.
- Reading-position sync (debounced 5s).
- Offline mode: download → AES-256-GCM encryption → Storage Manager.
- Per-user key in Keychain / EncryptedSharedPreferences.
- Skia page-curl effect (with reduced-motion fallback).
- Reader smoke-test corpus (10 sample PDFs + 10 EPUBs of varied complexity).

### Entry criteria

- Phase 4 done.
- S3-compatible bucket provisioned (Cloudflare R2 preferred).
- Sample book corpus ready.

### Exit criteria

- A 400-page PDF online: first page visible <3s on Wi-Fi.
- Downloaded book opens offline in <1s.
- Page swipe stays at 60fps for PDF; 60fps for EPUB at default font.
- Highlight + note round-trip across two devices.
- All books in the smoke-test corpus open and paginate without errors.

### Deliverables

| Artefact | Owner |
|---|---|
| Reader module (pager, toolbar, font sheet, page-curl) | Mobile |
| Storage Manager screen | Mobile |
| Backend Book + ReadingProgress endpoints | Backend |
| Reader test corpus | QA |

### Risks

| Risk | Mitigation |
|---|---|
| EPUB CFI fragility across font changes | Round-trip test on the corpus; document known limitations |
| PDF text extraction inconsistencies | Mark scanned PDFs as "search disabled" gracefully |
| Storage cost surprises | Per-user quota enforced from day 1 |

---

## 7. Phase 6 — Uploads & Library (week 9)

**Goal:** Users can upload books and share them publicly via the community library.

### Scope

- `/books/upload-url` + `/books` registration endpoints.
- Upload pipeline: pre-signed URL → S3 PUT → ingest worker.
- ClamAV virus scan worker (sidecar container).
- Cover + metadata extraction in ingest worker.
- Visibility state machine (private → pending_review → public/rejected).
- Public library screen: categories, search, sorts, "Recommended for your routine".
- Report flow.
- 3-strike auto-re-review.

### Entry criteria

- Phase 5 done.
- ClamAV container reachable from the worker.
- Postgres FTS indexes created.

### Exit criteria

- A 50 MB PDF uploads end-to-end in <2 minutes on 4G.
- A virus-positive file is rejected and the file removed from S3.
- Search returns relevant public books within 100ms.
- Maestro flow `upload → toggle public → (moderator approves) → discover from another account` passes.

### Deliverables

| Artefact | Owner |
|---|---|
| Upload + ingest pipeline | Backend |
| Public Library mobile screen | Mobile |
| Report flow | Backend + Mobile |
| Maestro flow #3 (upload → publish) | QA |

### Risks

| Risk | Mitigation |
|---|---|
| Copyrighted content uploaded | Rights checkbox is enforced; reporting flow goes live with the feature |
| Large file uploads on flaky networks | Resumable upload (tus) as stretch; for v2.0, expose progress and let the user retry |

---

## 8. Phase 7 — Admin Panel (week 10)

**Goal:** Operators can fully run the platform from the admin web.

### Scope

- Next.js admin web pages: Dashboard, Moderation Queue, Users, Reports, Feature Flags, Broadcasts, Audit Log.
- WebSocket `/ws` events for live counts.
- RBAC server-side enforcement complete.
- 2FA mandatory for `moderator+`.
- Audit log writes on every privileged action.
- RN admin tab (slim) for moderation + users.

### Entry criteria

- Phase 6 done; there's actual content to moderate.
- 2FA configured for the first super_admin manually.

### Exit criteria

- A moderator can approve a book and the change is reflected in the user's mobile app within 5 seconds.
- A broadcast to a cohort of 1000 users delivers and shows progress.
- A feature flag toggle invalidates the mobile client cache within 60 seconds.
- Every privileged endpoint has a Supertest RBAC test.
- Playwright covers moderation + broadcast critical flows.

### Deliverables

| Artefact | Owner |
|---|---|
| Admin web (all pages) | Web |
| WS gateway + admin event topic | Backend |
| RN admin tab | Mobile |
| Playwright admin E2E | QA |

### Risks

| Risk | Mitigation |
|---|---|
| Privilege escalation bugs | Defence in depth: middleware + service + (eventually) RLS |
| Audit log floods | Sample read-only views; index aggressively |

---

## 9. Phase 8 — Polish & Launch (weeks 11-12)

**Goal:** v2.0 is in the App Store and Play Store.

### Scope

- Accessibility audit (WCAG 2.1 AA).
- Performance pass (cold start, animations, API p95).
- Localisation: English at minimum; one more locale stretch.
- App Store / Play Store assets (screenshots, descriptions, privacy labels).
- Final QA: regression test full feature matrix.
- TestFlight + Play Internal soft launch to ~1000 users.
- Sentry release marker + dashboards live.
- Runbooks (incident response) finalised.
- Marketing site (optional).

### Entry criteria

- All P0 features pass acceptance criteria from [`01-features.md`](01-features.md).
- Crash-free sessions > 99% in TestFlight internal.

### Exit criteria

- Apps approved by Apple + Google.
- Sentry rate of unique errors < 1 per 1000 sessions.
- All NFR targets in [`17-non-functional.md`](17-non-functional.md) met or documented exceptions.
- Soft launch healthy after 48h.
- Production runbooks signed off.

### Deliverables

| Artefact | Owner |
|---|---|
| Store listings + assets | Marketing + Design |
| Accessibility audit report | QA + Design |
| Performance report | Mobile |
| Runbooks | On-call lead |
| Launch retrospective | Tech lead |

### Risks

| Risk | Mitigation |
|---|---|
| App Store rejection | Submit a TestFlight build to App Review early in phase 8 to surface objections |
| Performance regressions found late | Reassure budgets enforced from phase 4 onward |
| Privacy label errors | Run through Apple's privacy label form together with legal before submission |

---

## 10. Cross-phase ongoing work

Some work doesn't fit neatly in a phase but happens continuously:

| Work | Cadence |
|---|---|
| Storybook stories for new components | Per PR |
| Updating [`../DECISIONS.md`](../DECISIONS.md) | When a default is chosen |
| Runbook writing | Per incident + per release |
| Security review of new endpoints | Per PR via the checklist |
| Translations (if multi-locale launch) | Continuous; freeze 1 week before release |

---

## 11. Phase summary template

At the end of each phase, the team posts a short summary in the project's wiki / `docs/phase-summaries/N.md`:

```
# Phase N summary

**Dates:** YYYY-MM-DD → YYYY-MM-DD
**Status:** Complete / Slipped / Cancelled

## Built
- ...

## Didn't get to
- ...

## Decisions made (link to DECISIONS.md entries)
- ...

## Risks remaining for next phase
- ...

## Demo
[link to video / TestFlight build]
```

This is what the engineering agent (or human team) prints after each phase, per the PRD's master-prompt execution plan.

---

## Next reading

- **Quality targets that gate each phase** → [`17-non-functional.md`](17-non-functional.md)
- **Testing that validates each phase** → [`18-testing-strategy.md`](18-testing-strategy.md)
- **Risks** → [`19-risks.md`](19-risks.md)
