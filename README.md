# Settle — Travel Expense Reimbursement

**Settle turns a messy post-trip inbox into a ready-to-approve expense claim.**

After a business trip, an employee usually has a pile of emails: the travel
approval, the advance credit note, flight and hotel bookings, cab receipts and
photos of paper bills. Filling in a reimbursement form by hand from all of that
is slow and error-prone.

Settle reads those emails and receipts for you. It works out what each expense
is, checks it against the company travel policy, subtracts any advance already
paid, and sends the claim through the approval chain to Finance for payment.
You can see where a claim is at every step.

---

## Try it live

| | |
| --- | --- |
| **App** | **https://settle-six-mu.vercel.app** |
| API | https://settle-uw6n.onrender.com (health check: `/api/health/live`) |

> **Note:** the API runs on Render's free tier, which sleeps when idle. The
> **first sign-in can take up to a minute** while it wakes up. After that it is fast.

### Demo accounts

The demo runs on a fictional company, **Acme Corp**. Every account uses the same password:

**Password: `Acme@2026`**

| Email | Role | What you can do |
| --- | --- | --- |
| `chaitanya.reddy@acmecorp.com` | Employee | Owns the demo trip. Upload documents, fix claim lines, submit |
| `suresh.iyer@acmecorp.com` | Reporting Manager | Approve / return / reject claims from the team |
| `meera.krishnan@acmecorp.com` | Head of Department | Approves higher-value claims |
| `arvind.rao@acmecorp.com` | Head of Division | Approves high-value claims |
| `nandita.shah@acmecorp.com` | Managing Director | Top-level approvals + org-wide view |
| `ravi.menon@acmecorp.com` | Finance | Verify claims and release payment |
| `kavitha.balan@acmecorp.com` | Finance (Controller) | Same as Finance |
| `admin@acmecorp.com` | Admin | Read-only view of every claim + org dashboard |
| `deepa.nair@acmecorp.com` | Employee | A second employee (no trips yet) |
| `imran.qureshi@acmecorp.com` | Employee | A second employee (no trips yet) |

### A 5-minute walkthrough

1. **Sign in as the employee:** `chaitanya.reddy@acmecorp.com` / `Acme@2026`.
2. Open **My Trips**, then the draft trip **TRQ-2026-0001** (Pune → Bengaluru).
   Its 15 emails and 2 receipt photos have already been read into claim lines.
   Duplicates, promo mail and a failed payment have been dropped automatically.
3. Look at each line's **verdict** (allowed / capped / disallowed / needs info)
   and the **Settlement summary** (what you get back after the advance).
4. Fix any line marked **needs info** (e.g. add attendee details for the
   business dinner), then click **Submit claim**.
5. **Sign out and sign in as the manager** (`suresh.iyer@acmecorp.com`). Open
   **Approvals** and approve the claim. If the amount is high enough, the
   Head of Department / Division must approve next.
6. **Sign in as Finance** (`ravi.menon@acmecorp.com`). Open **Finance**, verify
   the claim, then release payment.
7. **Sign back in as Chaitanya.** The claim is now **Paid**, with a notification
   and the full approval timeline.

You can also create a **new travel request** and upload your own `.eml` emails or
receipt images (PNG/JPG). Settle reads receipt images with OCR.

---

## Features

- **Reads the inbox for you:** parses raw `.eml` emails and receipt images.
  It works out what each one is (approval, advance, flight, hotel, cab, meal,
  business entertainment, or noise) and pulls out amounts, dates and merchants.
- **Removes duplicates:** a resent receipt or a forwarded copy of the same
  expense is detected and dropped, not claimed twice.
