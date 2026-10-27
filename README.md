# SkillGig

**Freelancing for students, where nobody gets cheated.**

SkillGig is a marketplace where students post small paid gigs (a logo, typed notes, a small website, a video edit) and other students take them on. The client pays through **Razorpay**, the money is held in **escrow** by the platform, and it is released milestone by milestone only when the work is approved. If the two sides disagree, an admin reviews the evidence and decides, and any refund goes back through Razorpay.

- **Live app:** _add Vercel URL here_
- **API:** _add Render URL here_ (health check: `/api/health`)
- **Demo video:** _add link here_
- **Admin access for evaluators:** shared privately in the submission form (not published here)

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

1. **Escrow via Razorpay:** the client pays the agreed price through Razorpay Checkout. The server verifies the payment with Razorpay and locks it against the gig. The freelancer sees "Funds secured" before starting.
2. **Milestones:** larger gigs are split into parts that are submitted, approved and paid one by one.
3. **Disputes:** either side can dispute submitted work; the client can also dispute work that was never delivered once the deadline has passed. An admin sees both statements, the submission and the chat, then releases, refunds or splits the money.
4. **Reputation:** after completion, both sides rate each other, and ratings appear on profiles and applications.

> **What is real and what is simulated**
> - **Real (Razorpay test mode):** client payments through Razorpay Checkout, server-side signature and payment verification, capture, webhooks, and **refunds** (full or partial) back to the original payment.
> - **Simulated:** the escrow *hold* is SkillGig's own ledger rather than a regulated escrow account, and released money is recorded as freelancer **earnings** without a bank payout. Real escrow and payouts need RazorpayX or Route, which require a KYC-verified business account.
> - Runs in **test mode only**: no real money moves. Test card: `4386 2894 0766 0153` (domestic Visa), any future expiry, any CVV, or UPI `success@razorpay`. International test cards such as `4111…` are declined because new Razorpay accounts accept Indian cards only.

## Key Features

**Workflow 1: Post, apply, hire**
- Clients post gigs with budget, deadline, required skills and optional milestones (validated to sum to the budget).
- Freelancers search and filter by keyword, skill and budget range, and sort by newest, budget or deadline (paginated).
- Freelancers apply with a pitch and a quoted price (one application per gig, enforced by a unique index).
- The client accepts one applicant. The agreed price becomes the quote, milestone amounts are re-scaled proportionally, and the other applicants are declined, all in one transaction.

