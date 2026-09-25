# Settle — Travel Expense Reimbursement

An employee comes back from a trip with an inbox full of approval mails, an
advance note, flight and hotel bookings, and cab and meal receipts (some as
photos of paper bills). Settle reads that inbox, builds a **policy-checked
Travel Expense Settlement claim** with the employee-borne total already
computed, routes it up the right approval chain, hands it to Finance, and tracks
it to payment — removing the 25 minutes of manual form-filling, the errors, and
the "where is my money" follow-ups.

**Live demo:** [settle-six-mu.vercel.app](https://settle-six-mu.vercel.app/)
(frontend, Vercel) · API on Render at
[settle-uw6n.onrender.com](https://settle-uw6n.onrender.com) (auto-deploys from
`main`). See [Demo accounts](#demo-accounts) below for sign-in credentials.

The demo runs against a fictional company, **Acme Corp**: a ten-person roster,
a travel & expense policy, and one employee's post-trip inbox (15 emails and 2
receipt photos) that the seed script loads into a draft claim.

---

## Stack

| Layer    | Choice                                                                       |
| -------- | ---------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces — `apps/*`, `packages/*` (Node 20.9, pnpm 9.12)              |
| Backend  | Hono + TypeScript, ESM, `@hono/node-server`                                  |
| DB       | PostgreSQL 16 + Drizzle ORM / drizzle-kit                                    |
| Frontend | React 18 + Vite 5 + React Router 6 + TanStack Query 5                        |
| Shared   | `@settle/shared` — response envelope, error codes, HTTP status, domain enums |

No UI framework on the frontend — a hand-built design system (CSS custom-property
theme + a small `ui/` primitive layer). No mail, OCR, or auth library — those
are small hand-rolled modules with no runtime dependency.

## How it works

1. **Ingest** (`ingestion/`). Raw `.eml` files — and bare receipt images / PDFs —
   are parsed by a hand-rolled MIME reader, **classified** (approval / advance /
   flight / hotel booking / hotel invoice / cab / meal / business entertainment /
   noise) with a confidence score, then run through an ordered **extractor**
   registry (first match wins). Promo mail and "payment failed" mail are dropped
   as noise. Results are **deduplicated** on `(category, merchant, date, amount)`
   so a resend or a "Fwd:" of an already-seen expense is not a second line.
   Every raw and parsed artefact is persisted so a run can be replayed.
   - The **approval** and **advance** mails produce no claim line — they seed the
     trip (dates, destination, approver) and set the disbursed advance.
   - **Flights** are billed to the company corporate card (policy 3.2) → emitted
     as a `paidBy: Company` memo line the employee does not claim.
   - A **hotel invoice** becomes one lodging line (room + room-tax) plus a
     **separate line per folio extra** (laundry / mini bar / in-room dining) so
     the policy engine can disallow them explicitly instead of dropping them.
2. **Policy engine** (`domain/policy/`) — pure and deterministic. One verdict per
   line: `allowed` / `capped` / `disallowed` / `needs_info`, each with a reason
   code and human text. Every tunable number (lodging and meal caps per city
   tier, the business-entertainment pre-approval threshold, the meal-bill
   threshold) is read from the `policy_config` table, not hard-coded.
3. **Settlement calculator** (`domain/settlement/`) — pure. `netReimbursable` is
   the sum of allowed amounts on employee-paid lines; the balance is that minus
   the advance drawn. A non-negative balance is the amount payable to the
   employee; a negative balance is the amount recoverable from them (the two are
   mutually exclusive). Company-paid lines are memo only.
4. **Approval routing** (`domain/approval/`) — pure. Value bands pick the chain
   (Reporting Manager → Head of Department → Head of Division → MD), always
   followed by Finance verification (policy 2.1). International travel always
   adds MD. Roles are resolved to people up the claimant's reporting chain; a
   level whose approver would be the claimant is skipped (policy 2.2).
5. **State machine** (`domain/state-machine/`) — the single definition of legal
   trip-status transitions: `DRAFT` → `PENDING_APPROVAL` → `PENDING_FINANCE` →
   `VERIFIED` → `PAID`, plus `RETURNED` and `REJECTED`. Nothing sets a status ad
   hoc. Approvers act on the lowest pending business level only; the last
   business approval moves the trip to `PENDING_FINANCE`. Finance `pay` stamps
   the next payment-run date (10th / 25th, policy 5.4).
6. **Notifications + audit.** Every submit / approve / return / verify / pay
   raises an inbox notification for the next actor (best-effort — a failure is
   logged and swallowed, never breaks the flow) and writes an `audit_log` row
   with a before/after snapshot.

## Layout

```
apps/
  backend/
    src/
      config/         env (zod-validated, fails fast at boot), constants
      lib/            errors, db-error (SQLSTATE) mapping, response envelope,
                      logger, password (scrypt), session-token (JWT), num, dates
      middleware/     request-id, request-logger, current-user (identity),
                      require-role, validate (zod), error-handler  <-- global onError
      db/             drizzle client, schema/ (one file per table),
                      migrate.ts, seed/ (employees, policy, demo trip)
      routes/         one file per resource group — wiring only, no logic
      controllers/    thin: parse validated input -> call service -> send envelope
      services/       orchestration + business rules
      domain/         PURE, no I/O: policy engine, settlement calc,
                      approval routing, claim state machine
      ingestion/      mail-parser, classifier, deduper, extractors/, ocr/,
                      known-receipts (pre-transcribed demo receipts)
      repositories/   the only layer that touches SQL
      validators/     zod schemas per route
    drizzle/          committed SQL migrations 0000..0004 + meta
    seed-data/demo/   demo inbox, roster and policy (local, not committed)
  frontend/
    src/
      api/            client (fetch wrapper: envelope unwrap, typed ApiError),
                      endpoints (grouped calls), types (DTO mirrors)
      app/            AppRoutes, guards (RequireAuth / RequireArea), roles,
                      session (GET /auth/me on mount), theme, demo-users
      features/       claim/ (trip workspace pieces), analytics/ (dashboard)
      pages/          SignIn, SignUp, TripsList, NewTrip, TripWorkspace,
                      Queue, Review, Analytics, AdminClaims, AdminClaimDetail, NotFound
      ui/             primitives, form, Tabs, toast, icons, domain (StatusPill
                      etc.), PageHeader, AppShell, SideNav, NotificationBell, UserMenu
      lib/            format helpers
      styles/         tokens.css, base.css, app.css
packages/
  shared/             cross-app types and constants
```

### Database

Ten tables, one file each under `db/schema/`, plus a Postgres sequence
(`travel_request_seq`) that issues the human `TRQ-<year>-<seq>` Travel Request ID
(policy 1.1):

`employees` · `policy_config` · `trips` · `raw_documents` · `attachments` ·
`claim_lines` · `settlements` · `approvals` · `audit_log` · `notifications`

Schema changes are made in the Drizzle schema and generated with
`pnpm db:generate`; the resulting SQL is committed and applied by
`pnpm db:migrate` (a small script, not `drizzle-kit migrate`).

## Auth

Email + password for the fixed Acme roster — there is no self-service account
creation for new people. Passwords are hashed with **scrypt** (Node built-in,
stored as `scrypt$<keylen>$<salt>$<hash>`). A successful login issues a
**session JWT (HS256, `hono/jwt`)** signed with `JWT_SECRET`, set as an
`httpOnly` cookie (`SameSite=Lax` in dev, `None; Secure` in prod). The login and
signup responses also return the token in the body; the frontend keeps it in
`localStorage` and sends it as `Authorization: Bearer` — a fallback for
cross-site deploys where third-party cookies are blocked.

`middleware/current-user.ts` resolves the acting user in this order and re-loads
the employee row every request (so a role change takes effect immediately):

1. session cookie (JWT) — the real path
2. `Authorization: Bearer <token>`
3. `x-user: <empCode>` header — **non-production only** (`ALLOW_HEADER_AUTH`, on
   by default outside prod), for `curl` and end-to-end scripts

`JWT_SECRET` (≥ 16 chars) is required for the server to boot.

- **Sign up** = set a first-time password for an employee already on the roster.
  `409 ACCOUNT_ALREADY_REGISTERED` if a password exists; `400 EMAIL_NOT_RECOGNISED`
  if the email isn't on the roster.
- **Sign in** = `401 INVALID_CREDENTIALS` for any wrong email/password;
  `401 ACCOUNT_NOT_REGISTERED` when the account exists but has no password yet.

A claim is visible only to its traveller, the people in its approval chain,
Finance, and organisation oversight (Admin / MD) — enforced in the service
layer, so a guessed trip UUID is not a cross-employee data leak.

## Error handling (design)

- Every response uses one envelope: `{ success: true, data }` or
  `{ success: false, error: { code, message, details?, requestId } }`
  (`packages/shared/src/api-contract.ts`).
- Controller / service / repository code only ever `throw` an `AppError`
  subclass (`apps/backend/src/lib/errors.ts`). Each subclass fixes its HTTP
  status and machine `code`; `isOperational: false` marks a bug (generic 500,
  no internals leaked).
- **One** place turns an error into a response: `app.onError(onError)` in
  [`apps/backend/src/app.ts`](apps/backend/src/app.ts) →
  `src/middleware/error-handler.ts`. Precedence: `AppError` → `HTTPException` →
  `ZodError` (422) → Postgres driver error (`mapDbError` → typed `AppError`) → 500. Unmatched routes go through `app.notFound(onNotFound)` with the same
  envelope.
- HTTP status codes come from `packages/shared/src/http-status.ts` — nothing
  hard-codes an integer. Every request carries an `x-request-id`, echoed on the
  response and in every error body.

## Running it

Prereqs: Node ≥ 20.9, pnpm 9, and PostgreSQL 16 (a Docker service is provided).

```bash
pnpm install

# 1. database
cp apps/backend/env.example apps/backend/.env       # adjust if needed
pnpm db:up                                          # Postgres 16 in Docker
                                                    #   (or point DATABASE_URL at your own)
pnpm db:migrate                                     # apply the committed migrations
pnpm db:seed                                        # roster + policy_config + a demo draft trip

# 2. apps
pnpm dev                                            # backend :8080 + frontend :5173
```

- App: `http://localhost:5173` — in local dev Vite proxies `/api` to the backend
  (see `apps/frontend/vite.config.ts`), so there is no CORS to configure.
- API base: `http://localhost:8080/api`
- Health: `GET /api/health/live`, `GET /api/health/ready` (ready pings the DB).
- `pnpm build` compiles shared → backend → frontend in dependency order;
  `pnpm typecheck` and `pnpm test` run across the workspace.
- `pnpm db:generate` is only needed when you **change** the Drizzle schema — the
  generated SQL is already committed under `apps/backend/drizzle/`.

### Environment

`apps/backend/env.example` documents every variable. The ones that matter:

| Variable                | Default                                          | Notes                                                                                                    |
| ----------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | `postgres://settle:settle@localhost:5432/settle` | matches the Docker service                                                                               |
| `DATABASE_SSL`          | inferred                                         | `disable` for localhost, `require` for a managed host (Aiven, Neon, RDS…); override explicitly if needed |
| `JWT_SECRET`            | —                                                | **required**, ≥ 16 chars                                                                                 |
| `SESSION_TTL_SECONDS`   | `604800` (7 days)                                | session lifetime                                                                                         |
| `SEED_DEFAULT_PASSWORD` | `Acme@2026`                                      | password given to every seeded employee                                                                  |
| `CORS_ORIGINS`          | `http://localhost:5173`                          | comma-separated; only used when the frontend is served from another origin                               |
| `STORAGE_DIR`           | `./.storage`                                     | where uploaded raw emails / receipt blobs are written                                                    |

The frontend takes an optional `VITE_API_URL` for deploys where the API is on a
different origin; unset means same-origin (the dev proxy).

## Demo accounts

`pnpm db:seed` is idempotent. It loads the ten-person roster and the policy
configuration, sets `Acme@2026` on every account, and — only when the claims
database is otherwise empty — builds **one draft trip** for Chaitanya Reddy by
running the 15 demo emails and 2 receipts through the real ingestion
pipeline. It is left in `DRAFT`, so you walk the actual claimant workflow from
there. The sign-in screen shows the roster as quick-fill chips.

| Sign in as                     | Role               | Primary surface                                             |
| ------------------------------ | ------------------ | ----------------------------------------------------------- |
| `chaitanya.reddy@acmecorp.com` | Employee           | the demo trip; personal reimbursement + policy analytics    |
| `suresh.iyer@acmecorp.com`     | Reporting Manager  | Approvals queue; approver analytics                         |
| `meera.krishnan@acmecorp.com`  | Head of Department | Approvals queue (higher-value claims)                       |
| `arvind.rao@acmecorp.com`      | Head of Division   | Approvals queue                                             |
| `ravi.menon@acmecorp.com`      | Finance            | Finance queue; verification / payment / exception analytics |
| `nandita.shah@acmecorp.com`    | MD                 | Approvals + org-wide oversight                              |
| `admin@acmecorp.com`           | Admin              | org dashboard + a read-only claim register                  |

Analytics is scoped by role **in the API** (employee / approver / finance /
org), not just hidden in the UI. Admin and MD can inspect every claim; the Admin
account **cannot** approve, verify, pay, or edit — those controls stay with the
approval and finance roles.

**End-to-end demo path:** sign in as Chaitanya → open the demo trip → run the
policy check → resolve the `needs_info` line(s) → submit → approve as Suresh
(and Meera / Arvind if the amount routes that high) → verify then pay as Ravi →
watch the notification and settlement update for Chaitanya.

## API surface

All under `/api`. Everything except `POST /auth/{signup,login,logout}` and the
health checks requires an identity.

| Method & path                                                                          | Purpose                                                            |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /health/{live,ready}`                                                             | liveness / readiness (ready pings the DB)                          |
| `POST /auth/{signup,login,logout}` · `GET /auth/me`                                    | authentication                                                     |
| `GET /me`                                                                              | acting user                                                        |
| `GET /trips` · `POST /trips` · `GET /trips/:id`                                        | list own / create / full detail (authorised viewers)               |
| `POST /trips/:id/documents` · `DELETE /trips/:id/documents/:docId`                     | ingest emails/receipts · remove a document                         |
| `POST /trips/:id/{recompute,reprocess,submit}`                                         | re-run policy+settlement · re-derive lines · submit                |
| `POST /trips/:id/claim-lines` · `PATCH` / `DELETE /claim-lines/:id`                    | add / edit / remove a claim line (DRAFT or RETURNED)               |
| `POST /trips/:id/approvals/:level`                                                     | approver decision — `approved` / `returned` / `rejected` + remarks |
| `POST /finance/trips/:id/{verify,return,pay}`                                          | Finance verify / return to employee / release payment              |
| `GET /queues/{approvals,finance}`                                                      | work lists (flat `QueueRow` DTO)                                   |
| `GET /notifications` · `POST /notifications/read-all` · `POST /notifications/:id/read` | notification inbox                                                 |
| `GET /analytics/overview`                                                              | role-scoped dashboard payload                                      |
| `GET /admin/claims`                                                                    | Admin / MD read-only claim register                                |

## Key decisions

- **Policy as data.** City tiers, the approval matrix, the entitlement caps,
  and the non-reimbursable list follow the demo `expense_policy.md`; the roster
  and reporting lines come from `employee_master.csv`.
- **Travel Request IDs are system-issued** (`TRQ-<year>-<seq>` via a Postgres
  sequence), never typed by the employee.
- **Advance ≤ 60 % of estimated cost** is rejected at trip creation (policy 1.2).
- **The 7-day submission window (policy 5.1) is a warning, not a hard block** —
  the advance still has to be settled. The warning is returned on submit.
- **Submission is gated** on: at least one line, every line has a proof
  reference (policy 5.2), and no line left as `needs_info`.
- **Business entertainment** needs attendee names, attendee organisation, a bill,
  and — above ₹2,000 — HOD pre-approval; anything missing makes the line
  `needs_info`.
- **An expense whose rider name isn't the claimant's** is flagged and disallowed
  (`OTHER_PERSON`, policy 4).
- **Duplicates are dropped at ingest**, not shown struck through.

## Scope

Current limitations and what's intentionally not built yet:

- **OCR accuracy.** Other receipt images go through Tesseract OCR; the two demo
  receipts are pre-transcribed (`ingestion/known-receipts.ts`) so the demo is
  deterministic. A receipt that can't be read becomes a `needs_info` line the
  claimant completes, so the pipeline still runs.
- **Live integrations** — no mailbox sync, payroll, or accounting. Emails are
  uploaded as `.eml`; "pay" is a state transition plus an audit record.
- **Admin UI for policy / roster.** Policy numbers live in `policy_config`; the
  roster is seeded from `employee_master.csv`.
- **Test depth.** Unit tests cover the state machine; the other pure domain
  modules (policy engine, settlement calculator, routing, deduper, extractors)
  are verified end to end by hand — the first thing to add next.

## Tests

```bash
pnpm test        # vitest — apps/backend/tests/domain/state-machine.test.ts
pnpm typecheck   # tsc across shared + backend + frontend
pnpm build       # production build of all three packages
```
