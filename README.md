# SkillGig

**A freelance marketplace where your payment is protected until the work is approved.**

Clients post paid gigs (a logo, a website, a video edit, notes, a pitch deck) and freelancers apply to do them. When a client hires someone, they pay through **Razorpay**, and SkillGig **holds the money** instead of handing it over straight away. The freelancer can see the money is secured before they start; the client only releases it, stage by stage, when they are happy with the work. If the two sides disagree, an admin looks at the evidence and decides who gets what.

| | |
|---|---|
| **Live app** | https://skill-gig.vercel.app |
| **API** | https://skillgig-api.onrender.com ([health check](https://skillgig-api.onrender.com/api/health)) |
| **Repository** | https://github.com/chsnikitha08/SkillGig |
| **Demo video** | _add link here_ |
| **Admin login** | Shared privately in the submission form |

> The API runs on Render's free tier, which sleeps when idle. The first request after a quiet period can take about 30 seconds; after that it responds in about a second.

## Contents

1. [Problem Statement](#problem-statement)
2. [Target Users](#target-users)
3. [Solution](#solution)
4. [Key Features](#key-features)
5. [Tech Stack](#tech-stack)
6. [Architecture](#architecture)
7. [Local Setup](#local-setup)
8. [Environment Variables](#environment-variables)
9. [Deployment](#deployment)
10. [Testing](#testing)
11. [Limitations and Next Steps](#limitations-and-next-steps)

---

## Problem Statement

A lot of small freelance work happens informally, through WhatsApp groups, Instagram DMs and word of mouth. Without a trusted middle layer it goes wrong in predictable ways:

- **Clients get cheated.** They pay upfront and the freelancer disappears.
- **Freelancers get cheated.** They deliver the work and the client never pays.
- **There is no track record.** Good freelancers have no way to prove they are reliable.
- **There is no one to settle arguments.** When the work is disputed, it ends in silence or blocking.

Both sides end up having to trust a stranger with their money or their time.

## Target Users

| Role | Who they are | What they need |
|---|---|---|
| **Client** | Anyone who needs a task done: a club, a small business, a student, an organiser | A safe way to pay, and a guarantee they only pay for work they accept |
| **Freelancer** | Anyone with a skill: design, development, writing, video, tutoring | Proof the money exists before they start, and a reputation that grows with each job |
| **Admin** | A platform moderator | The full picture (both sides, the work, the chat) to resolve disputes fairly |

## Solution

SkillGig adds the missing trust layer between the two sides.

**How a gig works, start to finish:**

```
 Client posts a gig ──► Freelancers apply ──► Client hires one
                                                    │
                                                    ▼
                                  Client pays through Razorpay
                              (SkillGig holds it: "Payment secured")
                                                    │
                                                    ▼
             Freelancer submits each stage ──► Client reviews it
                     ▲                                │
                     └──── "Request changes" ◄────────┤
                                                      ├──► "Approve & pay": that stage's money goes to the freelancer
                                                      └──► "Raise dispute": an admin decides (pay, refund, or split)
                                                    │
                                                    ▼
                         All stages settled ──► Gig completed ──► Both sides rate each other
```

1. **Payment protection.** The client pays the agreed price before work starts. SkillGig holds it, so the freelancer knows it is there and the client knows it will not be released without their approval.
2. **Pay in stages.** Bigger gigs are split into stages (for example design → build → deploy). Each stage is approved and paid separately.
3. **Fair disputes.** Either side can raise a dispute on submitted work, and the client can also raise one if nothing was delivered by the deadline. An admin sees both statements, the submitted work and the full chat, then releases the money, refunds it, or splits it.
4. **Reputation.** When a gig is complete, both sides rate each other. Ratings and completed-gig counts appear on profiles, gig cards and applications.

### What is real and what is simulated

- **Real (Razorpay test mode):** clients pay through the real Razorpay Checkout; the server verifies every payment with Razorpay; refunds from cancelled gigs and dispute decisions are real Razorpay refunds and appear in the Razorpay dashboard.
- **Simulated:** SkillGig "holds" the money in its own ledger rather than a regulated escrow account, and money released to a freelancer is recorded as **earnings** without a bank payout. Real escrow accounts and payouts (Razorpay Route or RazorpayX) need a KYC-verified business account.
- **Test mode only:** no real money moves. To try a payment, use UPI `success@razorpay`, or test card `4386 2894 0766 0153` with any future expiry and any CVV.

## Key Features

### Workflow 1: Post, find and hire
- Clients post a gig with a title, description, skills, budget, deadline and optional stages (stage amounts must add up to the budget).
- Anyone can browse open gigs without an account, by **category** (Design, Development, Writing, Video, Presentations, Marketing, Tutoring, Audio), keyword, budget range, and sort order.
- Freelancers apply with a pitch and their price. Each freelancer can apply to a gig once.
- The client hires one applicant. The agreed price becomes the freelancer's quote, stage amounts are adjusted to match, and every other applicant is notified that someone else was chosen.

### Workflow 2: Pay, deliver and get paid
- The client pays through Razorpay Checkout. The freelancer's page updates live to "Payment secured" without a refresh.
- The freelancer submits each stage with a note and a link to the work.
- The client approves (the freelancer is paid for that stage) or requests changes (up to 3 times per stage).
- Clients see every payment and refund on their **Payments** page; freelancers see what they have earned on their **Earnings** page.

### Workflow 3: Disputes and reputation
- Either side raises a dispute; the other side adds their version; the admin decides to pay, refund or split, with a written note both sides can read.
- The client's share of a decision is refunded to their original payment method through Razorpay.
- After completion, both sides leave a 1 to 5 star review, which updates the person's average rating.

### Also included
- **Live updates and chat** on every gig (Socket.io), with clickable links for sharing portfolios and files.
- **Notifications** with an unread badge for hires, payments, submissions, disputes and reviews.
- **Admin dashboard** with platform stats, every dispute, and a payment check that confirms every rupee received is accounted for.
- **Accounts and roles:** separate Client and Freelancer accounts (chosen at sign-up and confirmed at login). Admins cannot sign up through the website.

## Tech Stack

| Layer | Technology | Why it was chosen |
|---|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router 7 | Fast to build and load; simple routing and Context API for state |
| Backend | Node.js 22, Express 5 | Familiar MERN stack; Express 5 handles async errors natively |
| Database | MongoDB Atlas, Mongoose 8 | Flexible documents, plus **transactions** so money changes are all-or-nothing |
| Payments | Razorpay (test mode): Orders, Checkout, Refunds, Webhooks | Real payment flow without ever handling card details |
| Authentication | JWT, bcrypt | Stateless login that works across the Vercel and Render domains |
| Validation | Zod | Every request is checked and cleaned before it reaches the logic |
| Real-time | Socket.io | Live gig updates, chat and notifications |
| Security | helmet, CORS allow-list, rate limiting | Basic protection against common attacks and abuse |
| Testing | Node's built-in test runner, supertest, mongodb-memory-server | Full API tests against a real in-memory database |
| Hosting | Vercel (frontend), Render (API), MongoDB Atlas (database) | Free tiers, deploys from GitHub |

## Architecture

```
┌────────────────────┐    HTTPS + JSON (login token)    ┌──────────────────────┐
│   React website    │ ───────────────────────────────► │   Express REST API   │
│     (Vercel)       │ ◄────────── Socket.io ────────── │       (Render)       │
└─────────┬──────────┘   live updates, chat, alerts     └──────────┬───────────┘
          │ Razorpay Checkout                                      │ Mongoose
          ▼                                                        ▼
┌────────────────────┐   create order, verify, refund   ┌──────────────────────┐
│ Razorpay (test)    │ ◄─────────────────────────────── │    MongoDB Atlas     │
└────────────────────┘                                  └──────────────────────┘
```

The **website** only displays data and sends user actions. All rules about who can do what, and all money handling, live in the **API**.

**Code layout**

```
server/src/
  models/        data: User, Gig (with stages), Application, Payment, Refund,
                 Transaction (ledger), Dispute, Review, Message, Notification
  services/      the business rules: stateMachine, paymentService, escrowService,
                 disputeService, ratingService, gigAccess (permissions), realtime
  controllers/   small HTTP handlers that call the services
  routes/        which URL goes to which handler, with login and role checks
  validators/    Zod rules for every request
  middleware/    login check, validation, rate limits, error handling
client/src/
  pages/         Home, Browse gigs, Gig page, Post a gig, Dashboard, Payments/Earnings,
                 Disputes, Profile, Login, Sign up
  components/    gig cards, stages list, applicants, chat, notifications, navbar…
  hooks/ context/ api/   data fetching, login session, live connection
```

### How a payment is kept safe

1. The **server** creates the Razorpay order for exactly the agreed price. The browser never chooses the amount.
2. After checkout, the server checks Razorpay's signature **and** asks Razorpay directly whether the payment really happened, for the right order and amount.
3. Only then, in one database transaction, the payment is marked paid, the gig is marked funded, and a ledger entry is written. If any part fails, none of it happens.
4. If the browser closes after paying, a "Refresh status" check (or a Razorpay webhook) finds the payment, and the same one-time confirmation step makes sure it is never counted twice.
5. If money arrives for a gig that can no longer take it (for example, cancelled in another tab), it is refunded automatically in full.

### Rules the server enforces

Every gig and stage follows a fixed set of allowed steps ([stateMachine.js](server/src/services/stateMachine.js)):

```
Gig:    open ──► accepted (hired) ──► in progress (paid) ──► completed
          └──────────┴──► cancelled   (only before payment)

Stage:  not started ──► in progress ──► awaiting review ──► paid
                           ▲    │             │
                           │    │             ├──► in progress   (changes requested)
                           │    │             ▼
                           │    └──────► under review (dispute) ──► paid | refunded | split
                           └─ client can dispute an undelivered stage after the deadline
```

For example: you cannot submit work before the client has paid; you cannot approve your own work; a gig cannot be cancelled after payment; and the same stage can never be paid out twice, even if "Approve" is clicked several times at once.

### Key engineering decisions

- **All-or-nothing money changes.** Every payment, payout and refund runs inside a MongoDB transaction, and each write only succeeds if the record is still in the expected state, so double clicks and simultaneous requests can never move money twice.
- **A ledger that cannot be edited.** Every money movement adds one ledger entry with a unique key; the code rejects any attempt to change or delete an entry. The admin dashboard checks that money received = money on hold + paid to freelancers + refunded.
- **Refunds that survive outages.** A refund decision is saved first and sent to Razorpay afterwards. If Razorpay is unreachable, the decision still stands and a background job retries every 5 minutes (admins can also retry by hand).
- **Razorpay behind an adapter.** The rest of the code never calls Razorpay directly, so the tests replace it with a fake that signs payments the same way and can simulate outages.
- **Privacy by default.** Once a gig has a freelancer, only the two people involved (and admins) can see it; anyone else gets "not found", so private gigs are not revealed.

### Error handling

Errors always come back as `{ "error": { "message": "...", "code": "..." } }`, and the website shows the message in plain language.

| What goes wrong | What the user sees |
|---|---|
| Invalid input (short title, negative budget, bad link) | 400 with the field that needs fixing |
| Forged or mismatched payment | 400, and nothing is marked as paid |
| Payment for a gig that is no longer available | 409, and an automatic full refund |
| Payment provider down | 502; refunds are queued and retried |
| Not logged in, or session expired | 401, redirected to login |
| Wrong role or not the owner | 403 with a reason |
| Gig, stage or dispute not found | 404 |
| Action not allowed right now (e.g. approve before submit) | 409 with a readable reason |
| Too many attempts | 429 |
| Anything unexpected | 500 with a generic message; details stay in the server logs |

<details>
<summary><strong>API endpoints</strong></summary>

| Area | Endpoint | Who can call it |
|---|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET/PATCH /api/auth/me` | Anyone / logged in |
| Gigs | `GET /api/gigs?q=&skill=&min=&max=&sort=&page=` | Anyone |
| Gigs | `POST /api/gigs`, `POST /api/gigs/:id/cancel` | Client (owner) |
| Gigs | `GET /api/gigs/:id`, `GET /api/gigs/mine` | Logged in (private gigs: participants only) |
| Applications | `POST /api/gigs/:id/apply`, `POST /api/applications/:id/withdraw` | Freelancer |
| Applications | `GET /api/gigs/:id/applications`, `POST /api/applications/:id/accept` | Owning client |
| Payments | `POST /api/gigs/:id/fund/order`, `…/fund/verify`, `…/fund/sync` | Owning client |
| Payments | `POST /api/payments/webhook` | Razorpay (signature checked) |
| Stages | `POST /api/gigs/:id/milestones/:mid/submit` | Hired freelancer |
| Stages | `POST /api/gigs/:id/milestones/:mid/approve`, `…/revision` | Owning client |
| Disputes | `POST /api/gigs/:id/milestones/:mid/dispute` | Either participant |
| Disputes | `GET /api/disputes`, `GET /api/disputes/:id`, `POST /api/disputes/:id/respond` | Participants / admin |
| Disputes | `POST /api/disputes/:id/resolve` | Admin |
| Payments / earnings | `GET /api/wallet`, `GET /api/wallet/transactions` | Client / freelancer |
| Reviews | `POST /api/gigs/:id/review`, `GET /api/users/:id` | Participants after completion |
| Chat | `GET/POST /api/gigs/:id/messages` | Participants / admin |
| Notifications | `GET /api/notifications`, `POST /api/notifications/read` | Logged in |
| Admin | `GET /api/admin/stats`, `POST /api/admin/refunds/:id/retry` | Admin |

</details>

## Local Setup

**You need:** Node.js 22, and either MongoDB 6+ installed locally or a MongoDB Atlas connection string. For payments, a free Razorpay account in **Test Mode**.

```bash
git clone https://github.com/chsnikitha08/SkillGig.git
cd SkillGig

# 1. API
cd server
npm install
cp .env.example .env          # then fill it in (see Environment Variables)

#    Using a local MongoDB instead of Atlas? Money operations need MongoDB
#    transactions, which need a replica set. This starts one on port 27018:
npm run db:dev                #    then set MONGODB_URI=mongodb://127.0.0.1:27018/skillgig?replicaSet=rs0

npm run dev                   # API on http://localhost:5050

# 2. Website (in a second terminal)
cd client
npm install
npm run dev                   # http://localhost:5173 (talks to the API on :5050 automatically)
```

**Create the admin account** (admins cannot sign up through the website):

```bash
cd server
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='at-least-12-characters' npm run create-admin
```

Running it again with the same email resets the password. The password is never stored in the code or shown in the app.

**Try the full flow:** sign up as a client and, in an incognito window, as a freelancer. Post a gig, apply, hire, pay with UPI `success@razorpay`, submit, then approve or raise a dispute and resolve it as the admin.

## Environment Variables

**`server/.env`** (template: [server/.env.example](server/.env.example))

| Variable | What it is |
|---|---|
| `MONGODB_URI` | MongoDB connection string (Atlas, or the local replica set above) |
| `JWT_SECRET` | A long random string used to sign login tokens: `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | How long a login lasts, e.g. `7d` |
| `CLIENT_URL` | The website address(es) allowed to call the API, comma separated |
| `PORT` | API port, default `5050` |
| `NODE_ENV` | `development` locally, `production` when deployed |
| `RAZORPAY_KEY_ID` | Razorpay **test** key id (`rzp_test_…`). Public, and sent to the browser for checkout. |
| `RAZORPAY_KEY_SECRET` | Razorpay test key secret. **Server only**, never sent to the browser. |
| `RAZORPAY_WEBHOOK_SECRET` | Optional. Only needed if you add a Razorpay webhook (events `payment.captured`, `order.paid`). |

**`client/.env`** (template: [client/.env.example](client/.env.example))

| Variable | What it is |
|---|---|
| `VITE_API_URL` | The deployed API address, e.g. `https://skillgig-api.onrender.com`. Leave empty when running locally. |

No secrets are in this repository: real `.env` files are git-ignored, and only empty templates are committed.

## Deployment

The live version runs on three free services:

| Part | Service | Settings |
|---|---|---|
| Database | MongoDB Atlas | Free M0 cluster; Network Access allows `0.0.0.0/0` (Render's addresses change) |
| API | Render (Node web service) | Root directory `server`, build `npm ci --omit=dev`, start `npm start`, health check `/api/health`, environment variables as above with `NODE_ENV=production` and `CLIENT_URL=https://skill-gig.vercel.app` |
| Website | Vercel | Root directory `client`, framework Vite, `VITE_API_URL=https://skillgig-api.onrender.com` ([vercel.json](client/vercel.json) makes page links like `/gigs/123` work) |

**To deploy your own copy:**

1. Create the Atlas cluster and copy its connection string (add `/skillgig` before the `?`).
2. On Render, create a web service from this repository with the settings above (or use [render.yaml](render.yaml) as a Blueprint), and add the environment variables.
3. In Razorpay (Test Mode), go to Account & Settings → API Keys, generate a key, and add both values on Render.
4. On Vercel, import the repository with root directory `client` and set `VITE_API_URL` to your Render address.
5. Set `CLIENT_URL` on Render to your Vercel address, then create the admin account with `npm run create-admin` (pointing `MONGODB_URI` at Atlas).

## Testing

```bash
cd server
npm test
```

The 33 automated tests start their own temporary database and a fake Razorpay, so they need no setup. They cover:

- sign-up, login, roles, and blocking admin sign-up or injection attempts
- posting, searching and filtering gigs; applying and hiring
- payment verification: forged signatures, wrong amounts, failed payments, webhooks, recovery after a closed browser
- the same payment reported three ways at once being counted only once; three simultaneous approvals paying out only once
- disputes resolved by pay, refund or split; Razorpay refunds, including retrying after an outage
- reviews, ratings, chat, notifications, and the ledger refusing edits

## Limitations and Next Steps

- **Payouts are simulated.** Freelancer earnings are recorded but not sent to a bank, and money is held in SkillGig's own ledger rather than a regulated escrow account. The next step is Razorpay Route or RazorpayX with a verified business account.
- **Work is shared as links** (Google Drive, Behance, GitHub), not uploaded as files.
- **One role per account.** Someone who wants to both hire and freelance needs two accounts.
- **Response time on the free tier.** The API sleeps when idle and takes about 30 seconds to wake.
- **Dependency update.** `npm audit` reports an advisory for the current version of Zod; upgrading needs a major-version change and is planned after submission.
