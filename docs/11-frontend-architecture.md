# 11 — Frontend Architecture (React Native)

> Maps to PRD section 14.
> **When to read:** Phase 1 (week 1) when scaffolding the mobile app; whenever a new screen or store slice is being added.

The mobile app uses **Expo Router** for typed file-based routing, **Zustand** for client state, **TanStack React Query** for server state, and **MMKV** for persistence. Animations live exclusively in Reanimated worklets (see [`04-motion.md`](04-motion.md)). UI primitives come from `packages/ui` (see [`03-design-system.md`](03-design-system.md)).

This document specifies the folder layout, state shape, navigation, and the rules engineers must follow when adding to the codebase.

---

## 1. Folder structure (`apps/mobile`)

```
apps/mobile/
├── app/                              # Expo Router — file = route
│   ├── _layout.tsx                   # Root layout: providers, theme, auth gate
│   ├── (auth)/                       # Stack: only when signed out
│   │   ├── _layout.tsx
│   │   ├── sign-in.tsx
│   │   ├── sign-up.tsx
│   │   ├── reset.tsx
│   │   └── onboarding/
│   │       ├── _layout.tsx
│   │       ├── welcome.tsx
│   │       ├── goal.tsx
│   │       ├── notifications.tsx
│   │       └── first-routine.tsx
│   ├── (tabs)/                       # Bottom-tab navigation when signed in
│   │   ├── _layout.tsx
│   │   ├── today.tsx                 # Routine dashboard
│   │   ├── library.tsx               # Personal + public books
│   │   ├── stats.tsx
│   │   └── settings.tsx
│   ├── reader/[bookId].tsx           # Full-screen reader (modal stack)
│   ├── book/[bookId].tsx             # Book detail
│   ├── task/[taskId].tsx             # Task detail / edit
│   ├── (admin)/                      # Visible only to role >= moderator
│   │   ├── _layout.tsx
│   │   ├── moderation.tsx
│   │   ├── users.tsx
│   │   └── reports.tsx
│   └── +not-found.tsx
├── src/
│   ├── components/
│   │   ├── tasks/                    # TaskCard, TaskForm, CategoryTag, ReorderHandle
│   │   ├── reader/                   # Pager, Toolbar, ProgressBar, FontSheet, PageCurl
│   │   ├── library/                  # BookCover, BookGrid, SearchBar, CategoryStrip
│   │   ├── stats/                    # DailyRing, WeeklyHeatmap, StreakFlame, CategoryBars
│   │   ├── admin/                    # ModerationRow, FlagEditor, BroadcastForm
│   │   └── shared/                   # ErrorBoundary, EmptyState, LoadingState, NetBanner
│   ├── hooks/
│   │   ├── useReminders.ts
│   │   ├── useBooks.ts
│   │   ├── useReader.ts
│   │   ├── useRoles.ts
│   │   ├── useTheme.ts
│   │   ├── useFeatureFlag.ts
│   │   └── useNetworkStatus.ts
│   ├── lib/
│   │   ├── api/                      # axios client + interceptors
│   │   ├── storage/                  # MMKV wrapper, secure helpers
│   │   ├── files/                    # download manager, blob utils
│   │   ├── encryption/               # AES-256-GCM helpers, keychain
│   │   ├── notifications/            # Notifee setup, FCM registration
│   │   ├── analytics/                # event tracker (Sentry + custom)
│   │   └── time/                     # timezone utils, DST-safe scheduling
│   ├── store/                        # Zustand slices
│   │   ├── auth.ts
│   │   ├── tasks.ts
│   │   ├── reader.ts
│   │   ├── library.ts
│   │   ├── admin.ts
│   │   └── ui.ts                     # theme, banner, network state
│   ├── types/                        # local types (most types live in packages/types)
│   └── utils/                        # pure functions; everything tested
├── assets/
│   ├── fonts/                        # Inter + JetBrains Mono
│   ├── icons/                        # SVGs
│   └── images/                       # onboarding artwork
├── tests/
│   ├── unit/                         # Vitest
│   ├── component/                    # RTL
│   └── e2e/                          # Maestro flows
├── app.config.ts                     # Expo config (per-env)
├── babel.config.js                   # Reanimated plugin required
├── metro.config.js
├── tsconfig.json                     # extends packages/config/ts/mobile.json
└── package.json
```

### Why Expo Router

