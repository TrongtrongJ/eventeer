# AWS Cloud Architecture for Event Management Platform

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CloudFront (CDN)                        │
│                  • Static assets caching                        │
│                  • SSL/TLS termination                          │
│                  • DDoS protection                              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────┐              ┌─────────────────┐
│   S3 Bucket   │              │  Application    │
│  (Frontend)   │              │  Load Balancer  │
│               │              │      (ALB)      │
└───────────────┘              └────────┬────────┘
                                        │
                        ┌───────────────┼───────────────┐
                        │               │               │
                        ▼               ▼               ▼
                ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                │     ECS      │ │     ECS      │ │     ECS      │
                │   Fargate    │ │   Fargate    │ │   Fargate    │
                │  (Backend)   │ │  (Backend)   │ │  (Backend)   │
                │  Container   │ │  Container   │ │  Container   │
                └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
                       │                │                │
                       └────────────────┼────────────────┘
                                        │
                        ┌───────────────┼───────────────┐
                        │               │               │
                        ▼               ▼               ▼
                ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                │     RDS      │ │  ElastiCache │ │     SQS      │
                │  PostgreSQL  │ │    Redis     │ │   Queue      │
                │  (Primary)   │ │              │ │              │
                │      +       │ │              │ │              │
                │  (Read       │ │              │ │              │
                │  Replica)    │ │              │ │              │
                └──────────────┘ └──────────────┘ └──────────────┘
                        │
                        ▼
                ┌──────────────┐
                │   S3 Backup  │
                │   Automated  │
                │   Daily      │
                └──────────────┘
