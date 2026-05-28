# 08 — Push-Notification Reminder System

> Maps to PRD section 11.
> **When to read:** Phase 3 (week 5).

Reminders are **mission-critical** for habit formation. If a reminder fails to fire, a user misses their streak, and the product fails them. This system is layered for reliability across iOS and Android, online and offline.

---

## 1. System overview

```
┌─────────┐     enqueue      ┌──────────────┐  fire   ┌──────────────┐
│  User   │  ─────►─────►    │   BullMQ     │ ─────► │  Reminder    │
│  toggles│   per-task time  │   delayed    │        │  Worker      │
│ Remind  │                  │   jobs       │        └──────┬───────┘
└─────────┘                  └──────────────┘               │
                                                            ▼
                                                     ┌──────────────┐
                                                     │ Quiet hours? │
                                                     └──────┬───────┘
                                                            │ no
                                                            ▼
                                              ┌─────────────────────────┐
                                              │  Send via FCM (Android) │
                                              │      or APNs (iOS)      │
                                              └─────────┬───────────────┘
                                                        │
                          ┌─────────────────────────────┼────────────────────┐
                          ▼                             ▼                    ▼
                  [foreground app]              [background app]        [device offline]
                  in-app Neumorphic             system push with          local Notifee
                  banner overlay                "Mark Done" action        fallback fires
                                                button
                                                        │
                                          tap "Mark Done"
                                                        ▼
                                                POST /completions
                                                (no app open required)
```

---

## 2. Reminder lifecycle

| Stage | Actor | What happens |
|---|---|---|
| 1. **Create / edit task** | Client | User toggles "Remind me" + sets time + repeat days. PATCH `/tasks/:id` includes `remindEnabled: true` |
| 2. **Schedule** | API | After commit, computes next N occurrences (next 14 days) in user's timezone and enqueues delayed BullMQ jobs |
| 3. **Wait** | Redis | Job waits in `reminders` queue until its `delay` elapses |
| 4. **Fire** | Worker | Worker picks up job; checks task still exists, not soft-deleted, user not suspended, not in quiet hours |
| 5. **Send** | Worker | Constructs FCM (Android) or APNs (iOS) payload; sends via firebase-admin / apn |
| 6. **Receive** | Device | Push delivered; if foreground, the in-app banner shows; if background, system notification |
| 7. **Action** | User | Taps **Mark Done**; calls `POST /completions` directly |
| 8. **Log** | API | `NotificationLog.openedAt` updated; `Completion` row written |
| 9. **Reschedule** | API | After firing, the next occurrence (day N+14) is enqueued, keeping a rolling 14-day window |

---

## 3. Server-side scheduling

### 3.1 Job structure

```ts
queue.add('reminder', {
  userId, taskId, deviceTokens, payload,
}, {
  jobId: `reminder:${taskId}:${YYYYMMDDHHMM}`,
  delay: msUntilFire,
  removeOnComplete: 100,
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 },
});
```

The `jobId` is deterministic per task per minute → idempotent re-enqueue is a no-op.

### 3.2 Why a 14-day rolling window

- Avoids storing millions of jobs in Redis.
- Tasks can be edited without re-scheduling years of jobs.
- After firing, the worker enqueues day-15 — keeping the window fresh.

### 3.3 Timezone correctness

User's timezone lives in `User.timezone` (IANA, e.g., `Asia/Kathmandu`). Jobs are scheduled in UTC but computed from the user's local time:

```ts
const localFireTime = DateTime.fromObject(
  { year, month, day, hour, minute },
  { zone: user.timezone }
);
const utcFireTime = localFireTime.toUTC();
const delay = utcFireTime.diff(DateTime.utc()).as('milliseconds');
```

Tested across DST transitions — see [`18-testing-strategy.md`](18-testing-strategy.md).

### 3.4 Idempotency

If the same task fires twice (race condition between server push and local Notifee), the **completion endpoint deduplicates** via:

```
UNIQUE(taskId, userId, completedAt::date)
```

The second call returns 200 (the existing completion) — never 409.

---

## 4. Device-side: local Notifee fallback

Server-side scheduling fails when:

- The device is offline at fire time.
- FCM/APNs are throttled or have transient outages.
- The user's device token is stale (uninstall/reinstall).

To survive these, the mobile client **also** schedules a local notification via Notifee for every task with `remindEnabled = true`.

### 4.1 Deduplication

The local and server pushes carry the same `notificationId` (deterministic from `taskId + YYYYMMDDHHMM`). The OS deduplicates pushes with the same identifier — the user sees exactly one notification.

When the user taps **Mark Done**, the completion endpoint is idempotent (section 3.4), so even if both fire the data is correct.

### 4.2 When the local fallback re-schedules

On every app launch, the mobile client:

1. Fetches the current task list from cache (instant).
2. Cancels all local notifications.
3. Re-schedules the next 14 days locally.

This keeps the local copy in sync with edits made on other devices.

