# 05 — E-Book Reader (Online & Offline)

> Maps to PRD section 8.
> **When to read:** Phase 5 (weeks 7-8) and any time the reader's behaviour is being changed.

The reader is the most technically complex piece of the mobile app. It supports two **source modes** (streamed and downloaded) and two **file formats** (PDF and EPUB). Users can switch between modes per book.

This document specifies behaviour, rendering pipeline, security, and the reader UI. Implementation lives in `apps/mobile/src/components/reader/`.

---

## 1. Source modes

### 1.1 Online (streamed)

| Aspect | Behaviour |
|---|---|
| Fetch | The book file is streamed in ranged HTTP chunks from S3-compatible storage via signed URLs |
| URL lifetime | 15 minutes; the client re-requests via `POST /books/:id/download` before expiry |
| Local cache | Cover image, metadata, and current reading position cached in MMKV |
| Position sync | Pushed to backend every 5 seconds, debounced |
| Bandwidth | EPUBs are chunked at the chapter level; PDFs at 256KB byte ranges |

### 1.2 Offline (downloaded)

| Aspect | Behaviour |
|---|---|
| Trigger | User taps **Download** on book detail screen |
| Storage | Encrypted file in app document directory (not in shared storage) |
| Encryption | AES-256-GCM, per-user key |
| Key storage | Keychain (iOS) / EncryptedSharedPreferences (Android), accessible only to the app |
| Removal | Storage Manager screen → Remove download (also removes from disk and decrements `BookDownload.status`) |
| Position sync | Queued locally and re-uploaded when device returns online |
| Concurrency | Background download queue (max 2 concurrent downloads, per-file resume) |

### 1.3 Switching modes

A user can toggle a book between online and offline at any time. The reader UI shows a small badge: ⬇ (downloaded) or ☁ (streaming). The book content is identical; only the source differs.

---

## 2. File formats

### 2.1 PDF

- Rendered via `react-native-pdf` (which wraps PDFKit on iOS and PdfiumAndroid on Android).
- Pagination is page-based.
- Text selection works for selectable PDFs; rasterised PDFs fall back to OCR-disabled (search may return no results).
- Bookmarks store a page number.
- Highlights store `{ pageNumber, rect, color, note }`.

### 2.2 EPUB

- Rendered via `epubjs-rn` (fallback: `readium-mobile`).
- Pagination is virtual — driven by viewport size and font settings.
- Location stored as a **CFI** (Canonical Fragment Identifier) string. CFIs survive font/size changes.
- Highlights store `{ cfiRange, color, note }`.
- Full-text search uses the EPUB's internal text content (much faster than PDF).

---

## 3. Reader UI

```
┌──────────────────────────────────────┐
│  ← Back     Title             ⚙ Aa  │  ← Top chrome (auto-hides 3s after tap)
├──────────────────────────────────────┤
│                                      │
│                                      │
│                                      │
│             [ page content ]         │
│                                      │
│                                      │
│                                      │
├──────────────────────────────────────┤
│  ◀  Ch. 3 — "Habit Loops"   42/300  │  ← Bottom chrome
└──────────────────────────────────────┘
```

### 3.1 Top chrome controls

- **← Back** — exits reader; saves position
- **⚙** — opens settings sheet (font, theme, line spacing)
- **Aa** — quick font size cycle (S / M / L / XL)
- Optional: 🔖 bookmark toggle for the current location

### 3.2 Bottom chrome controls

- Chapter title + current/total pages (or % for EPUB)
- ◀ / ▶ — page navigation (also via swipe)

### 3.3 Settings sheet (Neumorphic bottom sheet)

| Control | Options |
|---|---|
| Font size | Slider, 4 steps |
| Line spacing | 1.2 / 1.5 / 1.8 |
| Theme | Light / Sepia / Night |
| Font family (EPUB only) | System / Serif / OpenDyslexic |
| Margins | Narrow / Medium / Wide |

All settings are persisted per-book in MMKV (so different books can have different settings) **and** as a default in user preferences.

### 3.4 Themes inside the reader

- **Light** — paper-white background, near-black text
- **Sepia** — `#F4ECD8` background, `#5B4636` text (warm cream)
- **Night** — `#1A1D24` background, `#D7D9DC` text (matches dark mode of the app)

These reader themes are independent from the app theme (a user may prefer dark mode for the app but sepia for reading).

---

## 4. Bookmarks, highlights, notes

| Feature | Behaviour |
|---|---|
| Bookmarks | One tap to toggle bookmark on current page/CFI; visible in a Bookmarks tab in the reader |
| Highlights | Long-press selects text; popover offers 4 colours; persisted with the highlighted text snippet |
| Notes | Optional `note` field on any highlight, captured via inline keyboard sheet |
| Visibility | All three are **per user**, never shared. Even on a public book, my highlights stay mine. |
| Sync | Stored on backend; rendered locally on next read |

The `Bookmark` table (see [`09-database-schema.md`](09-database-schema.md)) carries both bookmarks and highlights — they share a schema, distinguished by whether `note` and `color` are populated.

