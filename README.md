# NexusWMS — AI Warehouse Management System

Production-ready, Vercel-deployable warehouse management for logistics teams:
multi-warehouse inventory with reservations, an immutable stock ledger, a
full dispatch workflow, **deterministic AI demand forecasting** with stockout
risk and reorder recommendations, reports with CSV export, role-based access
control and complete audit trails.

```
Login → Dashboard → Products → Warehouses → Inventory → Stock Movement →
Dispatch → Automatic Inventory Update → Historical Data → AI Forecast →
Stockout Risk → Reorder Recommendation → Reports
```

---

## Tech stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | Next.js 15 (App Router) + React 19 + TypeScript (strict)       |
| UI         | Tailwind CSS v4, shadcn/ui-style components (Radix), Lucide    |
| Charts     | Recharts                                                      |
| Database   | PostgreSQL                                                    |
| ORM        | Prisma (migrations + seed included)                           |
| Validation | Zod                                                           |
| Auth       | bcryptjs password hashing + JWT sessions (`jose`, httpOnly cookie) |
| Tests      | Vitest (43 unit + 10 integration) + 49-check HTTP smoke suite |
| Runtime    | 100% Vercel serverless (no persistent servers, no filesystem) |

---

## Features

### Authentication & RBAC
- Secure sessions: HS256 JWT in an `httpOnly`, `SameSite=Lax` cookie (7-day expiry).
- Passwords hashed with bcrypt (12 rounds). No plaintext anywhere.
- Four roles with a server-enforced permission matrix (`lib/permissions.ts`):

| Capability                    | ADMIN | MANAGER | WAREHOUSE_STAFF | VIEWER |
| ----------------------------- | :---: | :-----: | :-------------: | :----: |
| Dashboard / read everything   | ✅    | ✅      | partial         | ✅     |
| Products / warehouses write   | ✅    | ✅      | ❌              | ❌     |
| Stock operations & movements  | ✅    | ✅      | ✅              | ❌     |
| Dispatch create / process     | ✅    | ✅      | ✅              | ❌     |
| Run forecasts                 | ✅    | ✅      | ❌              | ❌     |
| Reports                       | ✅    | ✅      | ❌              | ❌     |
| Users management              | ✅    | ❌      | ❌              | ❌     |
| Audit logs                    | ✅    | ❌      | ❌              | ❌     |

Authorization is enforced in **every** page guard, server action and API route
— the UI only mirrors decisions for UX. Role changes/deactivations take effect
immediately because roles are re-read from the database per request.

### Inventory engine
- `availableQuantity = quantity − reservedQuantity`, enforced everywhere.
- Operations: `IN`, `OUT`, `TRANSFER`, `ADJUSTMENT` (set counted qty), `RETURN`.
- Serializable transactions with automatic retry on conflicts.
- **Negative stock is impossible**: availability is validated inside the same
  transaction that mutates the row.

### Dispatch workflow
- `PENDING → PROCESSING → READY → DISPATCHED`, `CANCELLED` until dispatched.
- Creation validates against *available* stock and **reserves** it atomically.
- Completion deducts stock and writes immutable OUT movements referencing the
  dispatch number. Cancellation releases reservations.
- Human-readable numbers (`DSP-20260826-0036`) with collision-safe generation.

### AI forecasting (deterministic — no LLM involved)
Implemented under `lib/ai/` behind a provider interface so a real ML service
can be swapped in later:

1. **Holt double-exponential smoothing** (level + trend) over up to 90 days of
   daily demand derived from the immutable movement ledger.
2. **Weekly seasonality** via weekday indices shrunk toward 1.0 on sparse data.
3. **Confidence score** from one-step-ahead backtest MAPE (bounded 35–96%).
4. **Stockout risk** from days-of-cover vs horizon (`LOW/MEDIUM/HIGH/CRITICAL`).
5. **Reorder recommendation**: `ceil-to-pack( reorderPoint + forecast(H) − available )`
   where `reorderPoint = avgDaily × leadTime(7d) + safetyStock(z=1.65·σ·√LT)`.

Same inputs always produce identical outputs. If `AI_API_KEY` + `AI_FORECAST_URL`
are configured the app calls your external model first and falls back to the
local engine on any failure — forecasting never depends on it.

Example output:

```
Product: Wireless Mouse        Current Stock: 120
30-Day Forecast: 185           Stockout Risk: HIGH
Recommended Reorder: 100       Confidence: 87%
```

