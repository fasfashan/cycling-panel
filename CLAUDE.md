# CLAUDE.md

Project context and working instructions for Claude Code. Read this fully before
writing or modifying code.

---

## 1. Project Overview

A **personal, single-user cycling dashboard** that pulls the owner's Strava data,
displays it as an auto-updating web app, and adds coaching/maintenance features that
Strava itself doesn't provide.

- **Owner / sole user:** Muhamad Fasha Fadillah (early-stage beginner cyclist, Bogor/Depok, Indonesia)
- **Goal:** A web dashboard that updates automatically whenever a new ride is uploaded
  to Strava — no manual refresh, no re-deploy.
- **Deploy target:** Vercel.
- **Status:** Greenfield. Building MVP first (see scope below).

### Rider context (use this to shape features and copy)

- Started cycling ~mid-June 2026. Very early base-building phase.
- Bike: **Element Montreal URB** — 700C hybrid, Shimano CUES 1x9, hydraulic disc.
- **No heart-rate, no power meter, no cadence sensor.** Metrics are GPS-derived only.
- Rides include local loops, CFD (Car Free Day) sessions, and errands.
- Enjoys tinkering with the bike (bottom bracket, crankset, cockpit) → maintenance
  features are high-value and personal.

---

## 2. Critical Context — READ FIRST

**This app talks to the official Strava REST API (`developers.strava.com`).**
It does **NOT** use any Claude/Anthropic "Strava MCP" connector. The MCP is a
Claude-internal bridge and is irrelevant to this codebase. All data flows through
Strava's public OAuth2 + REST API.

Because this is a **single-user app**, it lives in Strava's **"single-player mode"**:
only the owner's account authenticates, and **no Strava app review/approval is needed**.
Do **not** build a multi-user auth system, login screens, or per-user account tables.
There is exactly one athlete: the owner.

---

## 3. Tech Stack

| Layer        | Choice                                                        |
|--------------|---------------------------------------------------------------|
| Framework    | **Next.js (App Router)** — React + serverless API routes in one repo |
| Language     | **TypeScript**                                                |
| Styling      | **Tailwind CSS**                                              |
| Charts       | **Recharts** (or Chart.js) for trends/progression             |
| Data fetching| **SWR** (client revalidation)                                |
| Storage      | **Postgres (Neon)** or **Redis (Upstash)** via Vercel marketplace |
| Scheduling   | **Vercel Cron** and/or **Strava Webhooks**                    |
| Hosting      | **Vercel**                                                    |

Keep it lean. Don't add a heavy ORM if a thin query layer works; if an ORM is used,
prefer **Drizzle** or **Prisma**.

---

## 4. Architecture

### Auth (one-time setup, single user)

1. Register app at `developers.strava.com` → get **Client ID** + **Client Secret**.
2. Run the OAuth2 authorization flow **once** (scopes: `read,activity:read_all`).
3. Exchange the code for a **refresh_token** and store it as a **Vercel env secret**.
4. The `access_token` **expires every 6 hours** — always refresh server-side using the
   `refresh_token` before calling the API. Cache the live access token (in-memory or
   storage) with its `expires_at`.

> **Hard rule:** `STRAVA_CLIENT_SECRET` and the refresh token NEVER reach the browser.
> All Strava calls go through server-side API routes only.

### Data flow (auto-update)

Primary (preferred) — **Webhook push**:

```
New ride uploaded → Strava POSTs event → /api/strava/webhook (Vercel function)
  → fetch the new/updated activity → upsert into DB → frontend revalidates (SWR)
```

Fallback / supplement — **Cron poll**:

```
Vercel Cron (e.g. hourly) → /api/strava/sync → fetch recent activities
  → upsert new ones into DB
```

The frontend reads from **our DB**, not live from Strava on every load. This keeps us
well under rate limits and makes the UI fast. SWR handles client-side revalidation.

### Webhook setup notes

- Endpoint must be a public HTTPS URL (Vercel provides this).
- Strava sends a **GET validation handshake** with `hub.challenge` — the endpoint must
  echo it back to confirm the subscription.
- Subsequent events arrive as **POST** with `object_type`, `aspect_type`, `object_id`.
- On `create`/`update` for an activity, fetch that activity and upsert.

---

## 5. MVP Feature Scope

Build these four. Nothing else ships in v1.

### 5.1 Dashboard Overview
The landing view. Headline stats:
- Total distance, total rides, total elevation, total moving time.
- **Current streak** (consecutive ride days).
- **This week vs last week** (distance + ride count delta).

### 5.2 Progression & Trends ⭐ (core for a beginner)
- **Weekly distance** bar chart.
- **Speed progression** line chart (avg speed over time).
- **Cumulative elevation** over time.
- **Auto-detected PRs:** longest ride, fastest avg-speed ride, biggest single-ride climb.