---

## 5. Search inside a book

- **EPUB:** EPUB.js exposes the full text content. We index per-chapter in memory on open; search is sub-100ms.
- **PDF:** PDF text content via `react-native-pdf`'s text extraction. Rasterised PDFs return no results (we surface a "this PDF appears to be scanned" message).

Results show the snippet, page/chapter, and a Tap-to-jump action.

---

## 6. Reading-time tracking

- A 1-second tick fires while the reader is visible and the device is not locked.
- Each tick increments `ReadingProgress.secondsRead` for the current book.
- Updates are debounced and pushed to `PUT /reading-progress/:bookId` every 5 seconds.
- The stats engine (see [`14-stats-engine.md`](14-stats-engine.md)) sums these to render weekly reading minutes.

---

## 7. Encryption at rest (offline mode)

### 7.1 Per-user key

On first sign-in:

1. The mobile client generates a 256-bit symmetric key with `crypto.getRandomValues`.
2. The key is stored in **Keychain** (iOS) under `service: app, account: bookEncryptionKey` or **EncryptedSharedPreferences** (Android).
3. The key never leaves the device. It is **not** synced to the backend.

If the user signs in on a new device, downloaded books on the old device remain encrypted with the old key. The new device must re-download books; they will be encrypted with a fresh key.

### 7.2 Encryption procedure (download)

For each downloaded book:

1. Fetch the streamed file via signed URL.
2. Encrypt with AES-256-GCM using a random per-file 96-bit IV.
3. Persist `{ iv, ciphertext, authTag }` to the app document directory under `books/{bookId}.enc`.
4. Insert/update a `BookDownload` row with `status: 'ready'`.

### 7.3 Decryption procedure (read)

When the reader opens an offline book:

1. Read `{ iv, ciphertext, authTag }` from disk.
2. Decrypt with AES-256-GCM and the per-user key into a temporary file in the app's cache dir.
3. Hand the temp file to `react-native-pdf` / `epubjs-rn`.
4. Delete the temp file when the reader unmounts.

The temp file is in the app's private cache directory (which iOS may evict under storage pressure — fine, we re-decrypt next read).

### 7.4 Threats addressed

- **Lost device** — book file unreadable without the Keychain entry, which is bound to the user's device passcode/biometrics.
- **Filesystem snooping** — even with full filesystem read access (jailbreak), the ciphertext is useless without the key.
- **Cloud backup leak** — the Keychain entry is excluded from iCloud / Google backup (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` on iOS).

### 7.5 Threats **not** addressed (and out of scope)

- A determined attacker with root + the device unlocked can extract the key. We do not claim DRM-grade protection.
- Screenshot prevention is best-effort (we set `FLAG_SECURE` on Android, but iOS has no equivalent for arbitrary content).

---

## 8. Reader state machine

```
[browsing book detail]
        │ tap Read
        ▼
[opening] ──network error──► [error sheet] ──retry──► [opening]
        │
        ▼
[reading]
   │   │   │
   │   │   └── tap settings ► [settings sheet] ◄─────┘
   │   │
   │   └── long-press text ► [highlight popover]
   │
   └── swipe page ► [page-curl in flight] ► [reading]
        │
        ▼
[closing] (auto-save position)
        │
        ▼
[back to library]
```

The state lives in the `useReader` hook (Zustand slice).

---

## 9. Performance

| Metric | Target |
|---|---|
| Open book (cached cover, online) | First page visible in < 1.5s |
| Open book (cold, online, 5MB PDF) | First page visible in < 3s on Wi-Fi |
| Open book (offline) | First page visible in < 1s |
| Page swipe (PDF) | 60fps; max 120ms script time |
| Page swipe (EPUB) | 60fps; max 200ms script time (re-layout cost) |
| Position sync | Debounced to ≤ 1 request / 5s |

---

## 10. Edge cases and error handling

| Case | Behaviour |
|---|---|
| Signed URL expired mid-read | Catch 403, re-request URL, resume from current page |
| Disk full during download | Fail download, show toast, mark `BookDownload.status = 'failed'`, no partial files left behind |
| Corrupt local file (auth tag mismatch) | Delete + force re-download on next open |
| PDF with broken table of contents | Render anyway; chapter title falls back to page number |
| EPUB with embedded JavaScript | Stripped during ingestion (security) |
| Book deleted server-side while open | Show non-blocking banner: "This book is no longer available. Your progress is saved." |

---

## 11. What the reader does *not* do (yet)

- No text-to-speech (planned v3)
- No collaborative annotations (planned v3)
- No "send to Kindle" or other export
- No DRM enforcement beyond at-rest encryption

These are explicit non-goals so the team is not tempted to scope-creep.

---

## Next reading

- **Where books come from** → [`06-uploads-public-library.md`](06-uploads-public-library.md)
- **Endpoints the reader calls** → [`10-api-contracts.md`](10-api-contracts.md)
- **Encryption details** → [`13-security-privacy.md`](13-security-privacy.md)