- File-based routing makes screens trivially discoverable.
- Typed routes: `router.push({ pathname: '/book/[bookId]', params: { bookId } })` is type-checked.
- Built-in support for tabs + modal stacks.
- Deep-link friendly: a broadcast push with `deepLink: '/book/01HXY...'` works without manual wiring.

---

## 2. Navigation map

```
                ┌──────────────────┐
                │   Root Layout    │
                │   (providers)    │
                └────┬─────────────┘
                     │
        ┌────────────┴─────────────┐
        │                          │
        ▼                          ▼
  (auth)/                    (tabs)/  + (admin)/ if role
   ├── sign-in              ├── today      ├── moderation
   ├── sign-up              ├── library    ├── users
   ├── reset                ├── stats      └── reports
   └── onboarding/          └── settings
        ├── welcome
        ├── goal              + modal stacks:
        ├── notifications     ├── /book/[id]
        └── first-routine     ├── /reader/[id]
                              └── /task/[id]
```

The auth gate (in `app/_layout.tsx`) decides which group is rendered. Onboarding is part of `(auth)` so a partially-onboarded user can be sent back without leaving the auth flow.

---

## 3. State management split

We split state into three clear buckets. Engineers must know which bucket a piece of data belongs to before writing code.

| Bucket | Tool | Examples |
|---|---|---|
| **Server state** | TanStack React Query | Tasks list, books list, current user profile, stats |
| **Client UI state** | Zustand | Theme, modal open/closed, drag state, reader chrome visibility |
| **Persistent prefs** | MMKV (raw or via Zustand persist middleware) | Theme choice, quiet hours, last-viewed book, MMKV-backed auth tokens |

### 3.1 Server state principles (React Query)

- Every endpoint has a hook: `useTasks()`, `useBooks(filter)`, `useStats()`.
- Hooks live in `src/hooks/` and wrap generated functions from `packages/types/hooks`.
- Query keys are arrays: `['tasks', 'today']`, `['books', { scope: 'public', search, ... }]`.
- Optimistic updates implemented with `onMutate` → `setQueryData` → `onError` rollback.
- Offline cache: `persistQueryClient` with MMKV storage; cache survives app restarts.
- Stale times tuned per resource (tasks: 30s, stats: 60s, public library: 5min).

### 3.2 Client state principles (Zustand)

- One slice per feature area: `useAuthStore`, `useReaderStore`, `useUIStore`.
- Slices export named selectors to avoid full-store re-subscriptions.
- No async calls inside actions — that's React Query's job.
- Persistence via `zustand/middleware/persist` with an MMKV storage adapter.

Example:

```ts
// src/store/reader.ts
type ReaderState = {
  bookId: string | null;
  chromeVisible: boolean;
  fontScale: 0 | 1 | 2 | 3;
  theme: 'light' | 'sepia' | 'night';
  toggleChrome(): void;
  setFontScale(n: 0|1|2|3): void;
  setTheme(t: 'light'|'sepia'|'night'): void;
};
```

### 3.3 Why not Redux

The combined state volume (~6 slices, ~30 fields total) does not justify Redux's ceremony. Zustand offers the same DX with one-tenth the boilerplate, and React Query already covers async/cache concerns.

---

## 4. API client

`src/lib/api/client.ts` wraps Axios:

- Base URL from `app.config.ts` per environment.
- Request interceptor injects `Authorization: Bearer ...` from `useAuthStore`.
- Response interceptor:
  - On 401, attempts refresh once; queues subsequent requests; on second failure signs the user out.
  - On 429, reads `Retry-After` and surfaces a typed error.
  - Adds `X-Trace-Id` to error logging.
- All routes are accessed via the generated hooks in `packages/types/hooks` — no raw `axios.post` calls in product code.

---

## 5. Persistence layer

### 5.1 MMKV

- Two named storages: `default` (general) and `secure` (token storage — encrypted at rest with a random AES key kept in Keychain).
- All access via `src/lib/storage/mmkv.ts` wrapper. No direct `MMKV` instantiation outside this module.

### 5.2 What we persist

| Data | Storage | Why |
|---|---|---|
| Access + refresh tokens | `secure` | Required for auth |
| Theme + quiet hours + locale | `default` | Restore on cold launch |
| React Query cache | `default` | Offline-first |
| Last-read book + position (cache) | `default` | Reader resumes instantly |
| Onboarding completed flag | `default` | Skip onboarding next launch |

### 5.3 What we do **not** persist

- Per-screen UI state (modal open, drag state) — ephemeral.
- Stats — re-fetch on app open (cheap, and accuracy matters).
- The encryption key for offline books — that lives in Keychain (see [`05-ebook-reader.md`](05-ebook-reader.md) §7).

