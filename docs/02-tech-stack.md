# 02 — Technology Stack

> Maps to PRD section 5.
> **When to read:** Before any code is written. Re-read at the start of every phase.

This document pins **every** technology choice with a version, a rationale, and where in the codebase it lives. The PRD's master prompt is explicit: "use exactly these unless impossible." That instruction holds here.

If a technology must be substituted, the substitution and reason must be appended to [`../DECISIONS.md`](../DECISIONS.md) before the change lands.

---

## Layered view

```
┌──────────────────────────────────────────────────────────────────┐
│  USER                                                            │
└──────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│  MOBILE (Android + iOS)     │   ADMIN WEB                        │
│  React Native 0.74 + Expo   │   Next.js 14 + Tailwind + shadcn   │
│  + Reanimated 3 + Moti      │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │  HTTPS / TLS 1.2+ / WSS
┌─────────────────────────────┼────────────────────────────────────┐
│                       BACKEND API                                │
│  Node.js 20 + Fastify + TypeScript + Zod                         │
│  Prisma 5 ◄──► PostgreSQL 16                                     │
│  BullMQ ◄──► Redis     S3-compatible object storage              │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────┴────────────────────────────────────┐
│  WORKERS (separate processes)                                    │
│  reminder-scheduler · upload-postprocessor · clamav · broadcast  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Mobile app

| Concern | Technology | Version | Lives in | Why |
|---|---|---|---|---|
| Runtime | React Native | 0.74 | `apps/mobile` | Single codebase for iOS and Android, mature ecosystem |
| Language | TypeScript | 5.x strict | everywhere | Type safety across the monorepo |
| Toolchain | Expo (custom dev client) | SDK 51+ | `apps/mobile` | Fast iteration, OTA updates, EAS Build for store binaries |
| Router | Expo Router | 3.x | `apps/mobile/app` | File-based, typed routes; supports modals + tabs cleanly |
| Navigation primitives | React Navigation | 7 | via Expo Router | Native stack + bottom tabs |
| Client state | Zustand | 4.x | `apps/mobile/src/store` | Minimal API, no boilerplate, easy to test |
| Server state | TanStack React Query | 5.x | `apps/mobile/src/lib/api` | Offline-first cache, optimistic updates, retries |
| Persistence | react-native-mmkv | 2.x | `apps/mobile/src/lib/storage` | ~30× faster than AsyncStorage, encrypted |
| Animations | Reanimated | 3.x | `apps/mobile/src/components/motion` | UI-thread worklets, 60-120fps |
| Motion API wrapper | Moti | 0.29+ | same | Framer-Motion-style declarative API |
| Skia rendering | @shopify/react-native-skia | latest | reader page-curl | 3D curl + custom shaders |
| Theming | Custom tokens + restyle/Tamagui | 1.x (Tamagui) | `packages/ui` | Type-safe theme tokens |
| PDF rendering | react-native-pdf | latest | `apps/mobile/src/components/reader` | Pagination, selection, search |
| EPUB rendering | epubjs-rn (fallback: readium-mobile) | latest | same | CFI locator, themed CSS |
| File storage | react-native-blob-util | latest | `apps/mobile/src/lib/files` | Streaming + chunked downloads |
| At-rest encryption | react-native-aes-crypto | latest | same | AES-256-GCM for offline books |
| Keystore | react-native-keychain | 8.x | `apps/mobile/src/lib/secure` | Keychain (iOS) + EncryptedSharedPreferences (Android) |
| Local notifications | Notifee | 7.x | `apps/mobile/src/lib/notifications` | Local scheduling + rich actions |
| Push | @react-native-firebase/messaging | latest | same | FCM (Android) + APNs (iOS) via Firebase |
| Crash + perf | @sentry/react-native | 5.x | `apps/mobile` | Symbolicated stack traces, perf tracing |

### Mobile decision principles

- **No JS-thread animations.** All motion runs on worklets via Reanimated.
- **No hand-styled shadows.** Use a `Neu*` primitive from `packages/ui`.
- **No direct AsyncStorage.** Use the MMKV-backed wrapper.
- **No untyped fetches.** Use the generated React Query hooks from `packages/types`.

---

## 2. Backend API

| Concern | Technology | Version | Lives in | Why |
|---|---|---|---|---|
| Runtime | Node.js | 20 LTS | `apps/api` | Long-term support, native fetch, Worker Threads |
| Framework | Fastify | 4.x | `apps/api/src` | Lower overhead than Express, schema-first |
| Language | TypeScript | 5.x strict | same | Shared with mobile/admin |
| ORM | Prisma | 5.x | `apps/api/prisma` + `schema/` | Type-safe queries, migrations, great DX |
| Database | PostgreSQL | 16 | infra | Relational, reliable, JSONB for flexibility |
| Cache + queue | Redis | 7.x | infra | BullMQ queues, rate-limit counters, stats cache |
| Job queue | BullMQ | 5.x | `apps/api/workers` | Per-user reminder jobs, retries, cron |
| Validation | Zod | 3.x | `apps/api/src/**/schema.ts` | Same schema validates request body, query, params and types into TS |
| Object storage | Cloudflare R2 (or AWS S3) | — | infra | S3 API-compatible, cheap egress |
| File scan | ClamAV | latest | worker process | Open-source virus scanning |
| Auth provider | Clerk | latest | hosted | Email + OAuth + multi-device sessions; offload of MFA |
| Auth fallback | Lucia + JWT | (if self-hosting chosen) | — | Documented alternative, see [`13-security-privacy.md`](13-security-privacy.md) |
| Search | Postgres FTS (Meilisearch optional) | — | `apps/api/src/books` | Postgres FTS is good enough until 10k books; Meilisearch swap is a config change |
| Realtime | Fastify WebSocket plugin | latest | `apps/api/src/ws` | Single WS connection at `/ws` for moderation + broadcast events |
| Email | Resend (or AWS SES) | latest | `apps/api/src/lib/email` | Transactional only (password resets, GDPR exports) |

### Backend decision principles

- **Every route has a Zod schema** for body, query, params and response.
- **No cross-module imports of internals.** Modules expose routes + a `service.ts`. Other modules import the service, not the Prisma calls.
- **Workers are separate processes.** Easier to scale and reason about.
- **No public buckets.** Every S3 access is via a signed URL with 15-minute TTL.

---

## 3. Admin web

| Concern | Technology | Version | Lives in |
|---|---|---|---|
| Framework | Next.js | 14 (App Router) | `apps/admin-web` |
| Styling | Tailwind CSS | 3.x | same |
| UI primitives | shadcn/ui | latest | `apps/admin-web/src/components/ui` |
| Forms | react-hook-form + Zod | latest | same |
| Charts | Recharts (or Tremor) | latest | dashboard |
| Tables | TanStack Table | 8.x | moderation queue, users |
| Auth | Same Clerk instance as mobile | — | session shared via cookies |

### Admin design principles

- Reuses the backend; **no separate API**.
- Reuses Zod schemas from `packages/types` so request shapes can never drift.
- Every privileged action calls the audited endpoint — there are no privileged operations outside `/api/v1/admin/*`.

---

## 4. Shared packages

| Package | Contents | Why |
|---|---|---|
| `packages/ui` | Neumorphic primitives (mobile-only), motion components | Single source of truth for visual language |
| `packages/types` | Generated types from Zod schemas; TS interfaces for `User`, `Task`, `Book`, etc. | Mobile + admin + tests share one contract |
| `packages/config` | `tsconfig`, `eslint`, `prettier`, `commitlint` | One config to maintain |

---

## 5. DevOps & infra

| Concern | Technology | Where |
|---|---|---|
| Workspace | pnpm | repo root |
| CI | GitHub Actions | `.github/workflows` |
| Mobile build | EAS Build | Expo cloud |
| Store submission | Fastlane | `apps/mobile/fastlane` |
| Backend deploy | Railway or Fly.io | staging + prod |
| Containers | Docker | `apps/api/Dockerfile`, worker Dockerfiles |
| Local dev | Docker Compose (Postgres + Redis + Minio) | `infra/docker-compose.yml` |
| Secrets | Doppler (or AWS Secrets Manager) | dev + prod |
| Monitoring | Sentry (mobile + API) + Grafana Cloud | all envs |
| Log shipping | Grafana Loki | all envs |

---

## 6. Version pinning policy

- All package versions are pinned in `package.json` with `~` (patch updates only).
- Dependabot opens weekly PRs for minors; majors require an ADR (architecture decision record) in `docs/adr/`.
- Renovate is acceptable as a Dependabot replacement if the team prefers.

---

## 7. License posture

Every dependency must be MIT, Apache-2, BSD or ISC. Anything copyleft (GPL family) requires legal review before adoption. A `pnpm license-checker` step gates CI.

---

## 8. What this stack explicitly rejects

To prevent debates from re-opening every sprint:

| Rejected | In favor of | Why |
|---|---|---|
| Expo's `Animated` API | Reanimated 3 | JS-thread, drops frames under load |
| AsyncStorage | MMKV | 30× slower, no encryption |
| Express | Fastify | Slower request lifecycle, weaker TS story |
| Sequelize / TypeORM | Prisma | Worse DX, no first-class TS types from schema |
| AWS Cognito (default) | Clerk | More dev work, worse MFA story for a small team |
| Self-hosted PostgreSQL on a single VM | Managed Postgres (Neon, Supabase or AWS RDS) | Backups, failover, point-in-time recovery |

---

## Next reading

- **How it looks** → [`03-design-system.md`](03-design-system.md)
- **How it moves** → [`04-motion.md`](04-motion.md)
- **How the codebase is organised** → [`11-frontend-architecture.md`](11-frontend-architecture.md) + [`12-backend-architecture.md`](12-backend-architecture.md)