### 5.3 Safe Ride Planner ⭐⭐ (key differentiator)
Coaching, not just display. The rider is ramping aggressively (2.5 km → 39 km in a week),
so this feature protects against overreach.
- Compute a **safe weekly target** using the ~**10%-per-week** progression heuristic on
  weekly volume.
- Suggest **next ride distance** based on recent rolling average.
- **Overreach warning** when actual or planned volume jumps too far above the safe curve
  (flag injury/burnout risk). Keep tone encouraging, not alarmist.

### 5.4 Gear & Maintenance Tracker ⭐⭐ (most personal to this rider)
- Track **distance per component/bike** (Strava gear exposes total distance per gear).
- **Service reminders** by distance interval: chain lube every ~X km, drivetrain clean,
  tire-pressure check, consumable wear (brake pads, chain, etc.).
- Let the user set/adjust intervals. Show "km since last service" + "km until next".

---

## 6. Out of Scope (Phase 2+) — do NOT build in MVP

- **AI "Ask the Coach"** (Anthropic API: weekly summaries, natural-language Q&A on the data).
- Maps / route heatmap from polylines.
- Weather correlation (Bogor rain context).
- Goals/milestones gamification + badges.
- Any multi-user / sharing / public-profile features.

---

## 7. Data Model (starting point)

Single athlete, so no users table. Suggested tables/keys:

- **activities** — `id` (Strava activity id, PK), `name`, `sport_type`, `start_local`,
  `distance_m`, `moving_time_s`, `elapsed_time_s`, `elevation_gain_m`, `avg_speed_ms`,
  `max_speed_ms`, `gear_id`, `pr_count`, `achievement_count`, raw JSON blob.
- **gear** — `id` (Strava gear id, PK), `name`, `type`, `total_distance_m`, `retired`.
- **maintenance** — `id`, `gear_id`, `task`, `interval_km`, `last_done_distance_m`, `notes`.
- **sync_state** — last sync cursor/time, cached access token + `expires_at`.

---

## 8. Strava API Reference (what we actually use)

- **Auth:** `POST /oauth/token` (authorization_code, then refresh_token grant).
- **Activities list:** `GET /athlete/activities` (paginated, metric units).
- **Single activity:** `GET /activities/{id}` (used by webhook handler).
- **Gear:** `GET /gear/{id}` and gear refs on the athlete profile.
- **Webhooks:** `POST /push_subscriptions` to subscribe; handle GET handshake + POST events.

### Units — IMPORTANT
Strava returns **metric**: distance in **meters**, speed in **m/s**.
- km = `distance_m / 1000`
- km/h = `avg_speed_ms * 3.6`
Convert at the display layer; store raw metric values.

### No HR / power / cadence
Those fields will be **null/absent**. Do **not** build features that depend on
heart-rate zones, power, or cadence. Stick to: distance, moving/elapsed time,
avg/max speed, elevation, PRs, frequency.

---

## 9. Rate Limits (design around these)

Official defaults (as of the API Agreement dated 1 June 2026):
- **Overall:** 200 requests / 15 min, 2,000 / day.
- **Read (non-upload):** 100 requests / 15 min, 1,000 / day.
- Exceeding returns **429**; over-limit requests still count toward the daily total.
- Limits reset at natural 15-min marks; daily resets at **midnight UTC**.

For a single-user dashboard with DB caching + webhooks, usage is trivial. The only real
risk is an un-cached **backfill** or a tight polling loop — avoid both. Webhooks are the
correct mechanism for near-real-time updates; do not poll aggressively.

---

## 10. Environment Variables

```
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=        # server-only, never exposed to client
STRAVA_REFRESH_TOKEN=        # owner's long-lived refresh token
STRAVA_WEBHOOK_VERIFY_TOKEN= # arbitrary string for the webhook handshake
DATABASE_URL=                # Neon Postgres (or Upstash Redis URL)
```

---

## 11. Security & Constraints

- Client Secret + tokens are **server-side only**. Never ship them to the browser or
  commit them. All Strava traffic proxies through Next.js API routes.
- Refresh the access token proactively (6-hour expiry); handle refresh failures gracefully.
- **Review the Strava API Agreement** (last updated 1 June 2026) before changing scope.
  Personal single-user display of the owner's own data is fine; publishing data publicly,
  showing other athletes' data, or adding AI analysis features may trigger additional
  terms — revisit before Phase 2.
- Respect Strava brand guidelines (e.g. "Connect with Strava" button, proper attribution)
  if any auth UI is shown.

---

## 12. Suggested Build Order

