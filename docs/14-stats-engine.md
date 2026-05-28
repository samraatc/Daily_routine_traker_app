# 14 — Stats & Results Engine

> Maps to PRD section 17.
> **When to read:** Phase 4 (week 6) when the stats screen is built.

The Stats engine turns raw `Completion` and `ReadingProgress` rows into the eight metrics that drive the Home tab and the Stats tab. This document specifies each metric's formula, where it is computed, how it is cached, and how it is surfaced.

---

## 1. Metric catalogue

| # | Metric | Formula | Surface | Refresh |
|---|---|---|---|---|
| 1 | **Daily progress** | `done ÷ total today × 100%` | Neumorphic circular ring (Home tab) | Live (client recompute after every Completion mutation) |
| 2 | **Current streak** | Consecutive days with `done == total` (or all skipped) | Flame badge | Server, recomputed on each completion |
| 3 | **Best streak** | `MAX(Streak.longestStreak)` historical | Trophy badge | Server |
| 4 | **Category score** | `done ÷ total per category` over last 7 days | Horizontal Neu-bars | Server, 5-min cache |
| 5 | **Weekly heatmap** | Completion % per day for last 7 days | 7-cell color grid | Server, 5-min cache |
| 6 | **Reading minutes** | `SUM(ReadingProgress.secondsRead) / 60` per day | Bar chart (7d or 30d) | Server, 5-min cache |
| 7 | **Books finished** | `COUNT(ReadingProgress WHERE percent >= 100)` | Trophy carousel | Server |
| 8 | **Consistency rate** | `% of scheduled days done` over last 30 days, trend arrow vs. previous 30 | Percent + arrow | Server, 1-hour cache |

---

## 2. Where each metric lives in code

| Metric | Module / endpoint |
|---|---|
| 1 — Daily progress | client-side reducer in `useTasks()` |
| 2 — Current streak | `apps/api/src/modules/stats/streak.service.ts` + included in `POST /completions` response |
| 3 — Best streak | `GET /stats/streaks` |
| 4 — Category score | `GET /stats/categories?period=week` |
| 5 — Weekly heatmap | `GET /stats/weekly` |
| 6 — Reading minutes | `GET /stats/reading?period=week\|month` |
| 7 — Books finished | `GET /stats/books-finished` |
| 8 — Consistency rate | `GET /stats/consistency` |

---

## 3. Streak engine in detail

### 3.1 What counts as a "completed day"

A scheduled day is **completed** when, for every task scheduled that day, the user has either:

- a `Completion` row with `skipped = false`, or
- a `Completion` row with `skipped = true` (counts toward closing the day but does NOT add to streak)

If even one scheduled task has no row, the day is **incomplete**.

A day with zero scheduled tasks is **neutral** — neither breaks nor extends a streak.

### 3.2 Update procedure (server-side)

After every `POST /completions` or `DELETE /completions/:id`, run:

```
function updateStreak(userId):
  Δ = today's local date in user's timezone
  while Δ has Completions matching the rules:
    if Δ is fully completed (no missing, no skipped-only):
      streak += 1
      Δ = previous day
    else if Δ is neutral:
      Δ = previous day
    else:
      break
  Streak.currentStreak = streak
  Streak.longestStreak = max(Streak.longestStreak, streak)
  Streak.lastCompletedDate = today (or last completed)
```

Bounded by a 365-day lookback. After 365 days of unbroken streak, we cap the recompute window — past records are sealed.

### 3.3 Transactional consistency

The Completion insert and the Streak update happen in **one Prisma transaction**. If either fails, both roll back. Otherwise, the streak displayed to the user could be wrong for a brief window.

---

## 4. Per-day completion calculation

For displays like the daily ring and the weekly heatmap, we need `(done, total)` for a given day. The query:

```sql
WITH scheduled AS (
  SELECT t.id
  FROM "Task" t
  WHERE t."userId" = $1
    AND t."deletedAt" IS NULL
    AND $2::int = ANY (t."repeatDays")  -- $2 = day-of-week 0..6
)
SELECT
  (SELECT count(*) FROM scheduled) AS total,
  (SELECT count(*) FROM "Completion" c
   JOIN scheduled s ON c."taskId" = s.id
   WHERE c."completedAt" = $3::date
     AND c.skipped = false) AS done;
```

