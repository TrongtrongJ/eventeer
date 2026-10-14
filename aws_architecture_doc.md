# AWS Deployment Design

Target design for running Eventeer on AWS, and the reasoning behind it. It is a design document: nothing here is deployed, and [`terraform/`](terraform) is a baseline that lags it (see [Terraform baseline](#terraform-baseline)). For application behaviour see [`architecture_doc.md`](architecture_doc.md).

## Contents

- [Constraints from the application](#constraints-from-the-application)
- [Topology](#topology)
- [Service choices](#service-choices)
- [Configuration and secrets](#configuration-and-secrets)
- [Scaling and availability](#scaling-and-availability)
- [Security](#security)
- [Observability](#observability)
- [Delivery](#delivery)
- [Alternatives considered](#alternatives-considered)
- [Cost](#cost)
- [Gaps to close before deploying](#gaps-to-close-before-deploying)
- [Terraform baseline](#terraform-baseline)

---

## Constraints from the application

These drive most of the choices below.

1. **Two runtimes.** The web app is a Next.js server (Server Components, `proxy.ts`), not static files. It needs a Node runtime, so S3 + CloudFront alone is not enough.
2. **One origin.** Auth is `httpOnly`, `SameSite=Lax` cookies that both the browser's API calls and the Next.js server rely on. Web, API and WebSocket traffic must therefore share one host: `https://<host>/` for pages, `/api/*` for the API, `/socket.io/*` for live seat updates.
3. **Long-lived connections.** Socket.IO runs over WebSocket (the client forces the `websocket` transport, so no sticky sessions are needed).
4. **Stateless API replicas** with Redis for fan-out and queues. Redis is accessed through single-node clients (no cluster mode, no TLS option today).
5. **Migrations run as a separate step**, not on boot (`migrationsRun` is off in production).
6. **Opaque sessions.** There are no signing secrets to manage.

---

## Topology

```
                         Route 53  ->  CloudFront (ACM certificate, optional WAF)
                                            |
        +-----------------------------------+------------------------------------+
        | default (*)                       | /api/*   /socket.io/*              |
        | /_next/static/* (cached)          | (prefix stripped by CloudFront     |
        |                                   |  Function, caching disabled)       |
        +-----------------+-----------------+----------------+-------------------+
                          |   same ALB, listener rule on a custom origin header   |
                          v                                  v
                 target group: web (:3000)         target group: api (:4000)
                 ECS Fargate, Next.js standalone   ECS Fargate, NestJS
                          |                                  |
                          +---- API_INTERNAL_URL ----------->|   (private, Cloud Map / Service Connect)
                                                             |
                                +----------------------------+---------------------------+
                                v                            v                           v
                       RDS PostgreSQL 16            ElastiCache Redis 7          Stripe, SES SMTP,
                       Multi-AZ                     primary + replica            OAuth providers
                                                    (cluster mode off)           (via NAT or endpoints)
```

Request routing:

- CloudFront has two origins pointing at the same ALB. The `api` origin adds a custom header (for example `x-route: api`); an ALB listener rule matching that header forwards to the API target group, and everything else goes to web. A CloudFront Function strips `/api` from the URI on the way in, so the API sees `/auth/login`, exactly as behind the Kubernetes Ingress. (The header is needed because, after stripping, an API path such as `/auth/login` is indistinguishable from a page path at the ALB.)
- Dynamic behaviours (default, `/api/*`, `/socket.io/*`) use a no-cache policy and forward all cookies, query strings and headers (including `stripe-signature`, since the webhook is `POST /api/payment/webhook`). Only `/_next/static/*` is cached (content-hashed, long TTL).
- Build the web image with `NEXT_PUBLIC_API_URL=https://<host>/api` and `NEXT_PUBLIC_WS_URL=https://<host>`. Set `FRONTEND_URL=https://<host>` on the API, register OAuth redirect URIs as `https://<host>/api/auth/oauth/<provider>/callback`, and set `API_INTERNAL_URL` on the web service to the API's private address so server-side calls skip the public path.
- `TRUST_PROXY=2` (CloudFront and the ALB), so rate limiting and session metadata see the real client IP.

---

## Service choices

### Compute: ECS on Fargate, two services

| Service | Port | Size to start   | Scaling                                   |
| :------ | :--- | :-------------- | :---------------------------------------- |
| `api`   | 4000 | 0.5 vCPU / 1 GB | 2-10 tasks, target 70 % CPU / 80 % memory |
| `web`   | 3000 | 0.5 vCPU / 1 GB | 2-5 tasks, target 70 % CPU                |

Tasks run in private subnets across two AZs. The ALB health check uses `/health/ready` (process is up), not `/health`: the latter checks Postgres and Redis, and a brief dependency blip would then mark every task unhealthy at once and turn a partial failure into a full outage.

Fargate fits because the workload is a handful of long-running containers, including WebSocket connections and in-process Bull workers, which rules out a function-per-request model. The same images run unchanged under Kubernetes (manifests are in [`k8s/`](k8s)) if EKS is ever preferred.

### Database: RDS PostgreSQL 16, Multi-AZ

- Start at `db.t3.medium`, encrypted, automated backups with point-in-time recovery, deletion protection.
- The app does not split reads and writes, so no read replica is part of the baseline. Add one when browse traffic justifies it, together with a read connection in TypeORM.
- Correctness depends on Postgres features, not on the host: `CHECK` constraints, conditional `UPDATE ... RETURNING`, partial unique indexes. Aurora is not needed for any of that.

### Redis: ElastiCache, replication group, cluster mode off

Used for the session lookup cache, Bull queues (`email`, `maintenance`) and Socket.IO fan-out. One primary and one replica across AZs with automatic failover. **Cluster mode stays off**: Bull and the Socket.IO adapter assume a single keyspace, and the clients are single-node `ioredis` connections. Redis holds no source-of-truth data, so a failover costs queued jobs at worst and sessions fall back to Postgres.

In-transit encryption needs client TLS support first (see [gaps](#gaps-to-close-before-deploying)).

### Queue: Bull on Redis (no SQS)

The email queue is Bull. SQS would be more durable, but a queued email is low-stakes (the booking is already confirmed, and the job is retried three times with backoff), and a second queueing system is not justified at this scale. SQS becomes worth it if email volume or delivery guarantees grow.

### Email: SES through its SMTP interface

The API sends mail with Nodemailer over SMTP, so SES needs only `SMTP_HOST`, `SMTP_PORT=587` and credentials. No code change.

### Edge: CloudFront

Terminates TLS (ACM certificate in `us-east-1`), caches hashed static assets, and provides the single origin the cookies need. AWS WAF can be attached for managed rules and IP rate limiting, which also compensates for the API's per-replica rate limiter.

---

## Configuration and secrets

Secrets Manager entries injected as ECS task secrets:

- `DB_USERNAME`, `DB_PASSWORD`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SMTP_USER`, `SMTP_PASS`
- OAuth client secrets (Google, GitHub, Facebook), if enabled

Plain task environment: `NODE_ENV=production`, `FRONTEND_URL`, `TRUST_PROXY`, `DB_HOST`, `DB_NAME`, `REDIS_HOST`, `FEATURE_*` flags, and the non-secret OAuth settings.

There are no JWT secrets: sessions are opaque and stored hashed in Postgres. The API validates its environment at boot and refuses to start in production without an HTTPS `FRONTEND_URL` and, with payments enabled, Stripe keys.

**Migrations** run as a one-off Fargate task from the API image (the same command as [`k8s/migration-job.yaml`](k8s/migration-job.yaml): `node /app/node_modules/typeorm/cli.js -d dist/config/data-source.js migration:run`), before the services are updated.

---

## Scaling and availability

- **API and web** scale on CPU and memory; the API is stateless and Socket.IO events reach every replica through Redis. Rolling deployments drop WebSocket connections; the client reconnects and re-subscribes automatically.
- **Postgres** scales vertically first. The pressure point for a single hot event is one row being updated per booking, which a larger instance does not fix (see the limitations in [`architecture_doc.md`](architecture_doc.md#known-limitations)).
- **Availability:** ALB, tasks, RDS (Multi-AZ failover, typically 1-2 minutes) and ElastiCache (replica promotion) all span two AZs. Backups and point-in-time recovery cover data loss; cross-region recovery is not designed.
- **Background jobs** run inside the API tasks. Repeatable jobs are keyed so that multiple tasks register one schedule.

---

## Security

```
VPC 10.0.0.0/16
  public subnets    (2 AZs)  ALB, NAT gateway
  private subnets   (2 AZs)  ECS tasks (api, web)
  database subnets  (2 AZs)  RDS, ElastiCache
```

- **Security groups:** ALB accepts HTTPS only from CloudFront (the managed origin-facing prefix list); tasks accept traffic only from the ALB (and `web` -> `api` internally); RDS accepts 5432 and Redis 6379 only from the task security group.
- **Origin protection:** the custom origin header is also a shared secret, so requests that reach the ALB directly (bypassing CloudFront and WAF) are rejected.
- **Egress:** tasks reach Stripe, SES and OAuth providers through a NAT gateway; VPC endpoints for ECR, S3, CloudWatch Logs and Secrets Manager keep AWS traffic off the NAT.
- **IAM:** the execution role pulls images, writes logs and reads the secrets above. The application calls no AWS APIs, so the task role needs no permissions.
- **Application layer:** Helmet, a CORS allow-list of one origin, an `Origin` check on state-changing requests, hashed opaque sessions and rate limits are in the app itself (see [`architecture_doc.md`](architecture_doc.md#authentication-and-sessions)).

---

## Observability

Containers log to CloudWatch Logs (30-day retention). Request and domain logs carry a correlation ID, which is also returned in the `x-correlation-id` response header, so a user-reported failure can be traced through the logs.

Suggested alarms: ALB 5xx rate and target response time, unhealthy host count, ECS CPU/memory, RDS CPU, free storage and connections, ElastiCache memory and evictions.

Application metrics and tracing are not implemented (no exporter, no X-Ray/OpenTelemetry instrumentation), so alarms are infrastructure-level for now.

---

## Delivery

CI builds and tests, then publishes API and web images to GHCR on merges to `main`; nothing deploys automatically. For AWS the publish step would target ECR (with GitHub OIDC rather than long-lived keys), followed by the migration task and a forced new deployment of each service. `NEXT_PUBLIC_*` values are baked into the web image at build time, so the image is specific to a host.

---

## Alternatives considered

| Choice                               | Alternative                              | Why not                                                                                                                        |
| :----------------------------------- | :--------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| Fargate                              | EKS                                      | Control-plane cost and cluster operations for two services. The Kubernetes manifests keep it a viable move later.              |
| Fargate                              | Lambda + API Gateway                     | Long-lived WebSockets, in-process Bull workers and a long-running Next.js server fit containers better.                        |
| Next.js on Fargate behind CloudFront | Amplify Hosting / Vercel for the web app | Splits web and API across origins, which breaks first-party cookies unless everything is proxied back through one host anyway. |
| Single ALB, header-based rule        | Separate API subdomain                   | Cookies would be host-scoped to the wrong origin for `proxy.ts` and Server Components.                                         |
| RDS PostgreSQL                       | Aurora                                   | Costs more, with no feature the application needs.                                                                             |
| Bull on Redis                        | SQS                                      | See [Queue](#queue-bull-on-redis-no-sqs).                                                                                      |

---

## Cost

Rough baseline in `us-east-1`, before discounts: **about $350-500 per month**. The fixed costs dominate: RDS Multi-AZ, the NAT gateway, the ALB, ElastiCache, and four Fargate tasks. Compute Savings Plans and RDS reservations reduce the bill meaningfully; dropping to single-AZ for a non-production environment reduces it further. These are estimates and should be checked against the AWS pricing calculator before relying on them.

---

## Gaps to close before deploying

Small application changes this design depends on:

1. **Redis TLS.** The three Redis connections (`RedisModule`, Bull, the Socket.IO adapter) take only host and port. Either add a TLS option or leave ElastiCache in-transit encryption off (private subnets and security groups only).
2. **Migrations over SSL.** The TypeORM CLI data source (`config/data-source.ts`) ignores `DB_SSL`, and recent RDS PostgreSQL versions enforce SSL by default, so the migration task needs an SSL option there.
3. **Database certificate verification.** With `DB_SSL=true` the API encrypts the connection but sets `rejectUnauthorized: false`. Bundling the RDS CA and verifying it is a small follow-up.
4. **Redis-backed rate limiting.** Limits are per task today and scale with replica count.

---

## Terraform baseline

`terraform/main.tf` provisions the VPC, subnets, NAT, security groups, RDS (with a replica), ElastiCache, ALB, ECS cluster and a backend service with autoscaling, ECR, Secrets Manager, CloudWatch logs and an SQS queue. It was written before the move to a Next.js server and opaque sessions, so it differs from this design:

| Baseline                                                           | This design                                              |
| :----------------------------------------------------------------- | :------------------------------------------------------- |
| S3 static website + CloudFront for the frontend; no web service    | `web` Fargate service; CloudFront with the routing above |
| One backend target group, HTTP listener only (HTTPS commented out) | Two target groups, header-based listener rule, HTTPS     |
| SQS email queue and dead-letter queue                              | Bull on Redis; no SQS                                    |
| JWT secrets in Secrets Manager and `JWT_*` task variables          | No JWT secrets; Stripe, SMTP and OAuth secrets instead   |
| Redis with in-transit encryption on                                | Off until the clients support TLS                        |
| PostgreSQL 15.4, read replica provisioned                          | PostgreSQL 16, no replica until reads are split          |
| ALB health check on `/health`                                      | `/health/ready`                                          |
| Image tag `:latest`                                                | Immutable tags (commit SHA, as CI publishes)             |