**Workflow 2: Escrow, delivery and payment**
- Pay escrow with Razorpay Checkout (test mode). The server creates the order for the exact agreed price, verifies the HMAC signature, and fetches the payment from Razorpay to confirm amount, order and capture before funding the gig.
- A webhook and a "Check payment status" sync give two recovery paths, so a payment isn't lost if the browser closes after paying. All three paths share one idempotent confirmation step, so a payment is never counted twice.
- If money arrives for a gig that can no longer take it (cancelled meanwhile, or paid twice from two tabs), it is refunded in full automatically.
- Submit work per milestone (note and link); the client approves (releasing that milestone's money) or requests changes (up to 3 revisions).
- An append-only ledger records every money movement. Clients see their payments and refund statuses on the Payments page; freelancers see their earnings on the Earnings page.

**Workflow 3: Disputes and reputation**
- Raise a dispute; the other party adds their side; the admin resolves by release, refund or a custom split. The client's share is refunded through **Razorpay's refund API** on the original payment.
- Two-way reviews after completion; the freelancer's average rating and completed-gig count update atomically.

**Supporting features**
- Live updates over Socket.io: when the other party funds, submits or approves, the open gig page refreshes by itself.
- Per-gig chat, also shown to the admin during disputes.
- In-app notifications with an unread badge and toasts.
- An admin dashboard with a **ledger reconciliation** check (paid in through Razorpay = in escrow + released + refunded) and a list of failed refunds with a retry button.

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

- Cannot fund without an accepted freelancer, and cannot fund with a payment whose amount or order doesn't match.
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
| Payments | Razorpay (test mode): Orders, Checkout, Payments, Refunds, Webhooks | Real payment flow without handling card data |
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
        │ Razorpay Checkout (card/UPI)                         │ Mongoose (transactions)
        ▼                                          ┌──────────▼───────────┐
┌──────────────────┐  orders, verify, refunds      │ MongoDB Atlas (repl.)│
│ Razorpay (test)  │ ◄─────────────────────────────┤                      │
│                  │ ──── webhook payment.captured ► /api/payments/webhook│
└──────────────────┘                               └──────────────────────┘
```

```
server/src/
  config/        env loading and validation, DB connection
  models/        User, Gig (+ embedded milestones), Application, Transaction (ledger),
                 Payment, Refund (outbox), Dispute, Review, Message, Notification
  validators/    Zod schemas for every endpoint
  middleware/    auth (JWT + role), validate, rate limits, error handler
  services/      stateMachine, escrowService, paymentService (Razorpay flow + refund worker),
                 paymentGateway (Razorpay adapter), disputeService, ratingService,
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

- **Money logic lives in two services.** [paymentService.js](server/src/services/paymentService.js) handles money in from Razorpay and refunds out. [escrowService.js](server/src/services/escrowService.js) handles what happens to escrow. Controllers never touch balances directly, and admin dispute decisions reuse the same `settleMilestone` function as client approvals.
- **Never trust the browser about payments.** A successful checkout callback is only accepted after verifying `HMAC(order_id|payment_id)` with the key secret *and* fetching the payment from Razorpay to check its order, amount and capture status. The amount is decided by the server when it creates the order.
- **Refund outbox.** A refund decision is written to a `Refund` record in the same transaction as the escrow change; the Razorpay API call happens after commit. If Razorpay is down, the decision still stands, the refund is marked `failed`, and a background worker (every 5 minutes) or an admin "Retry now" button resends it. A conditional status update guarantees a refund is never sent twice.
- **Razorpay behind an adapter** ([paymentGateway.js](server/src/services/paymentGateway.js)). Tests swap in a fake gateway that signs payments with a real HMAC, so the verification code runs unchanged and refund outages can be simulated.
- **Every escrow operation follows the same four steps inside one MongoDB transaction:**
  1. Load, authorize and check the state machine (readable 403/409 errors).
  2. A *conditional* write that only matches the expected current state (`status: 'submitted'`), so a racing duplicate request matches nothing.
  3. A balance change (freelancer earnings) or a queued Razorpay refund.
  4. A ledger entry with a deterministic unique key (`release:<milestoneId>`), which the database will never accept twice.

  If any step fails, everything rolls back. The tests send the same payment through checkout verify (twice), the webhook and sync at once, and fire simultaneous approvals, and assert that money moved exactly once.
- **Idempotent double clicks:** a repeated approve returns `200` with `alreadyDone: true` instead of an error or a second payment, and re-opening checkout reuses the same Razorpay order.
- **Immutable ledger:** the Transaction model rejects every update or delete operation.
- **Ledger reconciliation:** every rupee paid in must be in escrow, released or refunded (`paidIn = inEscrow + released + refunded`), and released must equal freelancer earnings. The admin dashboard shows this check live.
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
| Payments | `POST /api/gigs/:id/fund/order`, `…/fund/verify`, `…/fund/sync` | Owning client |
| Payments | `POST /api/payments/webhook` | Razorpay (signature-checked) |
| Escrow | `POST /api/gigs/:id/milestones/:mid/submit` | Assigned freelancer |
| Escrow | `POST /api/gigs/:id/milestones/:mid/approve`, `…/revision` | Owning client |
| Disputes | `POST /api/gigs/:id/milestones/:mid/dispute` | Either participant |
| Disputes | `GET /api/disputes`, `GET /api/disputes/:id`, `POST /api/disputes/:id/respond` | Participants / admin |
| Disputes | `POST /api/disputes/:id/resolve` | Admin |
| Payments / earnings | `GET /api/wallet`, `GET /api/wallet/transactions` | Client / freelancer |
| Reviews | `POST /api/gigs/:id/review`, `GET /api/users/:id` | Participants after completion |
| Chat | `GET/POST /api/gigs/:id/messages` | Participants / admin |
| Other | `GET /api/notifications`, `POST /api/notifications/read` | Logged in |
| Admin | `GET /api/admin/stats`, `POST /api/admin/refunds/:id/retry` | Admin |

Errors are always shaped as `{ "error": { "message": "...", "code": "..." } }`:

| What can go wrong | Response |
|---|---|
| Invalid input (negative budget, short title, bad URL) | 400 `VALIDATION_ERROR` with the field name |
| Forged or mismatched payment (bad signature, wrong amount or order) | 400 `BAD_SIGNATURE` / `PAYMENT_MISMATCH` |
| Payment not captured, or the gig can no longer be funded | 409 (and an automatic full refund) |
| Razorpay unreachable or erroring | 502 `GATEWAY_ERROR`; refunds are queued and retried |
| Razorpay keys not configured | 503 `PAYMENTS_DISABLED` |
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
#   set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET to your Razorpay TEST keys
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password' npm run create-admin
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

### Accounts and roles

There is no demo data: every account is a real sign-up and every payment is a real Razorpay test payment.

- **Clients and freelancers** sign up on the Register page.
- **The admin** cannot sign up. The API rejects the `admin` role at registration, and the login page doesn't mention it. The only way to create one is `npm run create-admin` on the server, with the email and password passed as environment variables, so admin credentials never appear in the code or the UI. Running it again with the same email resets the password.

**Trying the full flow:** sign up a client and a freelancer (use an incognito window for the second one). The client posts a gig and the freelancer applies. The client accepts and pays with Razorpay using test card `4386 2894 0766 0153` (any future expiry, any CVV, any OTP) or UPI `success@razorpay`. The freelancer's page flips to "Funds secured" live. The freelancer submits, and the client approves or raises a dispute, which the admin resolves. Refunds appear in the Razorpay test dashboard.

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
| `RAZORPAY_KEY_ID` | Razorpay **test** key id (`rzp_test_…`); also sent to the browser for Checkout |
| `RAZORPAY_KEY_SECRET` | Razorpay test key secret. Server only, used for signatures and API calls. |
| `RAZORPAY_WEBHOOK_SECRET` | Optional. The secret set on the Razorpay webhook (events `payment.captured`, `order.paid`). |

**client/.env** (see [client/.env.example](client/.env.example))

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Deployed API base URL, e.g. `https://skillgig-api.onrender.com`. Leave empty locally. |

No secrets are committed: `.env` files are git-ignored and only `.env.example` files with empty values are in the repo.

## Deployment

1. **MongoDB Atlas:** create a free M0 cluster and a database user with a strong password. Under Network Access, allow `0.0.0.0/0` (Render's IPs are dynamic). Copy the connection string and add `/skillgig` as the database name.
2. **Render (API):** create a new Blueprint from this repo. It reads [render.yaml](render.yaml) (root dir `server`, health check `/api/health`). Set `MONGODB_URI`, and set `CLIENT_URL` to the Vercel URL. `JWT_SECRET` is generated automatically.
   Create the admin once from your machine: `cd server && MONGODB_URI="<atlas uri>" ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin`.
3. **Razorpay (test mode):** in the Razorpay Dashboard with **Test Mode** on, go to Account & Settings → API Keys and generate a key; put both values on Render. Optionally add a webhook at `https://<render-url>/api/payments/webhook` with events `payment.captured` and `order.paid`, and set the same secret as `RAZORPAY_WEBHOOK_SECRET`.
4. **Vercel (client):** import the repo with **Root Directory** `client` (framework: Vite). Set `VITE_API_URL` to the Render URL. [client/vercel.json](client/vercel.json) rewrites all routes to `index.html` for client-side routing.
5. Update `CLIENT_URL` on Render if the Vercel URL changes, and open both links in an incognito window to verify.

> Render's free tier sleeps after inactivity; the first request can take about 30 seconds to wake it.

## Limitations and Next Steps

- Freelancer payouts and the escrow account itself are simulated (see "What is real and what is simulated" above). The next step would be Razorpay Route or RazorpayX with a verified business account.
- Submissions are links rather than file uploads.
- Each account has a single role; a student who wants to both hire and freelance needs two accounts.
