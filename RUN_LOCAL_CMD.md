# Run locally on Windows (CMD)

Step-by-step Command Prompt commands to get the project running on your machine.

Before you start: confirm everything in [REQUIREMENTS.md](REQUIREMENTS.md) is installed.

---

## Step 1 — Open Command Prompt in the project folder

```cmd
cd /d F:\project\ClaudCode\Project_tracker_app
```

Verify you're in the right place:

```cmd
dir /b
```

You should see `apps`, `packages`, `infra`, `docs`, `package.json`, etc.

---

## Step 2 — Install dependencies

```cmd
corepack enable
corepack prepare pnpm@9 --activate
pnpm install
```

First run takes 3-5 minutes. Subsequent installs are seconds.

If `corepack enable` fails with permission errors, open Command Prompt **as administrator** and rerun.

---

## Step 3 — Start the local infrastructure (Postgres + MongoDB + Redis + MailHog)

Make sure Docker Desktop is running (you'll see the whale icon in the system tray).

```cmd
pnpm docker:up
```

Wait ~20 seconds for the containers to come up. Verify they're all running:

```cmd
docker ps
```

You should see four containers: `drt-postgres`, `drt-mongo`, `drt-redis`, `drt-mailhog`.

---

## Step 4 — Configure the API

```cmd
copy apps\api\.env.example apps\api\.env
```

The defaults match what Docker Compose just brought up — **no edits needed for local dev**.

Open `apps\api\.env` in your editor of choice if you want to peek. The important lines for the MongoDB file storage are:

```
STORAGE_DRIVER=mongodb
MONGODB_URL=mongodb://app:app@localhost:27017/app?authSource=admin
```

---

## Step 5 — Migrate + seed the database

```cmd
pnpm --filter @app/api db:generate
pnpm --filter @app/api db:migrate
pnpm --filter @app/api db:seed
```

`db:generate` produces the Prisma client. `db:migrate` creates all tables. `db:seed` inserts test data:

- `super@example.com` / `password123` — super_admin
- `admin@example.com` / `password123` — admin
- `mod@example.com` / `password123` — moderator
- `alice@example.com` / `password123` — user with 4 routines + 7-day streak
- `bob@example.com` / `password123` — user
- 9 book categories + 2 sample books

---

## Step 6 — Run the services

You have two choices.

### Option A — everything in one terminal

```cmd
pnpm dev
```

Runs the API + admin web + Expo mobile dev server concurrently.

### Option B — separate terminals (recommended — easier to read logs)

Open **three** Command Prompt windows, each in the project folder, and run one of:

```cmd
:: Terminal 1
pnpm dev:api
```

```cmd
:: Terminal 2
pnpm dev:web
```

```cmd
:: Terminal 3
pnpm dev:mobile
```

---

## Step 7 — Smoke-test the API

Open a new Command Prompt:

```cmd
curl http://localhost:4000/health
```

Expected: `{"status":"ok","ts":"..."}`.

Sign in as Alice:

```cmd
curl -X POST http://localhost:4000/api/v1/auth/login -H "content-type: application/json" -d "{\"email\":\"alice@example.com\",\"password\":\"password123\"}"
```

Copy the `accessToken` from the response. Then list her tasks:

```cmd
curl http://localhost:4000/api/v1/tasks -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE"
```

You should see Alice's 4 routines.

---

## Step 8 — Open the admin web

Open <http://localhost:3000> in your browser. Sign in with `admin@example.com` / `password123`.

You'll see:

- Dashboard with user count, pending moderation, open reports
- Moderation queue with Alice's pending "Deep Work" book
- Feature flags page (create + toggle + bump rollout)
- Audit log

---

## Step 9 — Open the mobile app

In the `pnpm dev:mobile` terminal you'll see a QR code and a list of options:

```
› Press i │ open iOS
› Press a │ open Android
› Press w │ open web
```

### To use Expo Go on your phone (simplest)

1. Install **Expo Go** from the Play Store / App Store.
2. Make sure your phone and PC are on the same Wi-Fi.
3. Open Expo Go and scan the QR code shown in the terminal.

If the mobile app can't reach your API, you need to set the API URL to your PC's LAN IP. Find your IP:

```cmd
ipconfig
```

Look for the line `IPv4 Address. . . . . . . . . . . : 192.168.X.X`. Then stop the mobile server (Ctrl+C) and restart:

```cmd
set EXPO_PUBLIC_API_URL=http://192.168.X.X:4000/api/v1
pnpm dev:mobile
```

### To use an Android emulator

After Android Studio is installed, open it, go to **More Actions → Virtual Device Manager**, create a Pixel 7 + Android 14 image, start it, then press `a` in the Expo terminal.

### To use the iOS simulator (macOS only)

Press `i` in the Expo terminal. Xcode must be installed.

---

## Step 10 — Test the file upload (MongoDB GridFS)

The API uses MongoDB GridFS for book files. Here's the upload flow:

```cmd
:: 1) Sign in to get a token
curl -X POST http://localhost:4000/api/v1/auth/login -H "content-type: application/json" -d "{\"email\":\"alice@example.com\",\"password\":\"password123\"}"

:: 2) Set the token (paste the accessToken)
set TOKEN=PASTE_ACCESS_TOKEN_HERE

:: 3) Ask for an upload URL (replace PDF size with the actual file)
curl -X POST http://localhost:4000/api/v1/books/upload-url ^
  -H "content-type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"filename\":\"test.pdf\",\"format\":\"pdf\",\"sizeBytes\":1024}"

:: 4) PUT the file to the returned uploadUrl
curl -X PUT "PASTE_UPLOAD_URL_HERE" ^
  -H "content-type: application/pdf" ^
  --data-binary "@path\to\your.pdf"

:: 5) Register the book
curl -X POST http://localhost:4000/api/v1/books ^
  -H "content-type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"bookId\":\"PASTE_bookId_FROM_STEP_3\",\"title\":\"My Test Book\"}"
```

To verify the file made it to MongoDB:

```cmd
docker exec -it drt-mongo mongosh -u app -p app --authenticationDatabase admin
```

In the Mongo shell:

```javascript
use app
db.books_files.files.find()   // metadata
db.books_files.chunks.countDocuments()   // # of 255KB chunks
exit
```

---

## Step 11 — Run the tests

```cmd
pnpm --filter @app/api test
```

This runs the Vitest suite against a `app_test` Postgres database. First time only, create that database:

```cmd
docker exec drt-postgres createdb -U app app_test
pnpm --filter @app/api db:migrate
```

The suite covers auth, tasks CRUD, completion idempotency, streak math, and RBAC.

---

## Step 12 — Tear down

Keep data (volumes persist):

```cmd
pnpm docker:down
```

Wipe everything (full reset):

```cmd
docker compose -f infra/docker-compose.yml down -v
```

Nuke and reinstall from scratch:

```cmd
pnpm fresh
```

---

## Common issues

| Symptom | Fix |
|---|---|
| `pnpm: command not found` | Re-run `corepack enable` then close + reopen Command Prompt |
| Docker says "Cannot connect to the Docker daemon" | Open Docker Desktop and wait for the whale icon to be steady |
| `EADDRINUSE :::4000` | Another process owns port 4000. Stop it or change `PORT` in `apps\api\.env` |
| Mobile app shows "Network request failed" | Set `EXPO_PUBLIC_API_URL` to your LAN IP (see Step 9) |
| Tests fail with `ECONNREFUSED 127.0.0.1:5432` | `pnpm docker:up` first, then re-run tests |
| Prisma errors about a missing client | Run `pnpm --filter @app/api db:generate` |

---

## Where to next

- Deploy this to the cloud for free → [DEPLOY.md](DEPLOY.md)
- Pick up the next phase of the roadmap → [docs/16-roadmap.md](docs/16-roadmap.md)
