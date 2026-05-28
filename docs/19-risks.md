# 19 — Risks & Mitigations

> Maps to PRD section 22.
> **When to read:** Phase 1 (initial register); reviewed at the start of every phase; quarterly post-launch.

A risk register is only useful if it's revisited. This document is the live register: each risk has an owner, a current status, and the concrete mitigations in place. Risks are sorted by **inherent severity** (likelihood × impact) before mitigation.

The PRD calls out six top risks; this document expands each and adds the operational risks discovered during planning.

---

## 1. Risk scoring

| Likelihood | Definition |
|---|---|
| High | Expected during the launch window |
| Medium | Plausible — has happened in similar products |
| Low | Edge case — would surprise us |

| Impact | Definition |
|---|---|
| High | Launch blocker, legal exposure, or user data harm |
| Medium | Degraded experience, manual cleanup required |
| Low | Cosmetic; fix-in-flight |

---

## 2. Risk register (sorted by severity)

### 2.1 Copyrighted material uploaded to the public library

| Field | Value |
|---|---|
| Likelihood | Medium |
| Impact | High |
| Severity | **HIGH** |
| Owner | Trust & Safety lead (operator: Ravi) |

**Mitigations:**

- Mandatory rights checkbox at publish time; timestamp stored in `Book.rightsAcceptedAt` ([`06-uploads-public-library.md`](06-uploads-public-library.md) §4).
- ClamAV scan + size cap + content-type validation on every upload.
- Moderation review required before any book becomes public; templated rejection reasons.
- In-app report flow with auto-escalation after 3 reports.
- DMCA-style takedown email (`dmca@<domain>`) monitored by Trust & Safety.
- Takedown action documented in admin runbook with target turnaround < 24 hours.
- Public terms of service explicitly disallow copyrighted uploads.

**Residual risk:** A first-time uploader can still publish copyrighted material between upload and moderation. Median exposure < 4 hours (per moderation SLA) for new uploaders. Acceptable with the report-driven takedown net.

### 2.2 Push-notification deliverability gaps on iOS

| Field | Value |
|---|---|
| Likelihood | Medium |
| Impact | High |
| Severity | **HIGH** |
| Owner | Mobile lead |

**Mitigations:**

- Layered delivery: APNs (primary) + Notifee local fallback (offline). Deduplication via deterministic `notificationId` per task per minute ([`08-push-notifications.md`](08-push-notifications.md) §4).
- Idempotent `POST /completions` so duplicate Mark Done actions do not double-count.
- Stale token cleanup after first delivery failure.
- Per-platform monitoring: alerts on FCM and APNs delivery rates dropping below 95%.
- Notification Service Extension on iOS to enable rich actions.

**Residual risk:** Apple still throttles per-device push at extreme volumes (which we are nowhere near at launch). Documented in the operations runbook.

### 2.3 EPUB/PDF rendering edge cases break the reader

| Field | Value |
|---|---|
| Likelihood | Medium |
| Impact | Medium |
| Severity | **MEDIUM** |
| Owner | Mobile lead |

**Mitigations:**

- Use battle-tested libraries (`react-native-pdf`, `epubjs-rn`).
- Reader smoke-test corpus (10 PDFs + 10 EPUBs of varied complexity) runs in CI per release.
- Graceful degradation: rasterised PDFs show "search disabled"; broken TOC falls back to page numbers.
- Embedded JS in EPUBs is stripped during ingestion.

**Residual risk:** A user uploads an exotic file that the library cannot render. The book gets a clear error message and reader exits cleanly; not a crash.

### 2.4 Storage cost growth from public library

| Field | Value |
|---|---|
| Likelihood | Low |
| Impact | Medium |
| Severity | **MEDIUM** |
| Owner | Backend lead |

**Mitigations:**

- Per-user upload quota (100 books or 5 GB).
- 12-month cold-storage migration for books with zero activity.
- Per-user download rate limit (50 books/day).
- Cost dashboard with alert at $200/month storage.
- R2 chosen over S3 specifically for zero egress (mitigates the worst cost curve).

