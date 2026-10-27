# SkillGig

**Freelancing for students, where nobody gets cheated.**

SkillGig is a marketplace where students post small paid gigs (a logo, typed notes, a small website, a video edit) and other students take them on. The client's money is held in **escrow** by the platform and released milestone by milestone only when the work is approved. If the two sides disagree, an admin reviews the evidence and decides.

- **Live app:** _add Vercel URL here_
- **API:** _add Render URL here_ (health check: `/api/health`)
- **Demo video:** _add link here_

## Problem Statement

Students already trade skills informally through WhatsApp groups and Instagram DMs. It breaks down because:

- **Clients get scammed:** they pay upfront and the freelancer disappears.
- **Freelancers get scammed:** they finish the work and the client never pays.
- **No reputation:** good freelancers cannot show a track record.
- **No dispute path:** when something goes wrong, nobody can decide.

## Target Users

| Role | Who | What they want |
|---|---|---|
| Client | A student who needs something done | A safe way to pay and get work delivered |
| Freelancer | A student with a skill | Guaranteed payment and a visible reputation |
| Admin | Platform moderator | To resolve disputes fairly |

## Solution

1. **Escrow:** when the client funds a gig, the money leaves their wallet and is locked against the gig. The freelancer sees "Funds secured" before starting.
2. **Milestones:** larger gigs are split into parts that are submitted, approved and paid one by one.
3. **Disputes:** either side can dispute submitted work; the client can also dispute work that was never delivered once the deadline has passed. An admin sees both statements, the submission and the chat, then releases, refunds or splits the money.
4. **Reputation:** after completion, both sides rate each other, and ratings appear on profiles and applications.

> **Honesty note:** payments are simulated. Users top up their wallet with test credits, and escrow holds and releases are recorded in the application's own database ledger. Real escrow would require a licensed payment provider and business KYC.

## Key Features

**Workflow 1: Post, apply, hire**
- Clients post gigs with budget, deadline, required skills and optional milestones (validated to sum to the budget).
- Freelancers search and filter by keyword, skill and budget range, and sort by newest, budget or deadline (paginated).
- Freelancers apply with a pitch and a quoted price (one application per gig, enforced by a unique index).
- The client accepts one applicant. The agreed price becomes the quote, milestone amounts are re-scaled proportionally, and the other applicants are declined, all in one transaction.

