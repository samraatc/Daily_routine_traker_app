# 00 — Overview, Product Definition & Personas

> Maps to PRD sections 1, 2, 3.
> **When to read:** Day 1 of the project, before any technical decisions.

This document answers three questions: **why** we are building this product, **what** it is, and **who** it is for. Every later decision — every component, schema, endpoint, motion curve — should be traceable back to something in this document.

---

## 1. Executive summary

The Daily Routine & E-Book Tracker is a **native mobile app** that helps users build consistent daily habits while giving them a beautiful place to read. It merges a productivity tracker with a personal library — both wrapped in a tactile, Neumorphic 3D interface and animated with scroll-triggered motion. Reminders nudge users at the right time; the admin console gives operators full control over content moderation and feature rollouts.

The app is built on **React Native** (single codebase for Android & iOS), uses **Reanimated 3** and **Moti** to deliver Framer-Motion-style animations natively, **Firebase Cloud Messaging** for cross-platform push, and a hardened **Node.js + PostgreSQL** backend with role-based access control.

### Primary outcomes (success criteria)

| Outcome | Target | Measured by |
|---|---|---|
| Higher routine completion | +35% completion rate | `Completion` rows ÷ scheduled tasks, weekly |
| Sustained reading habit | ≥ 4 reading sessions/week per active user | `ReadingProgress` sessions / WAU |
| Operator self-service | Moderate + roll out features without engineers | Admin panel audit log of operator actions |

These three numbers are the **only** product KPIs that should appear on the executive dashboard. Everything else is diagnostic.

---

## 2. Product definition

### 2.1 Vision

> Build a delightful, tactile companion that turns daily routines into rituals — and gives users a calm, private space to read books that support those routines.

### 2.2 Problem statement

Existing tools fail users in four specific ways:

1. **Routine trackers feel flat and forgettable.** Most look like spreadsheets. There is no tactile feedback or sense of depth to make completing a task feel rewarding.
2. **Productivity apps do not surface knowledge.** They tell you *what* to do but never *how to learn* to do it. The books and guides that actually change behaviour sit in a separate ecosystem.
3. **Self-uploaded reading material is scattered.** PDFs and EPUBs live in cloud drives with no offline-first, full-screen reader. Reading on a phone is a hostile experience.
4. **No governance layer for safe community sharing.** Apps that allow uploads typically have no moderation, no copyright safeguards, no reporting flow.

### 2.3 Differentiators (what makes this product distinct)

| Differentiator | Why it matters |
|---|---|
| **Neumorphic 3D UI** — every button, card and toggle has depth; shadows, highlights and elevation change on touch | Tactile feedback makes habit completion feel physical, increasing repeat use |
| **Cinema-grade motion** — scrolls, swipes and reveals choreographed with Reanimated worklets | Motion communicates progress; 60-120fps signals "premium" |
| **Library + Tracker fused** — recommended reading tied to routine tags (e.g. *Atomic Habits* for a morning streak) | Closes the gap between intention and education |
| **Bring-your-own-book** — users upload PDFs/EPUBs and choose private or public visibility | Eliminates the cloud-drive friction; respects ownership |
| **Operator-first admin panel** — full moderation, analytics, feature flags, broadcast push | Lets operators scale and govern without engineering tickets |

### 2.4 Non-goals (explicit)

To prevent scope creep, the following are **out of scope** for v2.0:

- Social features (followers, comments, public profiles)
- Real-time chat or messaging
- Audio-book playback
- Web-based mobile app (PWA was v1; v2 is native)
- DRM beyond at-rest encryption (no licensing system, no per-page tokens)
- Cross-device sync of highlights to third parties (Goodreads, etc.)

Add anything here that the team is tempted to build but should defer to v3.

---

## 3. Target users & personas

Four personas drive every design and engineering decision. When a feature is proposed, ask: *does this serve Priya, Marco, Anya, or Ravi? If not, why are we building it?*