- **Checks the policy automatically:** every line gets a verdict with a
  plain-English reason (e.g. mini-bar is not reimbursable; hotel capped at the
  city-tier limit; someone else's cab ride is disallowed).
- **Calculates the settlement:** total reimbursable minus the advance already
  paid, which tells you whether the company owes you or you owe the company.
  Company-paid items (like flights on the corporate card) are shown but not claimed.
- **Routes approvals by amount:** Reporting Manager → Head of Department →
  Head of Division → MD depending on claim value, then Finance.
- **Tracks status clearly:** `Draft → Pending approval → Pending finance →
  Verified → Paid` (plus Returned / Rejected), with a timeline and notifications.
- **Role-based access:** each person sees only what their role allows,
  enforced on the server, not just hidden in the UI.
- **Analytics dashboard** for each role (employee, approver, finance, organisation).
- **Audit log:** every action is recorded with a before/after snapshot.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, React Router 6, TanStack Query 5, custom CSS design system (no UI library) |
| Backend | Node.js 20, Hono, TypeScript, Zod validation |
| Database | PostgreSQL 16 with Drizzle ORM (SQL migrations committed) |
| Auth | Email + password (scrypt hashing), JWT session in an httpOnly cookie |
| OCR | Tesseract.js |
| Monorepo | pnpm workspaces: `apps/frontend`, `apps/backend`, `packages/shared` |
| Hosting | Frontend on Vercel, API on Render |

---

## Run it locally

### Prerequisites

- **Node.js 20.9+** (see `.nvmrc`)
- **pnpm 9** (`npm install -g pnpm`)
- **PostgreSQL 16**, either via Docker (easiest) or your own install

### Steps

```bash
# 1. Clone and install
git clone https://github.com/priyankakommani/settle.git
cd settle
pnpm install

# 2. Configure the backend
cp apps/backend/env.example apps/backend/.env
#    The defaults work with the Docker database below.

# 3. Start PostgreSQL (Docker)
pnpm db:up
#    Using your own Postgres? Set DATABASE_URL in apps/backend/.env instead.

# 4. Create tables and load demo users + policy
pnpm db:migrate
pnpm db:seed

# 5. Start the app (API on :8080, web on :5173)
pnpm dev
```

Open **http://localhost:5173** and sign in with any demo account above
(password `Acme@2026`).

> The sample inbox used for the live demo trip is not included in the repo, so a
> fresh local database starts with no trips. Create one from **New travel
> request** and upload your own emails / receipts to see the pipeline work.

### Useful commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run backend and frontend together |
| `pnpm build` | Production build of all packages |
| `pnpm typecheck` | TypeScript check across the workspace |
| `pnpm test` | Run the tests (Vitest) |
| `pnpm db:up` / `pnpm db:down` | Start / stop the Docker database |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:seed` | Load demo users and policy (safe to run again) |
| `pnpm db:studio` | Browse the database in Drizzle Studio |

### Environment variables (`apps/backend/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://settle:settle@localhost:5432/settle` | Postgres connection |
| `DATABASE_SSL` | auto | `disable` for localhost, `require` for hosted DBs (Neon, Render, RDS…) |
| `JWT_SECRET` | — | **Required.** Any random string of 16+ characters |
| `SESSION_TTL_SECONDS` | `604800` (7 days) | How long a login lasts |
| `SEED_DEFAULT_PASSWORD` | `Acme@2026` | Password given to demo accounts by `db:seed` |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origins (comma-separated) |
| `STORAGE_DIR` | `./.storage` | Where uploaded emails / images are saved |

The frontend reads an optional `VITE_API_URL`. Leave it unset locally; Vite
proxies `/api` to the backend.

---

## How it works

```
 emails + receipts ──► 1. Ingest ──► 2. Policy check ──► 3. Settlement ──► 4. Approval chain ──► 5. Finance ──► Paid
                      parse, classify,  verdict per line   reimbursable      by claim value        verify + pay
                      extract, dedupe                      minus advance
```

1. **Ingest** (`apps/backend/src/ingestion/`): a small MIME parser reads each
   email, a classifier decides what kind of document it is, and an extractor
   pulls out the expense lines. Receipt images are read with OCR. Duplicates are
   removed on (category, merchant, date, amount).
   - Approval and advance emails don't become expenses; they fill in the trip
     details and the advance amount.
   - A hotel invoice is split into the room charge plus one line per extra
     (laundry, mini-bar, room service) so each can be judged separately.
2. **Policy engine** (`domain/policy/`): gives each line one verdict,
   `allowed`, `capped`, `disallowed` or `needs_info`, with a reason. Limits
   (hotel and meal caps per city tier, thresholds) are stored in the
   `policy_config` table, not hard-coded.
3. **Settlement** (`domain/settlement/`): adds up allowed, employee-paid amounts
   and subtracts the advance. A positive result is owed to the employee; a
   negative one is owed back to the company.
4. **Approval routing** (`domain/approval/`): the claim amount decides how far up
   the reporting chain it goes; international trips always need the MD; Finance
   always verifies last. Nobody approves their own claim.
5. **State machine** (`domain/state-machine/`): the one place that defines which
   status changes are allowed. Finance payment is scheduled for the next payment
   run (10th or 25th of the month).

Every step writes an audit log entry and sends a notification to the next person.

### Rules worth knowing

- A claim can only be submitted when it has at least one line, every line has a
  proof document, and no line still needs information.
- The travel advance can't be more than 60% of the estimated trip cost.
- Submitting more than 7 days after the trip shows a warning, not a block.
- Business entertainment needs attendee names and organisation, and above
  ₹2,000 needs Head of Department pre-approval.
- An expense in someone else's name (e.g. a colleague's cab ride) is disallowed.
- Travel Request IDs (`TRQ-2026-0001`) are generated by the system.