**Residual risk:** A viral piece of public content drives unexpected reads. Cold-storage tier handles this transparently with a small latency penalty.

### 2.5 Admin abuse / privilege escalation

| Field | Value |
|---|---|
| Likelihood | Low |
| Impact | High |
| Severity | **MEDIUM-HIGH** |
| Owner | Security lead |

**Mitigations:**

- Defence in depth: RBAC middleware + service re-check + Prisma tenancy extension + DB grants (no UPDATE/DELETE on audit_log).
- 2FA mandatory for `moderator+` ([`13-security-privacy.md`](13-security-privacy.md) §2.4).
- Step-up re-auth required for sensitive actions (5-min freshness).
- Immutable AuditLog shipped to cold storage every 5 min.
- Least-privilege role hierarchy; super_admin manually provisioned only.
- Quarterly access review.

**Residual risk:** A compromised admin account can still cause damage during the response window. The audit log makes the blast radius bounded and recoverable.

### 2.6 Performance regression with heavy motion

| Field | Value |
|---|---|
| Likelihood | Medium |
| Impact | Medium |
| Severity | **MEDIUM** |
| Owner | Mobile lead |

**Mitigations:**

- Reanimated worklets only — no JS-thread animations ([`04-motion.md`](04-motion.md) §4.1).
- Per-PR Reassure perf budgets; > 10% regression blocks merge.
- Real-device traces every release.
- Reduced-motion auto-on for low-tier devices ([`17-non-functional.md`](17-non-functional.md) §9).
- Skia confined to the reader's page-curl.

**Residual risk:** A specific Android OEM's hardware quirk we haven't tested. The device tiering helps, and feature flags allow disabling motion remotely.

---

## 3. Additional risks identified during planning

### 3.1 Time-zone / DST bugs corrupting streaks

| Likelihood | Medium |
|---|---|
| Impact | Medium |
| Owner | Backend lead |

Streak corruption is a trust killer (users notice when their streak resets unfairly).

**Mitigations:**

- Scheduling code uses Luxon with explicit IANA timezones.
- DST property-based test suite runs on every PR touching scheduling.
- Streak recompute is bounded to 365 days lookback (limits blast radius of any bug).

### 3.2 Mobile cold-start regression

| Likelihood | Medium |
|---|---|
| Impact | Medium |
| Owner | Mobile lead |

App-store users abandon at 2 second startup.

**Mitigations:**

- Hermes engine enabled.
- Lazy-loaded admin screens.
- Sync MMKV rehydrate (no async on hot path).
- Cold-start measured per-release on a Samsung A23 (mid-range Android reference device).
- Bundle size delta reported per release.

### 3.3 Reader encryption-key loss on device

| Likelihood | Low |
|---|---|
| Impact | Low (re-download solves it) |
| Owner | Mobile lead |

If Keychain entry is wiped (factory reset, OS bug), offline books become unreadable.

**Mitigations:**

- Documented user-facing message: "Your downloaded books need to be re-downloaded."
- Auto-detect corrupt files (auth tag mismatch) and force re-download.
- Reading position is on the server, so progress is preserved.

### 3.4 OAuth provider outage

| Likelihood | Low |
|---|---|
| Impact | Medium |
| Owner | Backend lead |

Google / Apple OAuth can have multi-hour outages; users cannot sign in.

**Mitigations:**

- Email + password is always available.
- Clear "Try email instead" copy on auth screens.
- Status banner on the app from a remote config endpoint.

### 3.5 Clerk dependency lock-in

| Likelihood | Low |
|---|---|
| Impact | Medium |
| Owner | Backend lead |

Pricing change or service issue from Clerk could disrupt auth.

**Mitigations:**

- Lucia + JWT fallback documented in ADR-0001.
- Migration plan in `docs/runbooks/auth-provider-migration.md`.

