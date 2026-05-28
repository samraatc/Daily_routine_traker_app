# 06 — User Uploads & Public Library

> Maps to PRD section 9.
> **When to read:** Phase 6 (week 9) and any time the upload pipeline or moderation flow is being changed.

Authenticated users can upload PDF or EPUB files up to 50 MB. Each upload is **private by default**, with an explicit toggle to publish to the **Public Library**. This document covers the full lifecycle: upload → process → publish → moderate → discover → report.

---

## 1. Upload pipeline

```
[client]                    [api]                 [s3 / r2]          [worker]
   │                          │                      │                  │
   │ POST /books/upload-url   │                      │                  │
   ├─────────────────────────►│                      │                  │
   │                          │ create pre-signed PUT│                  │
   │                          ├─────────────────────►│                  │
   │ { uploadUrl, fileKey }   │                      │                  │
   │◄─────────────────────────┤                      │                  │
   │                                                 │                  │
   │ PUT file (binary)                               │                  │
   ├────────────────────────────────────────────────►│                  │
   │                                                 │                  │
   │ POST /books { fileKey, title?, ... }            │                  │
   ├─────────────────────────►│                      │                  │
   │                          │ enqueue 'book.ingest'│                  │
   │                          ├─────────────────────────────────────────►│
   │                          │                      │   downloads file │
   │                          │                      │◄─────────────────┤
   │                          │                      │   ClamAV scan    │
   │                          │                      │   extract meta   │
   │                          │                      │   render cover   │
   │                          │   updates Book row   │                  │
   │                          │◄────────────────────────────────────────┤
   │                          │   sends "ready" push │                  │
   │   FCM: "Book ready"      │                      │                  │
   │◄─────────────────────────┤                      │                  │
```

### Stage detail

| Stage | Responsibility | Failure mode |
|---|---|---|
| Pre-signed URL request | API issues a PUT URL with 15-min TTL, scoped to `users/{userId}/books/{newBookId}.{pdf\|epub}` | 401 if not authenticated; 429 if rate-limited |
| Client upload to S3 | Direct PUT; content-type enforced by signed URL policy | Resumable via `tus` (stretch) |
| Book registration | `POST /books` with `fileKey` and optional metadata; row created with `visibility='private'` | Server rejects if `fileKey` doesn't match an existing object |
| Ingest worker | ClamAV scan → metadata extraction (title, author from PDF info dict or EPUB OPF, page count, render cover at 600×800) | On failure, sets `visibility='rejected'` with `rejectionReason='ingest_failed'` |
| Notification | Push notification "Your book is ready" via FCM/APNs | Falls back to in-app inbox |

### Server-side validation

| Check | Limit | Reason |
|---|---|---|
| File size | ≤ 50 MB | PRD requirement |
| Content-type | `application/pdf`, `application/epub+zip` only | Type confusion attack prevention |
| Magic bytes | First 1024 bytes match expected signature | Defeats type spoofing |
| Page count | ≤ 2000 (PDF) or ≤ 1000 chapters (EPUB) | DoS protection |
| Per-user quota | 100 books or 5 GB, whichever first | Storage cost |
| Per-user rate limit | 10 uploads / hour | Abuse prevention |

Quotas are enforced at `POST /books/upload-url`.

---

## 2. Visibility lifecycle

```
              ┌─────────┐
   create →   │ private │  ← owner only
              └────┬────┘
                   │ owner toggles "Make Public"
                   ▼
              ┌──────────────────┐
              │ pending_review   │  ← moderation queue
              └────┬──────────┬──┘
                   │          │
            approve│          │reject
                   ▼          ▼
              ┌────────┐  ┌──────────┐
              │ public │  │ rejected │  ← owner sees reason
              └────┬───┘  └──────────┘
                   │ owner toggles "Make Private"
                   ▼
              ┌─────────┐
              │ private │
              └─────────┘
```

| State | Who can read it | Who can see it in lists |
|---|---|---|
| `private` | Owner | Owner |
| `pending_review` | Owner, moderator | Owner (My Library), moderator (queue) |
| `public` | Anyone signed in | Anyone (Public Library) |
| `rejected` | Owner | Owner (with reason badge) |

The visibility field is a Postgres ENUM defined in `schema/schema.prisma`. The transition rules are enforced server-side in `apps/api/src/books/service.ts`.

---

## 3. Moderation review

### 3.1 Moderator UI (admin web)

For each `pending_review` book, the moderator sees:

- Cover, title, author (from extraction)
- File size, page count, format
- Owner profile + history (other uploads, suspension status)
- ClamAV result (`clean` / `infected:<sig>`)
- Render preview (first 10 pages embedded)
- File hash (so duplicates can be detected manually)
- Buttons: **Approve** / **Reject** (with reason) / **Request edits** (sends note to owner, returns to private)

### 3.2 Templated rejection reasons

The moderator picks from a pre-written list — free-text is allowed but discouraged:

- Copyright concerns
- Inappropriate content
- Low quality / unreadable
- Duplicate of an existing book
- Metadata incorrect

