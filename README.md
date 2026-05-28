# Daily Routine & E-Book Tracker

> A cross-platform React Native app combining habit tracking, Neumorphic 3D UI, scroll-triggered motion, and a personal + public e-book library — governed by a powerful admin console.

**Status:** Architecture & specification phase (pre-implementation).
**Source PRD:** `Daily_Routine_Tracker_PRD_v2.pdf` (v2.0 — May 2026).
**Target platforms:** Android & iOS (React Native + Expo) + Next.js admin web.

---

## How to read this repository

This is a **specification + architecture** package, not yet an implemented codebase. Everything here is designed to be handed to an engineering team (or a coding agent) and executed in order.

The PRD has 23 sections. The docs in this repo mirror that flow so the team can build the product **phase by phase**, with each document answering exactly the questions that come up at that stage of development.

| Phase / Section | Driving question | Read this |
|---|---|---|
| Why are we building this? | Problem, vision, users | [`docs/00-overview.md`](docs/00-overview.md) |
| What are we building? | Feature scope + priorities | [`docs/01-features.md`](docs/01-features.md) |
| What tools do we use? | Stack with rationale | [`docs/02-tech-stack.md`](docs/02-tech-stack.md) |
| How should it look? | Neumorphic design tokens | [`docs/03-design-system.md`](docs/03-design-system.md) |
| How should it move? | Motion + scroll-trigger spec | [`docs/04-motion.md`](docs/04-motion.md) |
| Reading experience | Online + offline e-book reader | [`docs/05-ebook-reader.md`](docs/05-ebook-reader.md) |
| User-generated content | Upload pipeline + public library | [`docs/06-uploads-public-library.md`](docs/06-uploads-public-library.md) |
| Operator tools | Admin panel + RBAC | [`docs/07-admin-panel.md`](docs/07-admin-panel.md) |
| Habit reminders | Push notifications + scheduler | [`docs/08-push-notifications.md`](docs/08-push-notifications.md) |
| Data shape | Database schema | [`docs/09-database-schema.md`](docs/09-database-schema.md) + [`schema/schema.prisma`](schema/schema.prisma) |
| Talking to the server | REST + WebSocket contracts | [`docs/10-api-contracts.md`](docs/10-api-contracts.md) |
| App code layout | Mobile (Expo Router) structure | [`docs/11-frontend-architecture.md`](docs/11-frontend-architecture.md) |
| Server code layout | Fastify modules + workers | [`docs/12-backend-architecture.md`](docs/12-backend-architecture.md) |
| Keep users safe | Auth, RBAC, encryption, GDPR | [`docs/13-security-privacy.md`](docs/13-security-privacy.md) |
| Show progress | Stats & results engine | [`docs/14-stats-engine.md`](docs/14-stats-engine.md) |
| Ship the build | CI/CD pipeline | [`docs/15-devops.md`](docs/15-devops.md) |
| Timeline | 12-week phase plan | [`docs/16-roadmap.md`](docs/16-roadmap.md) |
| Quality targets | Performance, a11y, offline, scale | [`docs/17-non-functional.md`](docs/17-non-functional.md) |
| Confidence | Test pyramid + tools | [`docs/18-testing-strategy.md`](docs/18-testing-strategy.md) |
| What could go wrong | Risk register + mitigations | [`docs/19-risks.md`](docs/19-risks.md) |
| Big picture | Cross-cutting architecture | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Choices made on your behalf | Default decisions log | [`DECISIONS.md`](DECISIONS.md) |

Visual aids live in [`diagrams/`](diagrams/) as Mermaid files (`.mmd`) — they render on GitHub and in most IDEs.

---

## The development flow

The product is designed to be built in 8 phases over 12 weeks (see [`docs/16-roadmap.md`](docs/16-roadmap.md)). Each phase has an entry checklist (what must be in place before starting) and an exit checklist (what must be true to move on).

```
Phase 1 — Foundations (wk 1-2)
  └─ Monorepo, auth, RBAC, base navigation, Neumorphic tokens
       │
       ▼
Phase 2 — Routines (wk 3-4)
  └─ Task CRUD, completions, streak engine
       │
       ▼
Phase 3 — Reminders (wk 5)
  └─ FCM/APNs, BullMQ, Notifee fallback, quiet hours
       │
       ▼
Phase 4 — Stats & Motion (wk 6)
  └─ Stats engine, scroll-triggered animations
       │
       ▼
Phase 5 — E-Book Reader (wk 7-8)
  └─ PDF + EPUB, streaming, encrypted offline
       │
       ▼
Phase 6 — Uploads & Library (wk 9)
  └─ Upload pipeline, public library, search, reports
       │
       ▼
Phase 7 — Admin Panel (wk 10)
  └─ Next.js dashboard, moderation, flags, broadcasts
       │
       ▼
Phase 8 — Polish & Launch (wk 11-12)
  └─ Accessibility, perf, QA, store submission
```

Within each phase the work flows roughly in this order:

1. **Read** the relevant section docs (linked from the roadmap).
2. **Migrate** the database (Prisma) if new tables are needed.
3. **Build the API** (Fastify route + service + Zod schema + tests).
4. **Update the type package** (`packages/types`) so mobile and web share contracts.
5. **Build the mobile screen** (with Neumorphic primitives from `packages/ui`).
6. **Wire up state** (Zustand + React Query).
7. **Add motion** (Reanimated + Moti).
8. **Test** (unit → component → API → E2E).
9. **Document** changes in the phase summary + decisions log.

---

## Target monorepo layout (Phase 1 sets this up)

```
.
├── apps/
│   ├── mobile/         # React Native (Expo) — Android + iOS
│   ├── admin-web/      # Next.js 14 — admin dashboard
│   └── api/            # Fastify + Prisma backend
├── packages/
│   ├── ui/             # Neumorphic component library
│   ├── types/          # Shared TS types (request/response, models)
│   └── config/         # Shared eslint/tsconfig/prettier
├── infra/
│   ├── docker-compose.yml   # Postgres + Redis + Minio
│   └── github-actions/      # CI workflows
├── docs/               # This documentation set
├── schema/             # Prisma schema (canonical)
└── diagrams/           # Mermaid architecture diagrams
```

Workspace tool: **pnpm workspaces** (per PRD §23).

---

## Quick orientation for new engineers

If you have 30 minutes, read in this order:

1. [`docs/00-overview.md`](docs/00-overview.md) — what & why
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — how it all fits
3. [`diagrams/system-architecture.mmd`](diagrams/system-architecture.mmd) — one picture
4. [`docs/16-roadmap.md`](docs/16-roadmap.md) — where we are

If you have 2 hours, also read sections 02, 03, 09, 10, 13.

---

## Status

This package contains specification + architecture only. No implementation code has been written yet. The next step (Phase 1, Week 1) is to scaffold the monorepo per [`docs/11-frontend-architecture.md`](docs/11-frontend-architecture.md) and [`docs/12-backend-architecture.md`](docs/12-backend-architecture.md).

---

## License

TBD. Owner: Elskov.