### Also included
- Dashboard with 10 KPIs and 6 Recharts visualisations.
- Reports (inventory / movements / dispatch / forecast) with filters + CSV export (RFC-4180, Excel-friendly BOM).
- Audit logs for logins, product/warehouse/inventory/dispatch/user changes.
- Notifications (low-stock warnings) surfaced in the header bell.
- Dark/light mode, skeletons, empty/error states, toasts, confirm dialogs, accessible components.
- Rate limiting on login; secure headers via `next.config.ts`.

---

## Project structure

```
app/
  (dashboard)/          # authenticated UI (server components first)
    dashboard products warehouses inventory stock-movements
    dispatch forecast reports users audit-logs settings
  api/                  # route handlers
    auth/{login,logout,me} products/[id] warehouses/[id]
    inventory[/availability] stock-movement dispatch/[id]/status
    forecasting reports/[type] users/[id] audit-logs notifications
  login/
components/
  ui/                   # shadcn-style primitives
  charts/ layout/ auth/
lib/
  db.ts errors.ts permissions.ts rate-limit.ts audit.ts notifications.ts
  auth/                 # password, session (node), session.edge (middleware), guards
  ai/                   # types, stats, forecaster, provider, service
  inventory/            # math (pure) + transactional service
  dispatch/             # state machine + service
  dashboard/ reports/
  validations/          # Zod schemas
prisma/
  schema.prisma  migrations/  seed.ts
tests/
  unit/ integration/ smoke.ps1 stubs/
middleware.ts
```

---

## Running with Docker (Quickstart)

The repository is fully Dockerized with a multi-stage `Dockerfile` and `docker-compose.yml` (PostgreSQL + Next.js standalone runner with auto-migration).

### 1. Start the entire stack

```bash
docker compose up --build -d
```

The app will be available at: **http://localhost:3000**

### 2. Seed demo data in Docker

To seed the initial demo data (users, warehouses, products, historical movements, dispatches, forecasts):

```bash
docker compose exec app npx tsx prisma/seed.ts
# or via npm script:
npm run docker:seed
```

### 3. Docker Management Commands

```bash
npm run docker:up     # start services in the background
npm run docker:down   # stop all services
npm run docker:logs   # view live logs
npm run docker:seed   # seed database inside container
```

---

## Getting started (local)

### 1. Prerequisites
- Node.js 20+
- PostgreSQL 14+ running locally

### 2. Install & configure

```bash
npm install
cp .env.example .env      # then edit values
```

`.env` for local development:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wms?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/wms?schema=public"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> `AUTH_SECRET` is consumed by edge middleware at **build time**, exactly like
> on Vercel — make sure it exists whenever you run `npm run build`.

### 3. Migrate & seed

```bash
npx prisma migrate deploy     # apply committed migrations
npm run db:seed               # realistic demo data (see below)
npm run dev
```

The deterministic seed creates: **4 users, 3 warehouses, 34 products,
~3,400 stock movements across 90 days, 35 dispatches (30 completed through the
real lifecycle), 42 persisted forecasts, audit logs and notifications** — all
generated through legitimate ledger arithmetic, so every number reconciles.

### Demo credentials

| Role            | Email                  | Password       |
| --------------- | ---------------------- | -------------- |
| ADMIN           | admin@nexuswms.io      | `Password123!` |
| MANAGER         | manager@nexuswms.io    | `Password123!` |
| WAREHOUSE_STAFF | staff@nexuswms.io      | `Password123!` |
| VIEWER          | viewer@nexuswms.io     | `Password123!` |

### Useful scripts

```bash
npm run dev             # dev server
npm run build           # prisma generate + production build
npm start               # serve production build
npm run lint            # ESLint
npm run typecheck       # tsc --noEmit
npm test                # unit tests (no DB needed)
npm run test:integration# integration tests (needs TEST_DATABASE_URL)
npm run db:migrate      # prisma migrate deploy
npm run db:migrate:dev  # create new migrations during development
npm run db:seed         # reseed demo data (wipes existing rows)
npm run db:studio       # Prisma Studio
```

---

## Testing

```bash
# unit — pure business logic, runs anywhere
npm test                        # 43 tests

# integration — REAL PostgreSQL transactions
TEST_DATABASE_URL="postgresql://…/wms_test" npm run test:integration   # 10 tests

# end-to-end HTTP smoke suite against a running build (49 checks)
npm run build && npm start
powershell -ExecutionPolicy Bypass -File tests/smoke.ps1 -BaseUrl http://localhost:3000
```

Covered: authentication, RBAC enforcement (all four roles), inventory
IN/OUT/transfer/adjustment, negative-inventory prevention, dispatch stock
validation, reservation accounting, completion/cancellation semantics, state
machine transitions, forecasting determinism/confidence/risk/reorder math,
Zod validation boundaries and CSV escaping.

