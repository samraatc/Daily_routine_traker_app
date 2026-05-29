# Deploy to free tiers — full guide

End-to-end deployment of the Daily Routine & E-Book Tracker using only free tiers. After this guide you'll have:

| Surface | Hosted on | URL pattern |
|---|---|---|
| **Backend API** | Render (free web service) | `https://drt-api.onrender.com` |
| **Admin web** | Vercel (hobby tier) | `https://drt-admin.vercel.app` |
| **Postgres** | Neon (free tier) | private — only the API talks to it |
| **MongoDB** (book files via GridFS) | MongoDB Atlas M0 (free 512 MB) | private |
| **Mobile app builds** | Expo EAS (free 30/month) | TestFlight / Play Internal |

Total cost: **$0/month** for hobby usage. Limits documented at the end of each section.

> **Conventions in this guide**
> - Every command is for **Windows CMD**. macOS/Linux equivalents are identical except `set X=Y` becomes `export X=Y`.
> - "Run this:" means open Command Prompt in `F:\project\ClaudCode\Project_tracker_app` and paste.

---

## Big picture

```
       ┌──────────────────┐
       │  Mobile (Expo)   │── reads EXPO_PUBLIC_API_URL ──┐
       └──────────────────┘                                │
                                                           ▼
                                              ┌─────────────────────┐
       ┌──────────────────┐                   │   Render Web        │
       │  Admin Web       │── NEXT_PUBLIC ──► │   ─ Fastify API     │
       │  (Vercel)        │                   │   ─ TypeScript      │
       └──────────────────┘                   └────────┬────────────┘
                                                       │
                                  ┌────────────────────┼────────────────────┐
                                  ▼                    ▼                    ▼
                           ┌────────────┐     ┌──────────────┐    ┌─────────────────┐
                           │  Neon      │     │ MongoDB      │    │  Upstash Redis  │
                           │  Postgres  │     │ Atlas (M0)   │    │  (optional, P3) │
                           │ relational │     │ GridFS files │    │                 │
                           └────────────┘     └──────────────┘    └─────────────────┘
```

---

## Step 0 — Push the code to GitHub

Render and Vercel both deploy from a GitHub repo.

```cmd
cd /d F:\project\ClaudCode\Project_tracker_app

git init
git add .
git commit -m "feat: initial commit — phase 1+2+4+6+7"
```