Edge case: tasks created **after** a past date should not retroactively appear in that date's "total". We solve this by also filtering `t."createdAt" <= $3`.

Edge case: tasks deleted before that date should not appear in the past either. `t."deletedAt" IS NULL OR t."deletedAt" > $3`.

---

## 5. Weekly heatmap

Returns 7 rows, oldest first:

```json
{
  "days": [
    { "date": "2026-05-14", "done": 4, "total": 5, "percent": 80 },
    { "date": "2026-05-15", "done": 5, "total": 5, "percent": 100 },
    ...
  ]
}
```

Mapped to colour intensity client-side:

| Percent | Cell colour (light theme) |
|---|---|
| 0 | `bg.surface` (empty) |
| 1-25 | `accent.success` at 20% |
| 26-50 | at 40% |
| 51-75 | at 65% |
| 76-99 | at 85% |
| 100 | at 100% (full saturated) |

---

## 6. Category score

For each category that has scheduled tasks in the period, returns:

```json
[
  { "category": "morning", "done": 12, "total": 14, "percent": 85.7 },
  { "category": "health",  "done": 7,  "total": 7,  "percent": 100 },
  ...
]
```

Surfaced as horizontal Neumorphic progress bars on the Stats tab.

---

## 7. Reading minutes

Aggregates `ReadingProgress.secondsRead` per day. `secondsRead` is incremented client-side every 5 seconds while reading (see [`05-ebook-reader.md`](05-ebook-reader.md) §6) and synced via `PUT /reading-progress/:bookId`.

Display: bar chart, 7 or 30 days. Y-axis is minutes (rounded to integer); X-axis is dates. Tap a bar to see which books contributed.

---

## 8. Consistency rate

Defined as the fraction of **scheduled days** done over the last 30 days:

```
consistencyRate = days_fully_completed / scheduled_days_in_window
```

Trend arrow:

- `↑` if current 30 day rate > previous 30 day rate by ≥ 5 percentage points
- `↓` if lower by ≥ 5 percentage points
- `→` otherwise (steady)

Surfaced as a single big number plus the arrow on the Stats tab hero.

---

## 9. Caching strategy

| Cache | Where | TTL | Invalidation |
|---|---|---|---|
| Today's `(done, total)` | client (React Query) | until next mutation | Invalidated after every completion mutation |
| Weekly stats | Redis `stats:<userId>:weekly` | 5 min | Soft-invalidated on completion; user reads slightly stale, refreshes within 5 min |
| Monthly / consistency | Redis | 1 hour | Same |
| Best streak | client (rarely changes) | session | Refreshed on app open |

We deliberately accept up to 5 minutes of staleness on cached stats — the user-visible "current streak" (mutation response) is always live.

---

## 10. Tests required

| Test | Tool | Scenario |
|---|---|---|
| Streak: 7 consecutive days = 7 | Vitest | Linear case |
| Streak: skipped day still extends | Vitest | All-skipped day |
| Streak: missing task breaks | Vitest | Negative case |
| Streak: timezone change mid-streak | Vitest | DST + tz switch |
| Streak: undo most-recent completion decrements | Vitest | Mutation symmetry |
| Heatmap: deleted tasks don't backfill past | Vitest | Schema correctness |
| Reading minutes: aggregates across books | Vitest | Multi-book user |
| Consistency: 0 scheduled days → 100% (vacuous) | Vitest | Edge case |
| Stats API: returns cached value within 5 min | Supertest | Cache layer |

---

## 11. Surfacing rules (UX guarantees)

- **Streak fire animation** on the home ring triggers only when the day flips from <100% to 100% — never on app open.
- **No negative framing.** Stats screens never say "you missed N days." They show progress and trends.
- **No comparisons across users.** Stats are private; social proof is not part of v2.0.
- **Reduced motion** disables the flame burst, ring sweep, and bar-grow animations (per [`04-motion.md`](04-motion.md)).

---

## Next reading

- **Schema for Streak, Completion, ReadingProgress** → [`09-database-schema.md`](09-database-schema.md)
- **Endpoints exposed** → [`10-api-contracts.md`](10-api-contracts.md) (`/stats/*`)
- **Motion of the surfaces** → [`04-motion.md`](04-motion.md)