1. **Scaffold** — Next.js + TS + Tailwind on Vercel; env wiring; DB connection.
2. **Auth + sync** — OAuth one-time, token refresh helper, `/api/strava/sync`, upsert into DB.
3. **Dashboard Overview** (5.1) reading from DB.
4. **Progression & Trends** (5.2) with charts.
5. **Webhook** — subscription + handler for true auto-update; keep cron as fallback.
6. **Safe Ride Planner** (5.3).
7. **Gear & Maintenance Tracker** (5.4).

Ship 1–4 as the first usable version, then layer 5–7.

---

## 13. Conventions

- TypeScript strict mode on.
- Keep Strava API logic in a single `lib/strava/` module (auth, fetch, types).
- Store raw metric values; convert units only for display.
- Prefer server components / server-side fetching for data; use SWR for client revalidation.
- No secrets in client bundles. No `<form>` posting secrets. Validate webhook payloads.

---

## 14. UI & Visual Design Direction

The goal is a UI that looks intentionally designed, not auto-generated. Use **shadcn/ui**
for component primitives, but **customize the theme** — default shadcn (zinc/slate +
Inter + default radius) has itself become a recognizable "template" look. Override the
tokens, fonts, and radius so the result is ours.

### Design thesis
**A cycle-computer instrument panel.** The rider reads his bike computer mid-ride;
the dashboard should feel like that — precise, data-first, quiet. The *numbers are the
hero*, not decorative marketing blocks. This is grounded in the subject (a cyclist +
a tinkerer who likes mechanical precision), so it won't read as a generic minimal theme.

### Token system

**Color** (cool, near-monochrome + one restrained accent — derive shadcn CSS vars from these):
```
ink     #1A1C1E   /* primary text, near-black (cool, not pure #000) */
paper   #F4F5F6   /* app background — cool light grey, deliberately NOT cream */
surface #FFFFFF   /* cards / panels */
line    #E3E5E8   /* hairlines, borders, dividers */
muted   #6B7177   /* secondary text, labels */
accent  #0E5C4A   /* deep pine — used ONLY for active state, current-week data, PR/positive emphasis */
warn    #B4541E   /* used ONLY for overreach warnings — sparingly */
```
Spend boldness in one place: the accent appears on a *few* elements only (active nav,
the live/this-week value, PR badges). Everything else stays ink/grey/paper.

**Type** (do NOT use Inter — it's the AI/shadcn default):
- **Display / headings:** `Space Grotesk` — engineered, slightly mechanical character.
- **Body / UI:** `Hanken Grotesk` — warm, highly readable, not a default grotesque.
- **Numeric / metrics:** `JetBrains Mono` (or `Geist Mono`) with **tabular figures**
  (`font-variant-numeric: tabular-nums`). All stats render in mono — this is the signature.

Set a real type scale with intentional weights. Labels are small, uppercase, with
letter-spacing (instrument-readout feel). Sentence case for everything else.

**Layout & shape:**
- Generous whitespace, clear grid, strong data hierarchy. The hero is the **current
  state readout** (this-week / latest-ride metrics), not a gradient banner.
- Consistent small radius (**6–8px**) — not pill-shaped, not zero (zero = broadsheet AI default).
- Flat surfaces, hairline borders. Minimal, soft shadows only where elevation is meaningful.

**Signature element:** the **metric readout** — large mono number with tabular figures +
a small spaced uppercase label, styled like a cycle-computer screen. Reuse this component
everywhere stats appear so the whole app feels like one instrument.

### Hard "do NOT" list (these read as AI-generated)
- ❌ The three current AI-default looks: (1) cream `#F4F1EA` + serif display + terracotta
  accent; (2) near-black bg + single acid-green/vermilion accent; (3) broadsheet hairlines
  + zero radius + dense newspaper columns.
- ❌ Purple/violet or blue→purple **gradients**, neon glows, glassmorphism.
- ❌ Default shadcn theme shipped unchanged; Inter as the only/primary font.
- ❌ The template hero: one big number + gradient accent + small label.
- ❌ Emoji used as UI icons (use a real icon set, e.g. `lucide-react`, sized consistently).
- ❌ Over-animation. Keep motion minimal and purposeful (see below).

### Motion
Restrained only. Acceptable: a subtle count-up on metric mount, a gentle fade/slide when
data revalidates, quiet hover states. No parallax, no decorative looping animation.
Always respect `prefers-reduced-motion`.

### Quality floor (non-negotiable)
- Fully responsive, **mobile-first** (the owner is primarily on mobile).
- Visible keyboard focus states; proper contrast (WCAG AA).
- Tabular figures for every number so columns/tables don't jitter.
- If a dark mode is added, derive it from the same tokens — don't bolt on a second palette.