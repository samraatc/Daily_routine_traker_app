# How to run

This guide takes you from a fresh clone to a running API + admin web + mobile app on your machine.

---

## 1. Prerequisites

| Tool | Minimum | Install |
|---|---|---|
| Node.js | 20 LTS | <https://nodejs.org> (`.nvmrc` pins 20) |
| pnpm | 9 | `npm i -g pnpm@9` |
| Docker | latest | <https://docs.docker.com> |
| Expo CLI | (bundled) | comes via `pnpm install` |
| Xcode (iOS) | 15+ | App Store, macOS only |
| Android Studio | latest | <https://developer.android.com/studio> |

---

## 2. Install dependencies

```bash
pnpm install
```

This installs every workspace at once.

---

## 3. Start local infrastructure

```bash
pnpm docker:up
```

Brings up Postgres 16, Redis 7, MinIO (S3-compatible), and MailHog. See [`infra/README.md`](infra/README.md) for details.

---

## 4. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
```

The defaults in `.env.example` match what `docker compose` exposes — no edits needed for local dev.

---

## 5. Migrate + seed the database

```bash
pnpm --filter @app/api db:generate
pnpm --filter @app/api db:migrate
pnpm --filter @app/api db:seed
```

Seed produces:
- `super@example.com` / `password123` (super_admin)
- `admin@example.com` / `password123` (admin)
- `mod@example.com` / `password123` (moderator)
- `alice@example.com` / `password123` (user — has 7 days of streaks + 4 routines)
- `bob@example.com` / `password123` (user)
- 9 book categories + 2 sample books (1 public, 1 pending review)

---

## 6. Run everything

### Option A — one command for all services

```bash
pnpm dev
```

Starts `apps/api` (http://localhost:4000), `apps/admin-web` (http://localhost:3000), and the Expo dev server.

### Option B — per service

```bash
pnpm dev:api      # API only — http://localhost:4000
pnpm dev:web      # admin web — http://localhost:3000
pnpm dev:mobile   # Expo dev client — scan QR with Expo Go OR press 'i' / 'a'
```

---

## 7. Smoke-test the API

```bash
# Health check
curl http://localhost:4000/health
# -> {"status":"ok","ts":"…"}

# Sign in as Alice
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'
# -> {"accessToken":"…","refreshToken":"…","user":{…}}

# Use the access token
TOKEN="<paste accessToken>"
curl http://localhost:4000/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN"
# -> Alice's 4 seeded routines

# Mark today done
curl -X POST http://localhost:4000/api/v1/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"taskId":"<one of Alice's task ids>"}'
# -> { completion, streak: { currentStreak, longestStreak, lastCompletedDate } }
```

---

## 8. Run tests

```bash
pnpm test                      # all workspaces
pnpm --filter @app/api test    # API only (Vitest + Supertest)
```

The API tests boot a real Fastify instance and hit a real Postgres — make sure `pnpm docker:up` is running, with a `app_test` database created:

```bash
docker exec drt-postgres createdb -U app app_test
```

Test files live in `apps/api/test/`:

- `health.test.ts` — liveness + version
- `auth.test.ts` — register / login / refresh / me / 401 paths
- `tasks.test.ts` — full CRUD round-trip, cross-user isolation, validation
- `completions.test.ts` — idempotency of Mark Done, streak extension, undo
- `rbac.test.ts` — role enforcement on /admin/*

---

## 9. Open the admin web

Visit <http://localhost:3000> and sign in as `admin@example.com` / `password123`. You'll land on the dashboard with pending-moderation + open-reports + overview counters. The moderation queue, feature flags, audit log, and users pages are all wired up.

---

## 10. Run the mobile app

```bash
pnpm dev:mobile
```

- **iOS:** Press `i` in the Expo terminal.
- **Android:** Press `a` (emulator) or scan the QR with Expo Go.
- **Physical device on the same network:** scan the QR with Expo Go.

> If the mobile app can't reach the API, set `EXPO_PUBLIC_API_URL` before `pnpm dev:mobile` to your machine's LAN IP, e.g. `http://192.168.1.42:4000/api/v1`.

Sign in with `alice@example.com` / `password123` to see her 4 routines, a 7-day streak flame, and a working Today tab. Tap a task to mark it done; the ring fills with the spring animation.

---

## 11. What's where (quick map)

| Surface | URL / port | Default user |
|---|---|---|
| API | http://localhost:4000 | — |
| API docs (when built) | http://localhost:4000/api/v1/docs | — |
| Admin web | http://localhost:3000 | admin@example.com / password123 |
| Mobile (Expo dev tools) | http://localhost:8081 | alice@example.com / password123 |
| MinIO console | http://localhost:9001 | minioadmin / minioadmin |
| MailHog inbox | http://localhost:8025 | — |
| Postgres | localhost:5432 | app / app / db `app` |
| Redis | localhost:6379 | — |

---

## 12. Tear down

```bash
pnpm docker:down      # keep volumes (data persists)
docker compose -f infra/docker-compose.yml down -v   # wipe everything
pnpm fresh            # nuke node_modules + volumes + reinstall + bring infra back up
```

---

## 13. Where to look next

| If you want to… | Read |
|---|---|
| Understand the whole system | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Know what's built vs. what's still on the roadmap | [`STATUS.md`](STATUS.md) |
| Add a new endpoint | [`docs/10-api-contracts.md`](docs/10-api-contracts.md) + [`docs/12-backend-architecture.md`](docs/12-backend-architecture.md) |
| Add a new mobile screen | [`docs/11-frontend-architecture.md`](docs/11-frontend-architecture.md) + [`docs/03-design-system.md`](docs/03-design-system.md) |
| Roll the next phase | [`docs/16-roadmap.md`](docs/16-roadmap.md) |