**Workflow 2: Escrow, delivery and payment**
- Wallet top-ups with an `Idempotency-Key`, so a double click never adds money twice.
- Fund escrow, which is rejected with a clear message if the balance is too low or no freelancer has been hired.
- Submit work per milestone (note and link); the client approves (releasing that milestone's money) or requests changes (up to 3 revisions).
- An append-only ledger records every money movement; users see their own ledger on the Wallet page.

**Workflow 3: Disputes and reputation**
- Raise a dispute; the other party adds their side; the admin resolves by release, refund or a custom split.
- Two-way reviews after completion; the freelancer's average rating and completed-gig count update atomically.

**Supporting features**
- Live updates over Socket.io: when the other party funds, submits or approves, the open gig page refreshes by itself.
- Per-gig chat, also shown to the admin during disputes.
- In-app notifications with an unread badge and toasts.
- An admin dashboard with a **ledger reconciliation** check (topped-up total = money in wallets + money in escrow).

## Gig State Machine

```
Gig:        open ──► accepted ──► in_progress ──► completed
              │          │
              └──────────┴──► cancelled        (only before funding)

Milestone:  pending ──► funded ──► submitted ──► released
                          ▲  │         │
                          │  │         ├──► funded      (client requests changes)
                          │  │         ▼
                          │  └────► disputed ──► released | refunded | split
                          └─ (client, only after deadline, if nothing was submitted)
```

The transitions live in one table ([server/src/services/stateMachine.js](server/src/services/stateMachine.js)). Rules enforced on the server include:

- Cannot fund without an accepted freelancer, or with insufficient balance.
- Cannot submit on an unfunded gig, and cannot approve before submission.
- Cannot approve your own work, and only the gig's client can approve.
- Cannot cancel after funding (raise a dispute instead).
- Cannot release, refund or resolve the same milestone twice.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19 (Vite) and Tailwind CSS 4 | Fast to build, small bundle |
| Routing and state | React Router 7 and Context API | Enough for this scope; no global store needed |
| Backend | Node.js and Express 5 | Native async error handling in Express 5 |
| Database | MongoDB (Atlas) and Mongoose 8 | Flexible documents; **multi-document transactions** for money |
| Auth | JWT and bcrypt | Stateless auth that works across the Vercel and Render origins |
| Validation | Zod | Every request body, query and param is parsed and typed |
| Security | helmet, CORS allow-list, express-rate-limit | Basic hardening |
| Real-time | Socket.io | Live gig updates, chat and notifications |
| Tests | `node:test`, supertest, mongodb-memory-server | Full API tests against a real in-memory replica set |
| Deploy | Vercel (client), Render (API), MongoDB Atlas | Free tiers |

## Architecture

```
┌──────────────────┐   HTTPS / JSON (Bearer JWT)   ┌──────────────────────┐
│  React frontend  │ ────────────────────────────► │   Express REST API   │
│     (Vercel)     │ ◄──────── Socket.io ───────── │       (Render)       │
└──────────────────┘   gig updates, chat, notifs   └──────────┬───────────┘
                                                              │ Mongoose (transactions)
                                                   ┌──────────▼───────────┐
                                                   │ MongoDB Atlas (repl.)│
                                                   └──────────────────────┘
```

```
server/src/
  config/        env loading and validation, DB connection
  models/        User, Gig (+ embedded milestones), Application, Transaction (ledger),
                 Dispute, Review, Message, Notification
  validators/    Zod schemas for every endpoint
  middleware/    auth (JWT + role), validate, rate limits, error handler
  services/      stateMachine, escrowService, disputeService, ratingService,
                 gigAccess (authorization rules), notificationService, realtime
  controllers/   thin HTTP handlers that call services
  routes/        URL → middleware → controller
  socket.js      Socket.io auth and per-gig rooms
client/src/
  api/           axios instance (token, error normalisation)
  context/       AuthContext (session + socket), ToastContext
  hooks/         useFetch, useAction (pending/toast), useGigRoom (live updates)
  components/    GigCard, MilestoneList, Applications, Chat, NotificationBell, …
  pages/         Gigs, GigDetail, PostGig, Dashboard, Wallet, Disputes, DisputeDetail, Profile, …
```

### Key engineering decisions

- **All money logic lives in one service** ([server/src/services/escrowService.js](server/src/services/escrowService.js)). Controllers never touch balances directly. Admin dispute decisions reuse the same `settleMilestone` function as client approvals.
- **Every money operation follows the same four steps inside one MongoDB transaction:**
  1. Load, authorize and check the state machine (readable 403/409 errors).
  2. A *conditional* write that only matches the expected current state (`status: 'submitted'`), so a racing duplicate request matches nothing.
  3. A guarded balance update (`walletBalance: { $gte: amount }`).
  4. A ledger entry with a deterministic unique key (`release:<milestoneId>`), which the database will never accept twice.

  If any step fails, everything rolls back. The tests fire three simultaneous "fund" and "approve" requests and assert that money moved exactly once.
- **Idempotent double clicks:** a repeated fund or approve returns `200` with `alreadyDone: true` instead of an error or a second payment.
- **Immutable ledger:** the Transaction model rejects every update or delete operation.
- **Ledger reconciliation:** credits only enter via top-ups and never leave, so `topups = wallets + escrow` must always hold. The admin dashboard shows this check live.
- **Ratings** are stored as `ratingSum` and `ratingCount` and updated with `$inc`, so concurrent reviews can't lose updates.
- **Privacy:** gigs that are no longer open return `404` (not `403`) to non-participants, so their existence isn't leaked.
- **Notifications are best-effort:** they are written after the business transaction commits and can never fail or roll it back.

## API Overview

| Area | Endpoint | Who |
|---|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET/PATCH /api/auth/me` | Anyone / logged in |
| Gigs | `GET /api/gigs?q=&skill=&min=&max=&sort=&page=` | Logged in |
| Gigs | `POST /api/gigs`, `POST /api/gigs/:id/cancel` | Client (owner) |
| Gigs | `GET /api/gigs/:id`, `GET /api/gigs/mine` | Participants (anyone for open gigs) |
| Applications | `POST /api/gigs/:id/apply`, `POST /api/applications/:id/withdraw` | Freelancer |
| Applications | `GET /api/gigs/:id/applications`, `POST /api/applications/:id/accept` | Owning client |
| Escrow | `POST /api/gigs/:id/fund` | Owning client |
| Escrow | `POST /api/gigs/:id/milestones/:mid/submit` | Assigned freelancer |
| Escrow | `POST /api/gigs/:id/milestones/:mid/approve`, `…/revision` | Owning client |
| Disputes | `POST /api/gigs/:id/milestones/:mid/dispute` | Either participant |
| Disputes | `GET /api/disputes`, `GET /api/disputes/:id`, `POST /api/disputes/:id/respond` | Participants / admin |
| Disputes | `POST /api/disputes/:id/resolve` | Admin |
| Wallet | `GET /api/wallet`, `POST /api/wallet/topup`, `GET /api/wallet/transactions` | Client / freelancer |
| Reviews | `POST /api/gigs/:id/review`, `GET /api/users/:id` | Participants after completion |
| Chat | `GET/POST /api/gigs/:id/messages` | Participants / admin |
| Other | `GET /api/notifications`, `POST /api/notifications/read`, `GET /api/admin/stats` | Logged in / admin |

Errors are always shaped as `{ "error": { "message": "...", "code": "..." } }`:

| What can go wrong | Response |
|---|---|
| Invalid input (negative budget, short title, bad URL) | 400 `VALIDATION_ERROR` with the field name |
| Insufficient wallet balance | 400 `INSUFFICIENT_FUNDS` with the amounts |
| Not logged in or expired token | 401 |
| Wrong role or not the owner | 403 |
| Missing gig, milestone or dispute | 404 |
| Invalid state jump, or a duplicate application or review | 409 with a readable reason |
| Too many requests | 429 |
| Unexpected error | 500 with a generic message (details only in server logs) |

## Local Setup

**Requirements:** Node.js 20 or newer, and MongoDB 6 or newer installed locally (or an Atlas connection string).

```bash
git clone <repo-url> skillgig && cd skillgig

# 1. Database: transactions need a replica set, so start a local single-node one
#    on port 27018 (data in server/.mongo-data). Skip this if you use Atlas.
cd server
npm install
npm run db:dev

# 2. API
cp .env.example .env
#   set MONGODB_URI=mongodb://127.0.0.1:27018/skillgig?replicaSet=rs0
#   set JWT_SECRET to the output of: openssl rand -hex 32
npm run seed        # demo accounts and gigs in every state
npm run dev         # http://localhost:5050

# 3. Frontend (new terminal)
cd ../client
npm install
npm run dev         # http://localhost:5173 (proxies /api and /socket.io to :5050)
```

Run the API test suite (it starts its own in-memory replica set and needs no setup):

```bash
cd server && npm test
```

### Demo accounts

All demo accounts use the password **`demo1234`**. The login page has one-click buttons for each.

| Role | Email | Seeded state |
|---|---|---|
| Client | `rahul@skillgig.dev` | Has an open gig with an applicant, an in-progress gig with a submitted milestone, and wallet credits |
| Client | `sneha@skillgig.dev` | Has a completed and reviewed gig |
| Freelancer | `priya@skillgig.dev` | Has 5★ reputation, an active gig and a payment in her ledger |
| Freelancer | `arjun@skillgig.dev` | Has applied to the Robotics Club logo gig |
| Admin | `admin@skillgig.dev` | Has the dispute console and ledger check |

**Suggested demo:** log in as Rahul and accept Arjun on the *Robotics Club logo* gig, then fund it. In a second browser, log in as Arjun: the gig flips to "Funds secured" live. Submit, approve, and check both wallets. Then raise a dispute on *Portfolio website* as Rahul and resolve it as the admin.

## Environment Variables

**server/.env** (see [server/.env.example](server/.env.example))

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string. It must be a replica set; Atlas clusters are. |
| `JWT_SECRET` | Long random string for signing tokens (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | Token lifetime, default `7d` |
| `CLIENT_URL` | Allowed frontend origin(s) for CORS and Socket.io, comma separated |
| `PORT` | API port, default `5050` |
| `NODE_ENV` | `development` / `production` |

**client/.env** (see [client/.env.example](client/.env.example))

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Deployed API base URL, e.g. `https://skillgig-api.onrender.com`. Leave empty locally. |

No secrets are committed: `.env` files are git-ignored and only `.env.example` files with empty values are in the repo.

## Deployment

1. **MongoDB Atlas:** create a free M0 cluster and a database user with a strong password. Under Network Access, allow `0.0.0.0/0` (Render's IPs are dynamic). Copy the connection string and add `/skillgig` as the database name.
2. **Render (API):** create a new Blueprint from this repo. It reads [render.yaml](render.yaml) (root dir `server`, health check `/api/health`). Set `MONGODB_URI`, and set `CLIENT_URL` to the Vercel URL. `JWT_SECRET` is generated automatically.
   Seed the Atlas database once from your machine: `cd server && MONGODB_URI="<atlas uri>" npm run seed`.
3. **Vercel (client):** import the repo with **Root Directory** `client` (framework: Vite). Set `VITE_API_URL` to the Render URL. [client/vercel.json](client/vercel.json) rewrites all routes to `index.html` for client-side routing.
4. Update `CLIENT_URL` on Render if the Vercel URL changes, and open both links in an incognito window to verify.

> Render's free tier sleeps after inactivity; the first request can take about 30 seconds to wake it.

## Limitations and Next Steps

- Payments are simulated (see the honesty note above). A next step would be Razorpay test mode for the top-up step only.
- Submissions are links rather than file uploads.
- Each account has a single role; a student who wants to both hire and freelance needs two accounts.
