# Eventeer

Event ticketing platform: organizers publish events and coupons, customers book and pay, tickets are checked in by QR code. A TypeScript monorepo (NestJS API + Next.js web app) built as a portfolio project. Most of the effort went into the parts that tend to go wrong in ticketing systems (seat inventory under concurrency, payment/ticket consistency, session security) rather than feature breadth.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-12-red.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black.svg)](https://nextjs.org/)
[![oRPC](https://img.shields.io/badge/oRPC-2.beta-pink.svg)](https://orpc.dev/)

## Contents

- [Engineering highlights](#engineering-highlights)
- [DX highlights](#dx-highlights)
- [Stack](#stack)
- [Getting started](#getting-started)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Status](#status)

---

## Engineering highlights

### 1. Contract-first, end to end

Every endpoint is declared once in [`packages/contract`](packages/contract) (oRPC + Zod 4 schemas from [`packages/shared-schemas`](packages/shared-schemas)).

- The API implements the contract (`@Implement(...)` on Nest controllers). The web app consumes the same contract through a typed client and TanStack Query option builders. Renaming a field fails compilation on whichever side did not follow.
- The same Zod schemas validate forms, GraphQL resolver input and WebSocket payload types.
- The OpenAPI document is generated from the contract at boot and served with Scalar at `/docs`. There are no hand-written annotations to drift.
- Services throw plain Nest exceptions; one oRPC interceptor and a global filter map them to the oRPC error shape, so the client always receives a typed `{ code, message }`.

### 2. Opaque, cookie-only, dual-token sessions

No JWTs. Tokens are 256-bit random values with no claims, stored as SHA-256 hashes in `auth_sessions` (one row per device) and delivered only in `httpOnly`, `SameSite=Lax` cookies. Nothing auth-related is readable from JavaScript.

- **Rotation with replay detection:** refresh is a compare-and-swap on the stored hash, so exactly one of N concurrent refreshes wins. Replaying an already-rotated token outside a 10 s grace window revokes the whole session.
- **Cheap, revocable lookups:** a 30 s Redis read-through cache sits in front of the session lookup; revocation evicts explicitly, and the TTL is the staleness ceiling. If Redis is down, authentication falls back to Postgres.
- **Bounded lifetime:** 15 min access, 7 d refresh, 30 d hard cap per session, 5 sessions per user. A password reset revokes every session.
- **No refresh stampede in the browser:** single-flight per tab, a Web Locks lock across tabs, and a "refreshed since this request was sent" check that replays stale 401s instead of refreshing again. For server-rendered pages, `proxy.ts` renews an expired access cookie before any Server Component renders.
- **Other:** Argon2id (`@node-rs/argon2`), equalised login timing for unknown emails, an `Origin` check on state-changing requests on top of `SameSite`, OAuth (Google, GitHub, Facebook) with a state cookie and no linking on unverified provider emails.

### 3. Inventory and payment integrity

- **Seats and coupons use one conditional `UPDATE ... WHERE availableSeats >= :n ... RETURNING` inside the booking transaction** instead of read-then-write or application-level locks. Concurrent buyers serialise on the row; losers get a clean "sold out". `CHECK` constraints on `events` and `coupons` are the backstop if application logic ever regresses.
- **No network I/O while holding row locks.** The booking commits first, then the payment intent is created. If that fails, the booking is compensated (`FAILED`, seats and coupon usage returned).
- **Pay-later holds:** a `PENDING` booking holds its seats for 15 min; a repeatable Bull job releases abandoned holds, but first asks Stripe whether the customer paid just in time.
- **One confirmation path:** the Stripe webhook and the client-triggered confirm both end in the same `PENDING -> CONFIRMED` conditional update, so tickets and email happen exactly once. The client path verifies status and amount with Stripe and never trusts the browser. A payment arriving after the hold lapsed is refunded.
- **Fail closed:** no mock fallback when Stripe is down; mock payments are refused in production by env validation. Intent creation and refunds carry Stripe idempotency keys. Money is handled in integer cents.
- **Check-in:** ticket validation is an atomic claim (`WHERE isValidated = false`), so two simultaneous scans cannot both succeed.

### 4. Resilience and operability

- **`@nestjs/resilience`** around the calls that can hang: Stripe (timeout, retry, breaker), SMTP and each OAuth provider (timeout, breaker), the Redis session cache (150 ms timeout, breaker, falls back to Postgres). Bulkheads guard Argon2 hashing (memory) and the public event search (DB pool). Breaker state is per process.
- **Email** is queued on Bull. While the SMTP breaker is open, jobs wait without using an attempt; real failures back off from 30 s, permanent rejections fail at once, and mails past their useful life (a reset link, say) are dropped. A mail failure never fails or rolls back a booking.
- **Idempotent booking creation** (`Idempotency-Key`, Redis-backed, scoped per user) and a row-locked event update, so editing capacity cannot overwrite seats a concurrent booking just took.
- **Correlation IDs** are accepted (if well-formed) or generated per request, returned in a header and attached to log entries.
- **Live seat counts** over Socket.IO with the Redis adapter, so an update from any API replica reaches clients on every replica. Broadcasts happen after commit.
- **Config is validated at boot** (Zod). Production additionally requires an HTTPS frontend URL and, with payments enabled, Stripe keys; it refuses to start without them.
- **Schema is owned by migrations.** Dev and test run them on boot; production runs them as a separate Job so replicas do not race.

Design rationale and trade-offs are in [`architecture_doc.md`](architecture_doc.md).

---

## DX highlights

- **ESM-only dependencies in a CommonJS Nest API.** oRPC 2 and `uuid` are ESM-only; the API compiles to CommonJS on Node 22 and consumes them through `require(esm)`.
- **No node-gyp.** Argon2 uses prebuilt N-API binaries, so installs and image builds do not need a compiler toolchain.
- **Architecture rules in CI.** `dependency-cruiser` forbids import cycles, the web app importing the API, and `shared-schemas` importing apps. Lint, typecheck and these rules gate every PR.
- **Monorepo that builds as one.** Turborepo orders `shared-schemas -> contract -> apps`; a contract change is type-checked against both apps in the same run.
- **React Compiler** is enabled, with Next.js 16 `cacheComponents`.
- **Tests that need no setup:** the web e2e suite runs against mocked API responses (MSW); the API e2e suite creates its own `*_test` database and refuses to run against any other name.
- **Local loop:** `make infra` starts Postgres and Redis; `make up` runs everything in containers. Husky runs lint-staged and typecheck on commit, a build on push, and commitlint on messages.

---

## Stack

| Layer    | Technology                                                                                                                                   |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| Web      | Next.js 16 (App Router), React 19, TanStack Query, oRPC client, shadcn/ui + Tailwind 4, next-intl (en/th), Socket.IO client, Stripe Elements |
| API      | NestJS 12 (Express 5), TypeORM, oRPC, Apollo GraphQL (secondary surface), Bull, Socket.IO, Stripe SDK, Nodemailer                            |
| Data     | PostgreSQL 16, Redis 7 (session cache, Bull queues, Socket.IO fan-out)                                                                       |
| Shared   | Zod 4 schemas, oRPC contract, ESLint/Prettier configs                                                                                        |
| Tooling  | Yarn 4, Turborepo, Vitest, Playwright, MSW, dependency-cruiser, Husky, commitlint                                                            |
| Delivery | Docker, Docker Compose, Kubernetes manifests, GitHub Actions and Bitbucket Pipelines, Terraform (AWS baseline)                               |

### Repository layout

```
apps/
  backend/            @eventeer/api   NestJS API (REST via oRPC, GraphQL, Socket.IO, Bull workers)
  frontend/           @eventeer/web   Next.js app
packages/
  contract/           @packages/contract        oRPC contracts (consumed by both apps)
  shared-schemas/     @packages/shared-schemas  Zod schemas, cookie constants
  eslint-config/ prettier-config/
k8s/  terraform/  .github/  bitbucket-pipelines.yml  docker-compose.yml  Makefile
```

---

## Getting started

Requires Node.js 22, Docker, and Corepack (ships with Node) for Yarn 4.

```bash
corepack enable && yarn install

cp .env.example .env                                  # variables for docker compose
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local   # optional: defaults work locally

make infra          # Postgres + Redis in Docker
yarn dev            # API :4000 and web :3000, with package watchers
yarn seed:demo      # demo users, events, coupons (use --reset to wipe first)
```

Or run everything in containers: `make up` (Compose profile `app`).

- Web: http://localhost:3000
- API reference (Scalar): http://localhost:4000/docs
- GraphiQL: http://localhost:4000/graphql (non-production only)

With the Stripe keys left empty, payments run in mock mode (the checkout "Pay" button confirms the booking). With email disabled, verification and reset links are written to the API log in development.

Demo accounts created by `seed:demo`:

| Role      | Email                | Password        |
| :-------- | :------------------- | :-------------- |
| Admin     | `admin@demo.com`     | `Admin123!`     |
| Organizer | `organizer@demo.com` | `Organizer123!` |
| Customer  | `customer@demo.com`  | `Customer123!`  |

A second organizer (`organizer2@demo.com`) and customer (`customer2@demo.com`) use the same passwords as their roles.

To use real services, set `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` for the web app), SMTP, and OAuth credentials; see `apps/backend/.env.example`. The webhook endpoint is `POST /payment/webhook`.

---

## Testing

```bash
yarn test            # unit tests (Vitest), both apps
make infra && yarn test:e2e     # API integration tests: real Postgres + Redis
yarn test:e2e:web    # Playwright against mocked API responses
```

The API e2e suite asserts the invariants above against a real database, for example:

- 8 concurrent buyers for 3 seats: exactly 3 succeed.
- Coupon usage caps hold under contention, roll back with a failed booking, and are returned on cancel.
- Tickets exist only after payment; the client secret is visible only to the booking's owner.
- Two simultaneous scans of one ticket: exactly one is accepted.
- Refresh-token replay is detected; password reset revokes all sessions; cross-origin state-changing requests are rejected.
- Abandoned holds expire and return their seats; capacity cannot drop below seats sold; events with bookings cannot be deleted.

Unit tests cover the booking, coupon, event and auth services (including payment-provider failure and webhook duplicate delivery), env validation, the origin guard and money handling. The web app has Vitest tests for the oRPC layer, query invalidation, session handling and access control, plus Playwright flows for auth, booking, role gating, OAuth callback and route protection.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): lint + typecheck + dependency rules, unit tests and build run in parallel; both e2e suites run only if those pass; on `main`, API and web images are published to GHCR. Nothing is deployed automatically.

---

## Deployment

- **Images:** multi-stage Dockerfiles for the API and the web app (Next.js `standalone` output). `NEXT_PUBLIC_*` values are build arguments.
- **Kubernetes** ([`k8s/`](k8s)): API 3-10 replicas and web 2-5 replicas behind HPAs, a migration Job, and a single-host Ingress that serves web, `/api/*` and `/socket.io/*` from one origin (required for first-party auth cookies). Postgres and Redis manifests are for demo clusters (both on persistent volumes; Redis runs AOF with `noeviction`, which Bull needs); use managed services otherwise.
- **AWS:** design and trade-offs in [`aws_architecture_doc.md`](aws_architecture_doc.md); [`terraform/`](terraform) is a baseline that lags that design (see the doc).

---

## Documentation

- [`architecture_doc.md`](architecture_doc.md): decisions, data model, booking/payment and session flows, failure modes, known limitations
- [`aws_architecture_doc.md`](aws_architecture_doc.md): AWS deployment design

---

## Status

- [x] Contract-first API (oRPC + Zod 4), OpenAPI via Scalar
- [x] Opaque cookie-only session auth with rotation and replay detection
- [x] Seat, coupon and check-in concurrency, with e2e coverage
- [x] Next.js App Router frontend, TanStack Query, i18n (en/th)
- [x] Architecture and AWS design documentation
- [x] Unit, API e2e and web e2e suites; GitHub Actions and Bitbucket Pipelines
- [x] Kubernetes manifests
- [x] Migrate circuit breaker, idempotency to new official nestjs packages (backend; the web app does not send an `Idempotency-Key` yet)
- [x] Resilience and concurrency edge cases
    - [x] Concurrent token refresh (thundering herd), including across tabs
    - [x] Coupon and seat races, double-scan, late payment after hold expiry
    - [X] Wrapping costly Argon2 hashing with bulkhead
    - [x] Atomic update on event update, handling ticket booking in-between
    - [x] Delay failed Bull email instead of burning them on multiple failures
    - [ ] ....
- [X] Complete dockerization
- [X] Terraform brought in line with the Next.js server and opaque sessions

## Optional (The project is currently small, self-contained)
- [ ] Microservices and SAGA pattern (already modularized, correlationId prepared)
- [ ] Feature flag by ConfigCat (Not enough flags worth moving from env)
- [ ] Full observability and OpenTelemetry (external service dependent)
- [ ] Redis-backed rate limiting (limits are per replica today)
- [ ] Metrics and tracing export (correlation IDs and health checks only for now)
