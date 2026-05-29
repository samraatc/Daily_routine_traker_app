# Requirements

Everything you need installed before running the project. All commands assume Windows CMD (you can also paste them in PowerShell — they work identically). macOS/Linux equivalents are in tiny italics where they differ.

---

## 1. The absolute minimum (just to run the API + admin web)

| Tool | Version | Why | Install |
|---|---|---|---|
| **Node.js** | 20 LTS | Runs the Fastify API + Next.js admin web | Download installer from <https://nodejs.org> (LTS button) |
| **pnpm** | 9.x | Workspace package manager | After Node, run `corepack enable` then `corepack prepare pnpm@9 --activate` |
| **Git** | latest | Clone the repo | <https://git-scm.com/download/win> |
| **Docker Desktop** | latest | Postgres + MongoDB + Redis in one command | <https://www.docker.com/products/docker-desktop> |

That's it for the **API + admin web** path. Mobile dev adds two more.

---

## 2. Extra tools for the mobile app

| Tool | When you need it | Install |
|---|---|---|
| **Expo Go** (on your phone) | Quick preview on your real device | Install from the App Store / Play Store on your phone |
| **Android Studio** | Android emulator + native builds | <https://developer.android.com/studio> |
| **Java JDK 17** | Required by Android Studio's Gradle | Android Studio installs it; or use Temurin <https://adoptium.net> |
| **Xcode 15+** | iOS simulator + native builds (macOS only) | Mac App Store |

For a quick test you only need **Expo Go on your phone** — no Android Studio or Xcode required.

---

## 3. Free accounts for deployment

You'll create these in [DEPLOY.md](DEPLOY.md). All are free for hobby use:

| Service | What for | Free tier |
|---|---|---|
| **GitHub** | Code hosting | unlimited public + private repos |
| **Render** | API hosting | 750 hours/month free; sleeps after 15 min idle |
| **Vercel** | Admin web hosting | Hobby tier free for personal projects |
| **Neon** | Managed Postgres | 0.5 GB storage, 191 compute hours/month |
| **MongoDB Atlas** | Managed MongoDB (book files via GridFS) | 512 MB M0 cluster, free forever |
| **Expo (EAS)** | Mobile build pipeline | 30 builds/month on the free plan |
| **Upstash** *(optional, Phase 3)* | Redis for the reminder queue | 10k commands/day free |

---

## 4. Verify your install (Windows CMD)

Open Command Prompt and paste each line. Expected output is shown to the right.

```cmd
node --version
:: v20.x.x

corepack enable
corepack prepare pnpm@9 --activate
pnpm --version
:: 9.x.x

git --version
:: git version 2.x.x

docker --version
:: Docker version 27.x.x

docker compose version
:: Docker Compose version v2.x.x
```

If any of those returns "is not recognized as an internal or external command", reinstall that tool and reopen the Command Prompt window so the PATH picks up the new install.

---

## 5. Hardware

| Resource | Minimum | Comfortable |
|---|---|---|
| RAM | 8 GB | 16 GB (Docker + Android emulator can eat 6 GB) |
| Disk | 10 GB free | 20 GB |
| OS | Windows 10 22H2 / Windows 11 | Windows 11 |

Docker Desktop requires Hyper-V or WSL 2 on Windows. The installer handles this automatically; if it fails, follow <https://learn.microsoft.com/windows/wsl/install>.

---

## 6. What's next

- Run the project locally → [RUN_LOCAL_CMD.md](RUN_LOCAL_CMD.md)
- Deploy to free tiers → [DEPLOY.md](DEPLOY.md)