Each templated reason maps to a localised string the owner sees.

### 3.3 Moderation SLA

| Severity | Target turnaround |
|---|---|
| First-time uploader | 24h |
| Established uploader (≥ 3 prior approvals) | 4h |
| Re-review after edit | 8h |

These targets are tracked on the admin dashboard.

---

## 4. Copyright safeguards

The PRD makes this explicit and we treat it as a P0 concern.

### 4.1 Pre-upload checkbox

The upload screen blocks the **Publish** action until the user checks:

> ☐ I confirm that I own the rights to this content, or that it is in the public domain, and that I am authorised to share it publicly.

The state of this checkbox at the time of publication is recorded in `Book.rightsAcceptedAt` (timestamp, immutable).

### 4.2 Reporting flow

Any signed-in user can flag a public book via the `🚩 Report` action. This calls `POST /books/:id/report` with:

- `reason` ∈ `{ copyright, abuse, spam, inaccurate, other }`
- `detail` (free text, ≤ 500 chars)

A `Report` row is created and the book appears in the moderator's **Reports** queue. Bulk reports on the same book trigger an automatic re-review (book returns to `pending_review` after the 3rd unresolved report).

### 4.3 Takedown

A moderator can take down a public book at any time — the book transitions to `rejected` with `rejectionReason='takedown_<reason>'`. Anyone who has already downloaded it keeps their offline copy; new downloads are blocked.

### 4.4 DMCA equivalent

For rights-holder requests outside the in-app reporting flow, the email `dmca@<domain>` is monitored by a moderator. The same takedown path is used.

---

## 5. Discovery (Public Library)

### 5.1 Categories

A static list defined in `BookCategory` seed data:

- Self-help
- Productivity
- Fiction
- Non-fiction
- Study / Reference
- Health & Fitness
- Spirituality
- Children
- Other

Categories are managed in the admin panel (add/edit/reorder/icon).

### 5.2 Tags

User-defined, comma-separated free text on upload. Normalised lowercase, deduped, max 8 per book.

### 5.3 Search

- **Default backend:** Postgres full-text search over `title`, `author`, `description`, `tags`.
- **Stretch:** Swap to Meilisearch when result quality degrades (~10k books). The service interface in `apps/api/src/books/search.service.ts` abstracts over both.

### 5.4 Sorting

| Sort | Implementation |
|---|---|
| Newest | `ORDER BY createdAt DESC` |
| Trending (7-day) | `downloadsCount` over the last 7 days, computed nightly into a `book_trending` materialised view |
| Most read | `SUM(ReadingProgress.secondsRead)` over the last 30 days |

### 5.5 "Recommended for your routine"

A simple mapping: each `Task.category` maps to one or more `BookCategory.slug`. The home tab's "Recommended" carousel queries:

```
SELECT b.* FROM Book b
WHERE b.visibility = 'public'
  AND b.categoryId IN ( <mapping for user's active task categories> )
ORDER BY b.downloadsCount DESC
LIMIT 8;
```

The mapping is configured in admin → categories.

---

## 6. Quotas, costs, and lifecycle

### 6.1 Per-user quota

Default: 100 books or 5 GB. Visible in Settings → Storage. Quota is enforced at upload-URL request time.

### 6.2 Storage tiering

After 12 months of zero downloads and zero reads, public books are migrated to cold storage (S3 Glacier Instant Retrieval / R2 lifecycle). Signed URLs work transparently with cold-tier objects; retrieval is slightly slower.

### 6.3 Rate limiting downloads

A user can download at most 50 books per day (typically far less). This prevents library-scraping.

---

## 7. Edge cases

| Case | Behaviour |
|---|---|
| Owner deletes a public book | Book becomes `deleted`; existing downloads still readable offline but no new downloads |
| Owner is suspended | All their public books become `private` automatically; offline copies remain readable |
| Duplicate detection | Same file hash from same user → reject upload (409). Same hash from different user → flagged to moderator |
| EPUB with embedded JS | JS removed during ingestion before file becomes accessible |
| PDF with form fields | Form fields are rendered read-only |

---

## 8. Tests required for the upload feature

| Test | Tool | What it covers |
|---|---|---|
| Pre-signed URL has correct policy (content-type, max size, expiry) | Vitest | Server-side URL generation |
| File above 50 MB rejected pre-upload | Vitest + Supertest | API layer |
| ClamAV-infected file → `visibility=rejected` | Worker integration | End-to-end through the queue |
| Owner publish → pending_review state | Supertest | State transition |
| Moderator reject → owner sees reason | RTL + Supertest | UI + API |
| Report 3× → auto re-review | Worker test | Moderation flow |
| Maestro: upload → publish → see in public library | Maestro | Critical user flow |

---

## Next reading

- **Who reviews uploads** → [`07-admin-panel.md`](07-admin-panel.md)
- **Schema for books, reports, etc.** → [`09-database-schema.md`](09-database-schema.md)
- **Endpoints used** → [`10-api-contracts.md`](10-api-contracts.md)