```

---

## 📋 Service Selection & Trade-offs

### 1. **Frontend Hosting: S3 + CloudFront**

**Service:** Amazon S3 (Static Website) + CloudFront CDN

**Why Chosen:**

- ✅ Simplest and cheapest for React SPA
- ✅ CloudFront provides global CDN with low latency
- ✅ Automatic SSL/TLS with AWS Certificate Manager
- ✅ Scales infinitely, pay only for what you use
- ✅ High availability (99.99% SLA)

**Alternatives Considered:**

| Alternative         | Pros                               | Cons                           | Decision                   |
| ------------------- | ---------------------------------- | ------------------------------ | -------------------------- |
| **Amplify Hosting** | Easier CI/CD, preview environments | More expensive, vendor lock-in | ❌ Overkill for simple SPA |
| **EC2 with nginx**  | Full control                       | Manual scaling, maintenance    | ❌ Unnecessary complexity  |
| **Vercel/Netlify**  | Great DX                           | Not AWS-native                 | ❌ Want full AWS stack     |

**Trade-offs:**

- ⚠️ No server-side rendering (SSR) - Fine for our use case
- ⚠️ Requires CloudFront invalidation for deployments - Acceptable
- ✅ Cost: ~$5-20/month depending on traffic

---

### 2. **Backend Hosting: ECS Fargate**

**Service:** Amazon ECS with Fargate (Serverless containers)

**Why Chosen:**

- ✅ No server management (serverless containers)
- ✅ Auto-scaling based on CPU/memory
- ✅ Container-based (works with existing Docker setup)
- ✅ Pay only for running containers
- ✅ Integrates well with ALB for load balancing
- ✅ Better cost efficiency than EC2 for variable workloads

**Alternatives Considered:**

| Alternative              | Pros                                      | Cons                                      | Decision                   |
| ------------------------ | ----------------------------------------- | ----------------------------------------- | -------------------------- |
| **EKS (Kubernetes)**     | Full K8s compatibility, more features     | $73/month just for control plane, complex | ❌ Overkill, expensive     |
| **Lambda + API Gateway** | Cheapest for low traffic, true serverless | Cold starts, 15min timeout, stateless     | ❌ WebSocket limitations   |
| **EC2 + Auto Scaling**   | Full control, cheaper at scale            | Manual management, patching               | ❌ Want serverless         |
| **App Runner**           | Simplest deployment                       | Limited control, newer service            | ⚠️ Could work, less mature |

**Trade-offs:**

- ⚠️ Slightly more expensive than EC2 at very high scale
- ⚠️ Some AWS-specific configuration (not pure K8s)
- ✅ Much simpler than EKS
- ✅ Cost: ~$30-100/month for 2-4 containers

**Why NOT Lambda:**

- WebSocket connections (real-time seat updates) don't work well with Lambda
- Circuit breaker pattern needs stateful containers
- Session management easier with long-running containers

---

### 3. **Database: RDS PostgreSQL**

**Service:** Amazon RDS PostgreSQL with Multi-AZ + Read Replica

**Why Chosen:**

- ✅ Managed service (automatic backups, patching, failover)
- ✅ Multi-AZ for high availability
- ✅ Read replica for read-heavy workloads (event browsing)
- ✅ Point-in-time recovery
- ✅ Easy to scale vertically
- ✅ TypeORM compatibility (no code changes)

**Configuration:**

- **Primary Instance:** db.t3.medium (2 vCPU, 4GB RAM)
- **Multi-AZ:** Enabled (automatic failover)
- **Read Replica:** 1 replica for read operations
- **Storage:** 50GB GP3 SSD (auto-scaling enabled)
- **Backups:** 7-day retention, automated daily

**Alternatives Considered:**

| Alternative             | Pros                             | Cons                       | Decision                           |
| ----------------------- | -------------------------------- | -------------------------- | ---------------------------------- |
| **Aurora PostgreSQL**   | Better performance, auto-scaling | 2x cost of RDS             | ❌ Expensive for startup           |
| **Self-managed on EC2** | Cheapest                         | Manual management, backups | ❌ Not worth the effort            |
| **DynamoDB**            | Serverless, scales infinitely    | NoSQL, requires rewrite    | ❌ Relational data fits PostgreSQL |

**Trade-offs:**

- ⚠️ More expensive than self-hosted (~$100-200/month)
- ✅ Zero maintenance, automatic failover
- ✅ Scales to millions of events

---

### 4. **Caching & Session: ElastiCache Redis**

**Service:** Amazon ElastiCache for Redis (Cluster Mode)

**Why Chosen:**

- ✅ Managed Redis (automatic failover, patching)
- ✅ Used for multiple purposes:
    - Session storage (JWT refresh tokens)
    - Distributed locks (coupon race conditions)
    - Message queue (Bull queue)
    - Caching (event listings)
- ✅ Sub-millisecond latency
- ✅ Cluster mode for high availability

**Configuration:**

- **Node Type:** cache.t3.micro (0.5GB RAM) for dev
- **Cluster Mode:** Enabled with 2 shards
- **Replicas:** 1 per shard (high availability)
- **Automatic failover:** Enabled

**Alternatives Considered:**

| Alternative                   | Pros                      | Cons                          | Decision                 |
| ----------------------------- | ------------------------- | ----------------------------- | ------------------------ |
| **MemoryDB for Redis**        | Durable, Redis-compatible | More expensive, newer         | ❌ Don't need durability |
| **Self-managed Redis on EC2** | Cheaper                   | Manual management             | ❌ Want managed          |
| **DynamoDB for sessions**     | Serverless                | Not suitable for locks/queues | ❌ Redis needed for Bull |

**Trade-offs:**

- ⚠️ Cost: ~$15-30/month
- ✅ Essential for distributed locking
- ✅ Reduces database load significantly

---

### 5. **Message Queue: Amazon SQS**

**Service:** Amazon SQS (Standard Queue)

**Why Chosen:**

- ✅ Fully managed, serverless
- ✅ Perfect for email queue (decoupled processing)
- ✅ Automatic scaling
- ✅ Dead letter queue for failed messages
- ✅ Pay per request (very cheap)

**Configuration:**

- **Queue Type:** Standard (at-least-once delivery)
- **Visibility Timeout:** 300 seconds
- **Dead Letter Queue:** Enabled (max 3 retries)
- **Message Retention:** 14 days

**Alternatives Considered:**

| Alternative            | Pros                | Cons                   | Decision                                     |
| ---------------------- | ------------------- | ---------------------- | -------------------------------------------- |
| **Bull Queue (Redis)** | Already using Redis | Less reliable than SQS | ⚠️ Use both: Bull for jobs, SQS for critical |
| **SNS + SQS**          | Pub/sub pattern     | More complex           | ❌ Don't need pub/sub                        |
| **EventBridge**        | Event-driven        | Overkill               | ❌ Simple queue is enough                    |

**Trade-offs:**

- ⚠️ Using both Bull (Redis) and SQS might seem redundant
- ✅ Bull for internal jobs, SQS for durable email queue
- ✅ Cost: ~$1/month (nearly free)

**Recommendation:** Start with Bull on Redis, migrate email queue to SQS if needed

---

### 6. **Load Balancing: Application Load Balancer (ALB)**

**Service:** Application Load Balancer

**Why Chosen:**

- ✅ Layer 7 load balancing (HTTP/HTTPS)
- ✅ WebSocket support (critical for real-time updates)
- ✅ SSL termination (use AWS Certificate Manager)
- ✅ Health checks and auto-scaling integration
- ✅ Path-based routing (can add more services later)

**Configuration:**

- **Type:** Application Load Balancer
- **Scheme:** Internet-facing
- **Availability Zones:** Multi-AZ (us-east-1a, us-east-1b)
- **Target Group:** ECS Fargate tasks
- **Health Check:** /health endpoint every 30s

**Alternatives Considered:**

| Alternative               | Pros                   | Cons                             | Decision                     |
| ------------------------- | ---------------------- | -------------------------------- | ---------------------------- |
| **Network Load Balancer** | Lower latency, cheaper | No WebSocket sticky sessions     | ❌ Need ALB for WebSocket    |
| **API Gateway**           | Serverless             | Not ideal for WebSocket at scale | ❌ ALB better for containers |
| **CloudFront only**       | Caching                | Can't handle backend             | ❌ Need both                 |

**Trade-offs:**

- ⚠️ Cost: ~$20-30/month minimum
- ✅ Essential for high availability
- ✅ WebSocket support is critical

---

### 7. **CDN: CloudFront**

**Service:** Amazon CloudFront

**Why Chosen:**

- ✅ Global edge locations (low latency worldwide)
- ✅ DDoS protection (AWS Shield Standard included)
- ✅ Free SSL/TLS certificates (ACM)
- ✅ Caches static assets (reduces S3 costs)
- ✅ Can cache API responses (optional)

**Configuration:**

- **Origins:**
    - S3 (frontend static files)
    - ALB (API endpoints - no caching)
- **Price Class:** All edge locations
- **SSL:** ACM certificate for custom domain
- **Caching:** Max for static assets, none for API

**Trade-offs:**

- ⚠️ Cache invalidation requires manual action
- ✅ Significantly improves global performance
- ✅ Cost: ~$5-15/month

---

### 8. **Secrets Management: AWS Secrets Manager**

**Service:** AWS Secrets Manager

**Why Chosen:**

- ✅ Encrypted storage for sensitive data
- ✅ Automatic rotation support
- ✅ Fine-grained IAM permissions
- ✅ Integrates with RDS (auto-rotation)

**What to Store:**

- Database credentials
- JWT secrets
- Stripe API keys
- OAuth client secrets
- SMTP credentials

**Alternatives Considered:**

| Alternative               | Pros          | Cons                   | Decision                 |
| ------------------------- | ------------- | ---------------------- | ------------------------ |
| **Parameter Store**       | Cheaper       | No auto-rotation       | ⚠️ Use for non-sensitive |
| **Environment Variables** | Simple        | Not encrypted, in logs | ❌ Not secure            |
| **HashiCorp Vault**       | More features | Self-hosted, complex   | ❌ Overkill              |

**Trade-offs:**

- ⚠️ Cost: $0.40 per secret/month + API calls
- ✅ Security best practice
- ✅ Automatic rotation for RDS

---

### 9. **Monitoring: CloudWatch + X-Ray**

**Services:**

- CloudWatch (Logs, Metrics, Alarms)
- X-Ray (Distributed tracing)

**Why Chosen:**

- ✅ Native AWS integration
- ✅ Centralized logging from all services
- ✅ Custom metrics from application
- ✅ Alarms for critical issues
- ✅ X-Ray for request tracing (correlation IDs)

**Configuration:**

- **Log Groups:** Separate for each ECS service
- **Retention:** 30 days
- **Metrics:** CPU, Memory, Request Count, Error Rate
- **Alarms:**
    - CPU > 80%
    - Error rate > 5%
    - Database connections > 80%

**Alternatives Considered:**

| Alternative   | Pros                     | Cons                        | Decision       |
| ------------- | ------------------------ | --------------------------- | -------------- |
| **Datadog**   | Better UI, more features | Expensive (~$15/host/month) | ❌ Cost        |
| **New Relic** | Great APM                | Expensive                   | ❌ Cost        |
| **ELK Stack** | Open source              | Self-hosted, complex        | ❌ Maintenance |

**Trade-offs:**

- ⚠️ CloudWatch UI not as nice as Datadog
- ✅ Much cheaper (nearly free for small apps)
- ✅ Native AWS integration

---

### 10. **CI/CD: GitHub Actions → ECR → ECS**

**Pipeline:**

1. GitHub Actions (build & test)
2. Push to Amazon ECR (container registry)
3. Deploy to ECS Fargate (rolling update)

**Why Chosen:**

- ✅ GitHub Actions already in use
- ✅ ECR integrates seamlessly with ECS
- ✅ No need for CodePipeline/CodeBuild
- ✅ Existing workflow, just change deployment target

**Alternative:** AWS-native CI/CD

- CodePipeline + CodeBuild + CodeDeploy
- More integrated but more complex
- GitHub Actions is simpler and familiar

---

## 💰 Cost Estimation

### Monthly Costs (Low to Medium Traffic)

| Service                       | Configuration                       | Monthly Cost |
| ----------------------------- | ----------------------------------- | ------------ |
| **S3 + CloudFront**           | Frontend hosting                    | $5 - $20     |
| **ECS Fargate**               | 2-4 containers (0.5 vCPU, 1GB each) | $30 - $100   |
| **RDS PostgreSQL**            | db.t3.medium + Multi-AZ + replica   | $150 - $200  |
| **ElastiCache Redis**         | cache.t3.micro cluster              | $15 - $30    |
| **Application Load Balancer** | Standard ALB                        | $20 - $30    |
| **SQS**                       | Standard queue                      | $1 - $5      |
| **Secrets Manager**           | 10 secrets                          | $4 - $8      |
| **CloudWatch**                | Logs + Metrics                      | $10 - $30    |
| **Route 53**                  | Hosted zone + DNS queries           | $1 - $3      |
| **Data Transfer**             | Outbound data                       | $10 - $50    |
| **Backups**                   | S3 + RDS snapshots                  | $5 - $15     |

**Total: $250 - $500/month** for a production-ready setup

**Optimization Options:**

- Use Reserved Instances for RDS (-40%)
- Use Savings Plan for Fargate (-50%)
- **Optimized Total: $150 - $300/month**

---

## 🚀 Scaling Strategy

### Vertical Scaling (Performance)

- **RDS:** Scale to larger instance types
- **ElastiCache:** Add more RAM
- **Fargate:** Increase CPU/memory per task

### Horizontal Scaling (Capacity)

- **Fargate:** Auto-scale from 2-10 tasks based on CPU
- **RDS:** Add more read replicas
- **Redis:** Add more shards (cluster mode)

### Auto-Scaling Configuration

```yaml
ECS Auto Scaling:
    Min Tasks: 2
    Max Tasks: 10
    Target CPU: 70%
    Target Memory: 80%
    Scale-out cooldown: 60s
    Scale-in cooldown: 300s