### 3.1 Priya — 24, medical student

| | |
|---|---|
| **Goal** | Stick to a fixed study + sleep routine through rotations |
| **Pain today** | Phone reminders are too easy to dismiss; her board-prep books are scattered across Drive and email |
| **What we deliver** | Push reminders with a **Mark Done** action button (no app-open required), plus offline access to her downloaded books for the hospital basement where there's no signal |
| **Devices** | Android mid-range (Samsung A-series), often on Wi-Fi only |
| **Sensitivity** | Quiet hours during night shifts |

### 3.2 Marco — 38, founder recovering from burnout

| | |
|---|---|
| **Goal** | Re-establish a morning routine and read at least one book per month |
| **Pain today** | Productivity apps feel sterile and clinical; he physically winces opening them |
| **What we deliver** | Neumorphic UI with calm motion (no sharp angles, no aggressive colour); downloadable curated reading list tied to his routines |
| **Devices** | iPhone 14 Pro |
| **Sensitivity** | Hates ads, hates notifications outside business hours |

### 3.3 Anya — 17, high-school athlete

| | |
|---|---|
| **Goal** | Build a daily training + recovery routine and share coach's notes with teammates |
| **Pain today** | Pricey apps are out of budget; she can't share her coach's PDF playbooks |
| **What we deliver** | Free tier with full features; ability to upload coach PDFs and publish them publicly (with moderation) so her team can find them |
| **Devices** | Older iPhone (handed down), patchy connectivity at school |
| **Sensitivity** | Tight phone storage — needs the storage manager |

### 3.4 Ravi — 45, operator/admin

| | |
|---|---|
| **Goal** | Run a clean community library at scale, send timely broadcasts, catch abuse fast |
| **Pain today** | Existing platforms have no governance — every issue becomes an engineering ticket |
| **What we deliver** | Full admin panel with moderation queue, feature flags with rollout %, broadcast push composer with cohort filters, immutable audit log |
| **Devices** | Desktop (Next.js admin web) primarily; mobile admin tab as a backup |
| **Sensitivity** | Audit-trail completeness is a compliance requirement |

---

## 4. Persona → feature traceability

This matrix is the team's reference for prioritisation. A feature with no persona owner is a candidate for the non-goals list.

| Feature module (see [`01-features.md`](01-features.md)) | Priya | Marco | Anya | Ravi |
|---|:---:|:---:|:---:|:---:|
| Routine Tracker | ★ | ★ | ★ | |
| Completion Engine | ★ | ★ | ★ | |
| Push Reminders | ★ | ★ | ★ | |
| Neumorphic UI | | ★ | | |
| Scroll-Triggered Motion | | ★ | | |
| E-Book Reader (Online) | ★ | ★ | ★ | |
| E-Book Reader (Offline) | ★ | | ★ | |
| User Uploads | ★ | | ★ | |
| Public Library | | ★ | ★ | |
| Admin Panel | | | | ★ |
| Notifications Center | ★ | ★ | ★ | ★ |
| Settings (GDPR + quiet hours) | ★ | ★ | ★ | |
| Analytics dashboard | | | | ★ |

---

## 5. What success looks like at soft launch (week 12)

By the end of Phase 8 the product must demonstrate:

- A first-time user can sign up, complete onboarding, create three routines and finish their first day in under 5 minutes.
- A returning user receives a reminder push, taps **Mark Done** from the notification, and never has to open the app.
- A user can upload a PDF, set it public, and see it appear in the community library within 1 hour (moderation SLA).
- An admin can suspend a user, push a broadcast to a cohort, and ship a feature flag — all from the web panel — and every action shows in the audit log.
- The reader works **fully offline** for any book the user has downloaded.

These are the demo flows we will record (Maestro) for the launch video.

---

## Next reading

- **What to build** → [`01-features.md`](01-features.md)
- **What to build it with** → [`02-tech-stack.md`](02-tech-stack.md)
