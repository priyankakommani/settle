# Settle — Travel Expense Reimbursement

Take-home for Nortex Industries. Turns one trip's inbox (approval mails, advance
note, flight/hotel bookings, cab and meal receipts) into a policy-checked
settlement claim, routes it for approval, and tracks it to payment.

The problem pack lives in [`apps/backend/seed-data/pack/`](apps/backend/seed-data/pack).

---

## Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces (`apps/*`, `packages/*`) |
| Backend | Hono + TypeScript (Node 20, ESM) |
| DB | PostgreSQL 16 + Drizzle ORM / drizzle-kit |
| Frontend | React 18 + Vite + React Router + TanStack Query |
| Shared | `@settle/shared` — status codes, error codes, API envelope, domain enums |

## Layout

```
apps/
  backend/
    src/
      config/         env (zod-validated), constants
      lib/            errors, db-error mapping, response envelope, logger
      middleware/     request-id, request-logger, current-user (auth stub),
                      require-role, validate, error-handler  <-- global onError
      db/             drizzle client, schema/ (one file per table), migrate, seed/
      routes/         one file per resource group (no logic here)
      controllers/    thin: parse -> call service -> send envelope
      services/       orchestration + business rules
      domain/         PURE, no I/O: policy engine, settlement calc,
                      approval routing, claim state machine
      ingestion/      mail-parser, classifier, deduper, ocr, extractors/
      repositories/   the only layer that touches SQL
      validators/     zod schemas per route
  frontend/
    src/
      lib/            api-client (envelope unwrap + x-user header), format
      api/            typed endpoint calls
      pages/          Trips, TripReview, Settlement, Queue
      components/     UserSwitcher (auth stub)
packages/
  shared/             cross-app types
```

## Error handling (design)

- Every route response uses one envelope: `{ success: true, data }` or
  `{ success: false, error: { code, message, details?, requestId } }`
  (`packages/shared/src/api-contract.ts`).
- Code / service / repository layers only ever `throw` an `AppError` subclass
  (`apps/backend/src/lib/errors.ts`). Each subclass fixes its HTTP status and
  machine `code`.
- **One** place converts an error into a response: `app.onError(onError)` in
  `apps/backend/src/app.ts` → `src/middleware/error-handler.ts`. It also handles
  `HTTPException`, `ZodError`, and raw Postgres errors (SQLSTATE →
  `mapDbError` → typed `AppError`). Unmatched routes go through
  `app.notFound(onNotFound)` with the same envelope.
- Non-operational (unexpected) errors are logged with stack + `requestId` and
  return a generic 500 in production; details are shown in dev.
- HTTP status codes come from `packages/shared/src/http-status.ts`; nothing
  hard-codes an integer.

## Running it

Prereqs: Node ≥ 20.9, pnpm 9, Docker.

```bash
pnpm install

# 1. database
cp apps/backend/env.example apps/backend/.env      # adjust if needed
pnpm db:up                                         # postgres in docker
pnpm db:generate                                   # SQL from drizzle schema
pnpm db:migrate                                    # apply
pnpm db:seed                                       # employees + policy_config

# 2. apps
pnpm dev                                           # backend :8080 + frontend :5173
```

- API base: `http://localhost:8080/api`
- Health: `GET /api/health/live`, `GET /api/health/ready`
- Local development fallback: send `x-user: NX-4471` only when `ALLOW_HEADER_AUTH` is enabled (it defaults on outside production). The browser uses the signed session cookie instead.

## Demo accounts and analytics

`pnpm db:seed` creates the employee roster, policy configuration and, on an
empty claim database, one draft trip derived from the supplied inbox and receipt
pack. Every seeded account uses `Nortex@2026` by default (change
`SEED_DEFAULT_PASSWORD` outside local development).

- `chaitanya.reddy@nortexindustries.com` — personal claim, reimbursement and policy analytics
- Approver accounts — their decision workload and approval-rate analytics
- Finance accounts — finance workload, payment and exception analytics
- `admin@nortexindustries.com` — organisation dashboard plus a read-only claim register

The dashboard scope is enforced in the API, not merely hidden in the UI. Admin
and MD can inspect all claims; the Administrator account cannot approve,
verify, pay or edit them, so the existing approval and finance controls remain
separated.

## Status

Implemented: password sign-in, travel-request creation, inbox/receipt ingestion,
deduplication, policy evaluation, settlement calculation, staged approvals,
finance verification/payment, notifications, audit records, and role-scoped
analytics. The analytics UI uses KPI tiles, trend bars, claim-status donut,
allowed/disallowed category bars, and role-specific decision, exception or top
spender summaries.

Known limitations: image OCR is deterministic for the two supplied receipt
fixtures; unfamiliar images fall back to a manual claim line. The project has
unit coverage for the state machine only — browser and database integration
tests should be added before a production deployment. There is no external
mailbox connection, payroll integration, or employee/policy administration UI.