### 3.6 Firebase / FCM project quota exhaustion

| Likelihood | Low |
|---|---|
| Impact | High |
| Owner | Backend lead |

Free-tier FCM is generous but not infinite.

**Mitigations:**

- Notification volume monitoring; auto-throttle the broadcast worker when approaching limits.
- Upgrade to paid Firebase plan documented in operations runbook.

### 3.7 Onboarding drop-off

| Likelihood | High |
|---|---|
| Impact | Medium |
| Owner | Product + Mobile lead |

Users who don't finish onboarding never become habit users.

**Mitigations:**

- 4-screen onboarding (≤ 90s).
- Notifications permission with a clear explainer; skippable.
- Skip-to-end always available.
- Funnel instrumentation in analytics to track drop-off per screen.

### 3.8 Privacy / GDPR fine

| Likelihood | Low |
|---|---|
| Impact | High |
| Owner | Legal + Security lead |

A botched data-subject request or breach notification triggers a fine.

**Mitigations:**

- `GET /account/export` and `DELETE /account` implemented from phase 8 onward.
- 72-hour breach notification runbook.
- DPAs with all subprocessors.
- Annual DPIA (Data Protection Impact Assessment).
- Privacy policy reviewed by legal before launch.

### 3.9 App Store rejection

| Likelihood | Medium |
|---|---|
| Impact | High (launch slip) |
| Owner | Mobile lead + Product |

Apple's review process has rejected reader apps before for various reasons (in-app purchase rules, content moderation).

**Mitigations:**

- Submit a TestFlight external build for App Review in phase 8 week 1, **not** the launch week.
- Pre-flight checklist: privacy labels filled in, age rating correct, no objectionable seed content.
- Free tier with no IAP at launch avoids the IAP review angle.
- User-generated content disclosed clearly in App Store listing (per App Store guidelines 1.2).

### 3.10 Vendor outage cascading

| Likelihood | Medium |
|---|---|
| Impact | Medium |
| Owner | SRE lead |

A single vendor (Cloudflare, AWS region, Clerk, Firebase) outage can cascade.

**Mitigations:**

- Status page reads multiple vendor statuses.
- Read-only degraded mode: if Clerk is down, in-flight users (with valid JWT) keep working.
- Reading from downloaded books works fully offline.
- Cached stats render even with API down.

---

## 4. Risk review cadence

| Cadence | Activity |
|---|---|
| Weekly (during build) | Phase lead reviews open risks at standup; updates status |
| End of phase | Full register reviewed; new risks added |
| Pre-launch (phase 8) | Comprehensive review by tech lead + security lead |
| Quarterly (post-launch) | Risk register revisited; severity scores re-evaluated |
| After every incident | Affected risks updated; new risks captured |

---

## 5. Quick scoreboard

| Risk | Severity | Owner | Status |
|---|---|---|---|
| Copyrighted uploads | HIGH | T&S | Mitigations designed; activate in phase 6 |
| Push deliverability (iOS) | HIGH | Mobile | Mitigations designed; verify in phase 3 |
| Admin privilege escalation | MED-HIGH | Security | Defence-in-depth designed; verify in phase 7 |
| Reader rendering edge cases | MED | Mobile | Corpus + smoke tests in phase 5 |
| Storage cost | MED | Backend | Quotas + cold storage from phase 6 |
| Motion perf regression | MED | Mobile | Reassure budgets from phase 4 |
| TZ / DST corruption | MED | Backend | Property tests from phase 3 |
| Cold start regression | MED | Mobile | Measure per release from phase 1 |
| OAuth outage | LOW-MED | Backend | Email fallback always available |
| App Store rejection | LOW-MED | Product | TestFlight external in phase 8 week 1 |

---

## Next reading

- **Where each risk is addressed in the architecture** → [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- **Roadmap that schedules the mitigations** → [`16-roadmap.md`](16-roadmap.md)