---

## Project structure

```
apps/
  backend/src/
    config/        environment (validated at startup), constants
    routes/        URL wiring only
    controllers/   read the request, call a service, send the response
    services/      business logic and orchestration
    domain/        pure logic: policy engine, settlement, approval routing, state machine
    ingestion/     email parser, classifier, extractors, deduper, OCR
    repositories/  all database queries
    db/            Drizzle schema (one file per table), migrations, seed
    middleware/    auth, roles, validation, request IDs, error handling
    validators/    Zod schemas for each route
  frontend/src/
    pages/         Sign in, My Trips, Trip workspace, Approvals, Finance, Analytics, Admin
    features/      claim workspace pieces, analytics dashboard
    ui/            reusable components (buttons, forms, tabs, toasts, nav…)
    api/           typed API client
    app/           routes, session, role guards, theme
packages/
  shared/          types and constants shared by frontend and backend
```

**Database:** 10 tables: `employees`, `policy_config`, `trips`,
`raw_documents`, `attachments`, `claim_lines`, `settlements`, `approvals`,
`audit_log`, `notifications`.

---

## API overview

All endpoints are under `/api`. Everything except sign-up, login, logout and
health checks requires you to be signed in.

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/login` · `POST /auth/signup` · `POST /auth/logout` · `GET /auth/me` | Authentication |
| `GET /trips` · `POST /trips` · `GET /trips/:id` | List, create and view trips |
| `POST /trips/:id/documents` · `DELETE /trips/:id/documents/:docId` | Upload / remove emails and receipts |
| `POST /trips/:id/recompute` · `/reprocess` · `/submit` | Re-run policy check, re-read documents, submit |
| `POST /trips/:id/claim-lines` · `PATCH` / `DELETE /claim-lines/:id` | Add, edit, remove claim lines |
| `POST /trips/:id/approvals/:level` | Approve / return / reject |
| `POST /finance/trips/:id/verify` · `/return` · `/pay` | Finance actions |
| `GET /queues/approvals` · `GET /queues/finance` | Work queues |
| `GET /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all` | Notifications |
| `GET /analytics/overview` | Role-based dashboard data |
| `GET /admin/claims` | Read-only list of all claims (Admin / MD) |
| `GET /health/live` · `GET /health/ready` | Health checks |

Every response has the same shape: `{ success: true, data }` or
`{ success: false, error: { code, message, requestId } }`.

---

## Roadmap

- More unit tests for the policy engine, settlement and routing modules
- Direct mailbox sync (Gmail / Outlook) instead of uploading `.eml` files
- Admin screens to edit the policy limits and employee roster
- Payroll / accounting integration for real payouts