---

## 6. Theming

A `<ThemeProvider>` at the root reads from `useUIStore.theme`. Themes are objects (`packages/ui/theme/light.ts`, `dark.ts`, `highContrast.ts`) — each exports the same shape.

Components consume tokens via `useTheme()` and never import a theme module directly. Switching theme at runtime is a single store update — no remount needed.

OS appearance changes are subscribed via `Appearance.addChangeListener`; if the user has chosen "follow system", the theme updates automatically.

---

## 7. Role gating

A `<RequireRole role="moderator">` component reads `useAuthStore.user.role` and renders `children` or a 404 screen. The `(admin)` group's layout wraps everything in this.

Server-side checks remain authoritative — the client gate is purely UX (so a regular user doesn't see broken admin links).

---

## 8. Notifications wiring

`src/lib/notifications/index.ts` is responsible for:

- Requesting permission on the onboarding "notifications" screen.
- Registering the FCM/APNs token with `POST /notifications/devices` on every cold launch (and on rotation).
- Handling foreground push (display the in-app Neumorphic banner via a portal).
- Handling background push tap (deep-link via Expo Router).
- Handling the `MARK_DONE` action button on the lock screen (calls `POST /completions` directly via a background fetch worker on iOS, via `headlessTask` on Android).

---

## 9. Offline-first behaviour

When `useNetworkStatus().isConnected === false`:

- Banners (`<NetBanner />`) appear at the top.
- New writes are queued via React Query's offline-aware mutations.
- The reader switches to offline mode if the book is downloaded; otherwise shows a clear message.
- Stats fall back to last cached values.
- Push reminders still fire via local Notifee.

When connectivity returns:

- Queued mutations flush in order.
- React Query invalidates stale queries.
- Reading position from offline reading syncs.

---

## 10. Error boundaries & crash reporting

- A top-level `<ErrorBoundary>` wraps the navigator and shows a recovery screen.
- Per-screen `<ErrorBoundary>` wraps async data loaders.
- Sentry is initialised in `app/_layout.tsx` with the release SHA from `app.config.ts`.
- JS errors and native crashes both surface to Sentry; symbolication happens via uploaded source maps in CI.

---

## 11. Performance toolkit

| Tool | Purpose |
|---|---|
| `react-native-mmkv` | Sync persistence (no async overhead on hot paths) |
| Reanimated worklets | UI-thread animations |
| Hermes engine | Faster startup, smaller bundle |
| `FlashList` (Shopify) | High-perf alternative to FlatList for the library grid |
| `react-native-skia` | GPU-rendered surfaces where needed (page-curl) |
| `expo-image` | Cached, progressive image loading |
| `InteractionManager` | Defer heavy work past animation frames |
| `reassure` | Per-screen perf budgets in CI |

---

## 12. Engineering rules (enforced via lint / review)

1. **No JS-thread animations** — Reanimated only (see [`04-motion.md`](04-motion.md) §4.1).
2. **No hand-styled shadows** — use a `Neu*` primitive.
3. **No direct `AsyncStorage` or `MMKV` instances** — use `src/lib/storage`.
4. **No raw `axios` / `fetch` calls** — use generated hooks.
5. **No `any`** — `tsconfig` has `strict: true`, `noUncheckedIndexedAccess: true`.
6. **Every component has a Storybook story + a test.**
7. **Every interactive element has `accessibilityLabel` and `accessibilityRole`.**
8. **No new screens without a route in the Expo Router tree.**
9. **No business logic in screens** — screens compose hooks + components; logic lives in hooks/services.
10. **Cross-platform sanity:** test on both iOS simulator and Android emulator before PR.

---

## 13. Cold-start budget

Per [`17-non-functional.md`](17-non-functional.md), cold-start is **<2.5s on mid-range Android**. Achieved by:

- Hermes engine (always on).
- Lazy importing heavy screens (`React.lazy` via Expo Router).
- Splash screen kept visible until `useAuthStore.hydrated && useUIStore.hydrated`.
- Font preloading with `expo-splash-screen` waiting on `Font.loadAsync`.
- React Query rehydrates from MMKV synchronously (no network round-trip required to render the today tab).

---

## Next reading

- **Server side** → [`12-backend-architecture.md`](12-backend-architecture.md)
- **What primitives the UI uses** → [`03-design-system.md`](03-design-system.md)
- **What screens animate** → [`04-motion.md`](04-motion.md)