RDS Read Replicas:
    Min: 1
    Max: 3
    Trigger: CPU > 75% for 5 minutes
```

---

## 🔒 Security Architecture

### Network Security

```
VPC (10.0.0.0/16)
├── Public Subnets (10.0.1.0/24, 10.0.2.0/24)
│   └── ALB (internet-facing)
├── Private Subnets (10.0.10.0/24, 10.0.11.0/24)
│   └── ECS Fargate Tasks
└── Database Subnets (10.0.20.0/24, 10.0.21.0/24)
    ├── RDS PostgreSQL
    └── ElastiCache Redis
```

**Security Groups:**

- ALB: Allow 443 from 0.0.0.0/0
- ECS: Allow traffic only from ALB
- RDS: Allow 5432 only from ECS security group
- Redis: Allow 6379 only from ECS security group

**IAM Roles:**

- ECS Task Execution Role (pull images, logs)
- ECS Task Role (access Secrets Manager, SQS, S3)
- Minimal permissions (principle of least privilege)

---

## 🌍 High Availability

**Multi-AZ Deployment:**

- ✅ ALB across 2+ availability zones
- ✅ ECS tasks in multiple AZs
- ✅ RDS Multi-AZ (automatic failover)
- ✅ ElastiCache with replicas
- ✅ S3 (11 9's durability)

**Disaster Recovery:**

- **RTO (Recovery Time Objective):** < 5 minutes
- **RPO (Recovery Point Objective):** < 1 minute
- Automated daily snapshots
- Cross-region backup to S3 (optional)

---

## 📊 Architecture Decision Summary

| Requirement   | AWS Service        | Why This Service                         |
| ------------- | ------------------ | ---------------------------------------- |
| Frontend      | S3 + CloudFront    | Cheapest, simplest for SPA               |
| Backend       | ECS Fargate        | Serverless containers, WebSocket support |
| Database      | RDS PostgreSQL     | Managed, Multi-AZ, read replicas         |
| Cache/Session | ElastiCache Redis  | Distributed locks, Bull queue, caching   |
| Queue         | SQS                | Durable email queue                      |
| Load Balancer | ALB                | WebSocket support, Layer 7               |
| CDN           | CloudFront         | Global performance                       |
| Secrets       | Secrets Manager    | Encrypted, auto-rotation                 |
| Monitoring    | CloudWatch + X-Ray | Native integration, cost-effective       |

**Overall Philosophy:**

- ✅ **Managed services** over self-hosted (reduce ops burden)
- ✅ **Serverless where possible** (Fargate, SQS, S3)
- ✅ **Multi-AZ everything** (high availability)
- ✅ **Cost-optimized** (no expensive services like EKS)
- ✅ **Production-ready** (monitoring, backups, security)

---

## 🎯 Why NOT Alternatives?

### Why NOT Kubernetes (EKS)?

- ❌ $73/month just for control plane
- ❌ Complex to manage (nodes, networking)
- ❌ Overkill for 2-4 containers
- ✅ Fargate gives 80% of benefits at 30% of cost

### Why NOT Lambda?

- ❌ WebSocket limitations (API Gateway WebSocket expensive)
- ❌ Stateless (circuit breaker needs state)
- ❌ Cold starts affect user experience
- ✅ Good for async jobs, not main API

### Why NOT Aurora?

- ❌ 2x cost of RDS PostgreSQL
- ❌ Auto-scaling not needed at current scale
- ✅ RDS is sufficient, can migrate later

### Why NOT EC2?

- ❌ Manual patching and maintenance
- ❌ Fixed capacity (no auto-scaling benefit)
- ❌ Need to manage load balancers manually
- ✅ Fargate is worth the 20% premium

---

## 📈 Migration from Local to AWS

### Phase 1: Initial Setup (Week 1)

1. VPC, subnets, security groups
2. RDS PostgreSQL + ElastiCache Redis
3. S3 bucket for frontend
4. Secrets Manager for credentials

### Phase 2: Backend Deployment (Week 2)

1. Build Docker image
2. Push to ECR
3. Create ECS cluster and task definition
4. Deploy to Fargate
5. Configure ALB

### Phase 3: Frontend Deployment (Week 3)

1. Build React app
2. Upload to S3
3. Configure CloudFront
4. Set up custom domain (Route 53)

### Phase 4: Production Hardening (Week 4)

1. Enable auto-scaling
2. Configure monitoring and alarms
3. Set up automated backups
4. Load testing
5. Security review

---

## ✅ Summary

This architecture provides:

- ✅ **Scalability** - Auto-scales from 2-10 containers
- ✅ **High Availability** - Multi-AZ, automatic failover
- ✅ **Security** - Private subnets, encrypted secrets
- ✅ **Cost-Effective** - ~$250-500/month for production
- ✅ **Low Maintenance** - Managed services
- ✅ **Production-Ready** - Monitoring, backups, CI/CD

**Perfect for an international startup or showcase project!** 🚀