Create a new **empty** repo on GitHub (Settings → don't initialise with README). Then:

```cmd
git remote add origin https://github.com/YOUR_USER/daily-routine-tracker.git
git branch -M main
git push -u origin main
```

---

## Step 1 — Provision Postgres on Neon (free)

1. Sign up at <https://console.neon.tech>.
2. Create a new project (`drt-prod`). Pick the region closest to where you'll host Render (`US East`).
3. Once it boots, open the **Dashboard → Connection details** panel.
4. Copy the **Connection string** under "Direct connection". It looks like:
   ```
   postgresql://USER:PASS@ep-something.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Save it — you'll paste it into Render's env vars in Step 4 as `DATABASE_URL`.

**Free tier**: 0.5 GB storage, 191 compute-hours / month, auto-suspends after 5 min idle (cold start ~1s).

---

## Step 2 — Provision MongoDB on Atlas (free)

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. Create a new project (`drt-prod`).
3. Click **Build a Database → M0** (the free option). Pick the region closest to Render.
4. Click **Create**. Wait ~3 minutes for the cluster to provision.
5. Set up authentication:
   - **Username/password**: create a user `app` with a generated password (save it).
   - **Network access**: add `0.0.0.0/0` (Render's IPs change). For a tightened deploy, add Render's egress IP later.
6. Once provisioned, click **Connect → Drivers** and copy the connection string. It looks like:
   ```
   mongodb+srv://app:PASS@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
7. Add the database name `app` before the `?`:
   ```
   mongodb+srv://app:PASS@cluster0.xxxx.mongodb.net/app?retryWrites=true&w=majority
   ```
8. Save it — you'll paste this into Render as `MONGODB_URL` in Step 4.

**Free tier**: 512 MB storage, shared cluster. Plenty for hundreds of PDFs.

---

## Step 3 — Generate a JWT secret

The API needs a 32+ character secret. Run this in Command Prompt:

```cmd
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copy the output — that's your `JWT_SECRET` for Step 4.

---

## Step 4 — Deploy the backend API to Render

### 4a — Add a build + start manifest to the repo

Create `apps/api/render.yaml`:

```cmd
notepad apps\api\render.yaml
```

Paste:

```yaml
services:
  - type: web
    name: drt-api
    env: node
    region: ohio
    plan: free
    rootDir: apps/api
    buildCommand: corepack enable && pnpm install --frozen-lockfile=false && pnpm --filter @app/types build && pnpm prisma generate && pnpm build
    startCommand: node dist/server.js
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: LOG_LEVEL
        value: info
      - key: STORAGE_DRIVER
        value: mongodb
      - key: DATABASE_URL
        sync: false
      - key: MONGODB_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: PUBLIC_API_URL
        sync: false
```

Commit + push:

```cmd
git add apps\api\render.yaml
git commit -m "ci: render manifest"
git push
```

### 4b — Create the Render service

1. Sign up at <https://render.com>.
2. Click **New + → Web Service**.
3. Connect your GitHub account and pick the repo.
4. Render will detect `render.yaml` and pre-fill most fields. Confirm:
   - Branch: `main`
   - Root directory: `apps/api`
   - Build command: (as above)
   - Start command: `node dist/server.js`
   - Plan: **Free**
5. On the **Environment** tab, paste the secrets:
   - `DATABASE_URL` → the Neon URL from Step 1
   - `MONGODB_URL` → the Atlas URL from Step 2
   - `JWT_SECRET` → the value from Step 3
   - `PUBLIC_API_URL` → leave blank for now; come back and set to the Render URL once it's known (e.g. `https://drt-api.onrender.com/api/v1`)
6. Click **Create Web Service**. First build takes ~5 minutes.
7. Once "Live", note your URL — it will look like `https://drt-api.onrender.com`.
8. Edit `PUBLIC_API_URL` to `https://drt-api.onrender.com/api/v1` and redeploy.

### 4c — Migrate the production database

Render's free plan doesn't include a pre-deploy hook on free tier, so run migrations from your laptop pointing at Neon:

```cmd
set DATABASE_URL=PASTE_NEON_URL_HERE
pnpm --filter @app/api db:migrate:deploy
pnpm --filter @app/api db:seed
```

### 4d — Smoke test

```cmd
curl https://drt-api.onrender.com/health
```

Expected: `{"status":"ok","ts":"..."}`.

> **Heads up**: the Free plan sleeps after 15 minutes of inactivity. First request after a sleep takes ~30 seconds.

**Free tier**: 750 hours/month, sleeps after 15 min idle.

---

## Step 5 — Deploy the admin web to Vercel

### 5a — Create the Vercel project

1. Sign up at <https://vercel.com> using your GitHub account.
2. Click **Add New → Project** and pick the repo.
3. On the **Configure Project** screen:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `apps/admin-web`
   - **Build Command**: `pnpm --filter @app/types build && pnpm --filter @app/admin-web build`
   - **Install Command**: `corepack enable && pnpm install --frozen-lockfile=false`
   - **Output Directory**: `.next`
4. Expand **Environment Variables** and add:
   - `NEXT_PUBLIC_API_URL` = `https://drt-api.onrender.com/api/v1`
5. Click **Deploy**.

### 5b — Smoke test

After ~2 minutes the deploy completes. Open the assigned URL (e.g. `https://drt-admin.vercel.app`).

Sign in with `admin@example.com` / `password123` (the seed user from Step 4c). You'll land on the dashboard.

**Free tier**: unlimited bandwidth, 100 GB serverless function execution, hobby use only.

---

## Step 6 — CORS

The admin web's domain needs to be allowed by the API. The default `fastify/cors` config in `apps/api/src/server.ts` uses `origin: true` which accepts any origin — fine for hobby. To tighten:

Edit `apps/api/src/server.ts`:

```ts
await app.register(cors, {
  origin: ['https://drt-admin.vercel.app', 'http://localhost:3000'],
  credentials: true,
});
```

Commit, push, Render auto-redeploys.

---

## Step 7 — Build the mobile app with Expo EAS

### 7a — Install the EAS CLI

```cmd
pnpm install -g eas-cli
eas login
```

(Create an Expo account when prompted; it's free.)

### 7b — Initialise EAS in the mobile app

```cmd
cd /d F:\project\ClaudCode\Project_tracker_app\apps\mobile
eas init
```

This creates an `eas.json` and links the app to your Expo account.

### 7c — Configure environment

Edit `apps/mobile/eas.json` to point production builds at your Render API:

```json
{
  "cli": { "version": ">= 5.9.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "http://localhost:4000/api/v1" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://drt-api.onrender.com/api/v1" }
    },
    "production": {
      "env": { "EXPO_PUBLIC_API_URL": "https://drt-api.onrender.com/api/v1" }
    }
  },
  "submit": { "production": {} }
}
```

### 7d — Build for Android (preview channel)

```cmd
eas build --platform android --profile preview
```

EAS does the build on their servers. ~15 minutes later you get an APK download link. Send the link to your phone, install, and run.

### 7e — Build for iOS

iOS requires an Apple Developer account (**$99/year** — not free), so for a free deploy:

- **Use the Expo Go app**: in your mobile dev terminal, the QR code from `pnpm dev:mobile` works on any iPhone with Expo Go installed.
- Or wait until you have an Apple Developer account, then `eas build --platform ios --profile preview` produces a TestFlight build.

**Free tier**: 30 builds/month on the free EAS plan. After 30 you wait until the calendar month resets.

---

## Step 8 — (Optional, Phase 3) Add Redis for the reminder worker

When you're ready to ship Phase 3 reminders, you need Redis. Free option: **Upstash**.

1. Sign up at <https://upstash.com>.
2. Create a database (Regional, closest to Render).
3. Copy the **REST URL** + **REST Token** for HTTP, OR the **redis://** URL for raw protocol.
4. In Render's env vars, add `REDIS_URL=PASTE_URL_HERE`.
5. Redeploy.

**Free tier**: 10k commands/day, 256 MB storage.

---

## Step 9 — Custom domains (optional)

| Surface | How |
|---|---|
| Admin web | Vercel → Project → Settings → Domains → add `admin.your-domain.com` |
| API | Render → Service → Settings → Custom Domains → add `api.your-domain.com` |
| Mobile | Update `EXPO_PUBLIC_API_URL` to the custom domain + rebuild via EAS |

After adding a custom domain, update CORS in the API (Step 6) to include it.

---

## Step 10 — Verify the end-to-end flow

| Test | How | Pass if… |
|---|---|---|
| API health | `curl https://drt-api.onrender.com/health` | returns `{"status":"ok"...}` |
| Admin sign in | Browse to your Vercel URL, sign in as `admin@example.com` | dashboard shows user count, moderation queue, audit log |
| Mobile sign in | Open the APK / Expo Go build, sign in as `alice@example.com` | Today tab shows Alice's 4 routines + 7-day streak |
| Mobile mark done | Tap a task | ring fills, streak count persists across app reopen |
| File upload | Use `curl` from RUN_LOCAL_CMD.md §10 against your production API | object appears in MongoDB Atlas → Browse Collections → `books_files.files` |
| Moderation | Admin web → Moderation → Approve "Deep Work" | book transitions to `public` in Atlas |

---

## Costs summary

| Resource | Free tier ceiling | What pushes you over |
|---|---|---|
| Render (API) | 750 hr/month + sleeps after 15 min | A custom always-on service ($7/mo Starter) |
| Vercel (admin) | 100 GB bandwidth | Sustained traffic above hobby use |
| Neon (Postgres) | 0.5 GB / 191 compute hr | More than a few thousand active users |
| MongoDB Atlas (M0) | 512 MB | More than ~500 PDFs at avg 1 MB |
| Expo EAS | 30 builds/mo | Daily release cadence |
| Upstash | 10k commands/day | Heavy reminder traffic |

For an active small-userbase product (under a few hundred users), this entire stack stays free indefinitely.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Application failed to respond` on Render | Build failed; check the deploy logs | Look at the **Logs** tab; usually a missing env var |
| API returns 500 on first request | Free plan cold start | Wait 30s and retry; subsequent calls are fast |
| Admin can't reach API | CORS or wrong `NEXT_PUBLIC_API_URL` | Update CORS in `server.ts` and redeploy |
| `MongoServerError: bad auth` | Atlas user password has special chars | URL-encode the password in `MONGODB_URL` |
| Prisma migration hangs | Neon project is suspended | Open Neon dashboard once to wake it, retry |
| Mobile build "Network request failed" | Wrong `EXPO_PUBLIC_API_URL` in eas.json | Edit eas.json + run `eas build` again |

---

## What you've shipped

A production-ready cross-platform habit-tracking + e-book reading app, hosted on free infrastructure, with:

- Real auth (JWT + refresh rotation)
- Routine CRUD with idempotent completions + streak engine
- Stats engine (weekly heatmap + streaks + reading minutes)
- Public book library with moderation workflow
- Admin panel with RBAC + audit log
- File storage via MongoDB GridFS (no S3 needed)
- Mobile app on Android (and iOS via Expo Go)

Next: pick up Phase 3 (reminders) or Phase 5 (e-book reader) from [docs/16-roadmap.md](docs/16-roadmap.md).