Integration tests are skipped automatically when `TEST_DATABASE_URL` is absent.

---

## API documentation

All responses use one envelope:

```json
{ "success": true,  "data": { … } }
{ "success": false, "error": { "message": "…", "code": "INSUFFICIENT_STOCK", "details": {} } }
```

Errors map to proper HTTP codes: `400` bad request · `401` unauthenticated ·
`403` missing permission · `404` not found · `409` conflict · `422` validation /
business rule · `429` rate-limited · `500` internal.

| Endpoint | Methods | Permission |
| --- | --- | --- |
| `/api/auth/login` | POST | public (rate-limited 8/min/IP) |
| `/api/auth/logout` | POST | any session |
| `/api/auth/me` | GET | any session |
| `/api/products`, `/api/products/[id]` | GET POST / GET PATCH DELETE | read · write |
| `/api/warehouses`, `/api/warehouses/[id]` | GET POST / GET PATCH | read · write |
| `/api/inventory` | GET | `inventory:read` |
| `/api/inventory` | POST | `inventory:write` — body `{type, productId, warehouseId, destinationWarehouseId?, quantity, reason?, reference?}` |
| `/api/inventory/availability?warehouseId=` | GET | `dispatch:read` |
| `/api/stock-movement` | GET | `movements:read` |
| `/api/dispatch` | GET POST | read · write |
| `/api/dispatch/[id]` | GET | `dispatch:read` |
| `/api/dispatch/[id]/status` | POST | process/write — body `{status, note?}` |
| `/api/forecasting?productId=&horizon=7\|14\|30` or `?top=10` | GET | `forecast:read` |
| `/api/forecasting` | POST `{productId, horizon, persist?}` | `forecast:run` |
| `/api/reports/[type]` | GET (CSV) | `reports:read` — `type ∈ inventory \| stock-movement \| dispatch \| forecast` |
| `/api/users`, `/api/users/[id]` | GET POST / PATCH | `users:read` · `users:write` |
| `/api/audit-logs` | GET | `audit:read` |
| `/api/notifications` | GET POST | any session |

---

## Deploying to Vercel

1. Push this repository to GitHub.
2. Create a PostgreSQL database (Neon, Supabase, Vercel Postgres, Railway…).
3. Import the repo in Vercel and set environment variables:

```env
DATABASE_URL=        # pooled connection string
DIRECT_URL=          # direct (unpooled) string - used by migrations
AUTH_SECRET=         # openssl rand -base64 32
NEXT_PUBLIC_APP_URL= # https://your-app.vercel.app
AI_API_KEY=          # optional
AI_FORECAST_URL=     # optional external forecaster endpoint
```

4. Apply migrations once from your machine (or a release step):

```bash
DATABASE_URL="…" DIRECT_URL="…" npx prisma migrate deploy
npm run db:seed   # optional demo data
```

5. Deploy. Every route is serverless-compatible; there is no Express, no
   `app.listen()`, no Docker, no SQLite, no filesystem persistence and no
   background workers. The Prisma client is a global singleton reused across
   warm invocations.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `AUTH_SECRET is missing or too short` | Set ≥16-char secret; rebuild after changing it (edge middleware inlines env at build time). |
| `P3009 / P1001` during migrate | Check both `DATABASE_URL` **and** `DIRECT_URL`; pooled providers need the direct URL for DDL. |
| Login always 401 locally | Re-run `npm run db:seed`; passwords come only from the seed. |
| Empty forecast page | Needs outbound history — record Stock OUTs or complete dispatches, open `/forecast` again. |
| Integration tests skip | Export `TEST_DATABASE_URL` before running. |
| CSV shows garbled accents in Excel | Keep the BOM (already emitted); open via Data → From Text if needed. |

## Security notes

- Sessions are signed JWTs; role/active status revalidated per request from DB.
- All mutations go through Zod + permission guards; Prisma parameterises SQL.
- Login rate limiting per IP (per-lambda window; swap in Upstash behind the
  same interface for strict global quotas).
- No secrets in code: everything reads from environment variables, `.env*` is
  gitignored, `.env.example` documents required keys.

## Future improvements

- Cycle-count module with variance approval flows.
- Purchase orders / inbound ASN receiving.
- Barcode scanning (camera + hardware) for pick/put-away.
- Multi-currency & tax handling on dispatch valuation.
- Cron-driven nightly forecast refresh (Vercel Cron) + email digests.
- Pluggable ML provider (Prophet/gradient boosting) behind `ForecastProvider`.
- Distributed rate limiting via Upstash Redis.
#   W M S - A I - f o r e c a s t i n g  
 #   A I - f o r e c a s t i n g - W M S  
 