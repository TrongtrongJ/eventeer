# Eventeer

A full-stack event ticketing platform: organizers publish events and coupons, customers book and pay, staff scan QR tickets at the door. Built as a production-minded reference for correctness under concurrency, session security, and contract-first APIs.

| | |
|---|---|
| **API** | NestJS 12, TypeORM + PostgreSQL, Redis, Bull, Socket.IO, Stripe, GraphQL |
| **Web** | Next.js (App Router), TanStack Query, Stripe Elements, Tailwind |
| **Contract** | oRPC + Zod: one schema package drives the server, client types, validation and OpenAPI |
| **Tooling** | Yarn 4 + Turborepo, Vitest, Playwright, real Postgres + Redis e2e, dependency-cruiser |

## Quick start

```bash
corepack enable && yarn install
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local

docker compose up -d        # Postgres + Redis
yarn seed:demo              # demo users, events, coupons (runs migrations first)
yarn dev                    # API :4000, web :3000
```

With no Stripe keys configured the app runs in **demo payment mode** (the checkout shows a "Pay (demo)" button), so the whole flow works without any third-party account. Demo logins are printed by the seed script (`admin@demo.com`, `organizer@demo.com`, `customer@demo.com`).

Everything in containers: `docker compose --profile app up --build`.

## Architecture

```
apps/backend          NestJS API (REST via oRPC controllers, GraphQL, websockets, jobs)
apps/frontend         Next.js app
packages/contract     oRPC route contracts (shared by API and web)
packages/shared-schemas  Zod schemas + inferred types (single source of truth)
```

Routes are declared once in `packages/contract`; the API implements them with `@Implement`, the web client is generated from them, and input/output are validated by the same Zod schemas on both sides. GraphQL is a second surface over the same services and the same auth.

## Authentication: opaque, cookie-only, two tokens

There are **no JWTs and no tokens in JavaScript**. Login sets two `httpOnly`, `SameSite=Lax` cookies (`Secure` in production):

| Cookie | Lifetime | Purpose |
|---|---|---|
| `access_token` | 15 min | Resolved to a user on every request |
| `refresh_token` | 7 days (30 day hard cap) | Mints a new pair; rotates on every use |

Both are 256-bit random strings. The database stores only their **SHA-256 hashes** (`auth_sessions`), so a database leak yields no usable credentials. Lookups are a single unique-index hit, fronted by a 30-second Redis cache that is evicted explicitly on revocation.

- **Rotation with reuse detection.** Each refresh swaps both tokens via compare-and-swap. Replaying an already-rotated refresh token revokes the whole session. A 10-second grace window tolerates the benign race of two tabs (or SSR plus browser) refreshing simultaneously.
- **Default-deny.** A global guard authenticates every REST *and* GraphQL request; only routes marked `@Public()` are open. Authorization (`@Roles`) runs before input validation.
- **CSRF.** `SameSite=Lax` plus an `Origin` check on state-changing requests.
- **Silent renewal in the web app.** The browser client single-flights a refresh on any 401 and replays the request. Next.js middleware renews an expired access cookie *before* server components render, so a logged-in user is never bounced to `/login`.
- **Hardening.** Password reset revokes every session; reset/verify tokens are stored hashed; per-user session cap; timing-equalised login; bcrypt input capped at 72 bytes; OAuth `state` is verified and OAuth never puts tokens in a URL; accounts are only linked on provider-verified emails.

## Correctness under concurrency

- **No overselling.** Seats are taken with one conditional `UPDATE ... WHERE availableSeats >= :n` inside the booking transaction, backstopped by a `CHECK` constraint. The e2e suite fires 8 simultaneous buyers at 3 seats and asserts exactly 3 succeed.
- **Coupons** are redeemed with a single conditional `UPDATE` in the same transaction, so usage caps hold under load and roll back with a failed booking.
- **Payments are webhook-driven and idempotent.** `PENDING -> CONFIRMED` is a conditional update, so Stripe retries and the client's confirm call can race safely. The API verifies payment status and amount with Stripe and never trusts the client. A payment that lands after a hold expired is automatically refunded. Stripe being down fails closed; there is no mock fallback.
- **Seat holds expire.** Abandoned checkouts release their seats via a repeatable Bull job.
- **Tickets** are issued only once payment is confirmed. Scanning is an atomic claim, restricted to the event's organizer, and rejects unpaid/cancelled bookings.

## Tests

```bash
yarn test            # unit (API + web)
yarn test:e2e        # API integration: full app against real Postgres + Redis
yarn test:e2e:web    # Playwright
yarn typecheck
```

## Deployment

`k8s/` contains manifests (single host, API under `/api`, same-origin cookies, websocket route, HPA). Schema changes run through `k8s/migration-job.yaml`, not app boot, so replicas never race. Socket.IO uses the Redis adapter so live seat counts reach every pod. Secrets are never committed: see `k8s/secrets.example.yaml`.

## Environment

All API configuration is validated at startup by `apps/backend/src/env.validation.ts`; the process refuses to boot with a precise error if anything required is missing. Production additionally requires Stripe keys (when payments are enabled) and an `https` `FRONTEND_URL`. See `apps/backend/.env.example`.