### 4.3 Notifee categories

- iOS: A `notification category` with the `MARK_DONE` action is registered at app start.
- Android: A notification channel with HIGH importance + the `MARK_DONE` action.

The action button label is localised.

---

## 5. Quiet hours

| Setting | Default | Where it lives |
|---|---|---|
| Global quiet hours | 22:00 → 07:00 user-local | `User.quietHoursStart`, `User.quietHoursEnd` |
| Per-task override | off | `Task.quietHoursOverride` (true = ignore quiet hours for this task) |
| Per-category mute | none | `User.mutedCategories: string[]` |

Behaviour during quiet hours:

- **Reminders** that fall inside the window are sent as **silent push** (no sound, no banner; appears in notification centre).
- **Broadcasts** sent in audience-cohort mode respect the user's local quiet hours unless flagged as `urgent` (super_admin only).
- The app respects the OS Do Not Disturb setting **in addition** to in-app quiet hours.

---

## 6. Snooze

When the user pulls down a reminder, three actions are available:

- **Mark Done** — primary
- **Snooze 5 min** — re-enqueue with `delay = 5min`
- **Snooze 15 min** — re-enqueue with `delay = 15min`
- **Snooze 60 min** — re-enqueue with `delay = 60min`

Snoozed jobs use the same `jobId` template but with an incremented snooze counter — so a user can snooze repeatedly.

After 3 snoozes the snooze options no longer appear (gentle nudge away from infinite procrastination).

---

## 7. Device token management

| Event | Action |
|---|---|
| App install + permission granted | `POST /notifications/devices` with `{ token, platform, locale, appVersion }` |
| Token rotation (FCM/APNs may rotate) | Same endpoint with new token; old is marked stale |
| Sign out | `DELETE /notifications/devices/:id` — token removed from server |
| Push to invalid token (FCM "NotRegistered" / APNs "BadDeviceToken") | Worker marks token stale; user remains scheduled but no push sent until a fresh device registers |
| User has multiple devices | All active tokens receive the same push (per-user fan-out) |

---

## 8. Broadcast notifications

Broadcasts are admin-initiated (see [`07-admin-panel.md`](07-admin-panel.md) section 3.6).

| Aspect | Behaviour |
|---|---|
| Audience selection | All / by timezone / by role / by last-active / by has-completed-X |
| Scheduling | Send now OR per-user local time |
| Quiet hours | Respected unless `urgent` flag set (super_admin only) |
| Rate limit | One broadcast per cohort per hour; super_admin override |
| Approval | Audiences > 10k require super_admin co-sign |
| Delivery tracking | Per-user `NotificationLog` rows record `sentAt`, `deliveredAt`, `openedAt` |

Broadcasts also write an in-app inbox entry so users who miss the push can read the message later.

---

## 9. Failure modes & retries

| Failure | Behaviour |
|---|---|
| Worker crashes mid-job | BullMQ retries up to 3× with exponential backoff |
| Firebase/APNs unavailable | Retries 3× over ~5 minutes; if still failing, falls back to in-app inbox + relies on local Notifee |
| Device token rejected | Mark stale; do not retry that token; other devices for the same user still attempt |
| User's app version unsupported | Push lands in inbox; user prompted to update |

---

## 10. Observability

| Signal | Surface |
|---|---|
| Jobs queued / processed / failed per minute | Grafana dashboard |
| FCM delivery rate (Android) | Firebase console + Grafana mirror |
| APNs success rate | Custom counter from APN response |
| Mean time from scheduled fire to device delivery | Grafana percentile chart |
| Notifications opened / dismissed | `NotificationLog.openedAt` analytics event |

If `delivery_rate < 95%` for 15 minutes, an alert pages on-call.

---

## 11. Permissions and UX considerations

- iOS requires explicit notification permission — requested during onboarding screen 3.
- Android 13+ also requires `POST_NOTIFICATIONS` runtime permission.
- If permission denied, the app still functions; reminders silently fall back to in-app banners only.
- A Settings entry explains permission state and deep-links to OS settings if revoked.

---

## 12. Test scenarios required

| Scenario | Coverage |
|---|---|
| Schedule reminder, fire at correct UTC time across DST | Vitest with mock timezone library |
| Both server push and local Notifee fire → user sees one notification | E2E (Maestro) on physical device |
| Mark Done from notification creates one Completion row | Maestro + Supertest |
| Quiet hours suppress sound but keep silent delivery | Worker test |
| Stale token rejected, other devices still receive | Worker test |
| Snooze re-enqueues with correct delay | Vitest |
| User signs out → tokens removed | Supertest |

---

## Next reading

- **Backend architecture (where the workers live)** → [`12-backend-architecture.md`](12-backend-architecture.md)
- **Endpoints** → [`10-api-contracts.md`](10-api-contracts.md) (`/notifications/*`)
- **Reminder flow diagram** → [`../diagrams/reminder-flow.mmd`](../diagrams/reminder-flow.mmd)
