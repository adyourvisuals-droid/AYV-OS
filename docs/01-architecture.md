# AYV OS — System Architecture

> The operating system of Ad Your Vision. One platform replacing ClickUp, HubSpot,
> Notion, Slack, Sheets, Trello, Monday, Zoho CRM and Zoho Books.

---

## 1. Architectural Principles

| # | Principle | Consequence |
|---|-----------|-------------|
| 1 | **Modular monolith first, services later** | One deployable API with hard module boundaries. Extract to services only when a module's scaling profile diverges. Avoids distributed-systems tax at agency scale (10–200 seats). |
| 2 | **Every write is an event** | Domain events are emitted from the service layer, consumed by the automation engine, notification engine and audit log. Automation is never hard-coded into business logic. |
| 3 | **Multi-tenant from line one** | Every tenant-owned row carries `organizationId`. Enforced at the Prisma middleware layer, not by developer discipline. |
| 4 | **Soft delete everywhere** | `deletedAt` on every business entity. Nothing is ever truly destroyed; restore is a first-class operation. |
| 5 | **Audit everything** | Every mutation writes an `AuditLog` row with actor, before/after diff, IP, user agent. |
| 6 | **AI is a citizen, not a bolt-on** | Agents authenticate as principals with their own RBAC scope. An AI agent literally cannot do what its role forbids. |
| 7 | **Read models for dashboards** | Executive analytics never run aggregate queries against hot OLTP tables at request time. Snapshots are materialised by scheduled jobs. |

---

## 2. High-Level Topology

```
                          ┌─────────────────────────────┐
                          │   Clients                   │
                          │  Web · Mobile PWA · Portal  │
                          └──────────────┬──────────────┘
                                         │ HTTPS / WSS
                          ┌──────────────▼──────────────┐
                          │   Next.js 15 (App Router)   │
                          │   RSC · Server Actions      │
                          │   Vercel Edge               │
                          └──────────────┬──────────────┘
                                         │ REST /api/v1  +  WebSocket
                          ┌──────────────▼──────────────┐
                          │   NestJS API (Railway)      │
                          │  ┌───────────────────────┐  │
                          │  │  Interface Layer      │  │  Controllers · Guards · DTO validation
                          │  ├───────────────────────┤  │
                          │  │  Application Layer    │  │  Services · Use cases · Event emission
                          │  ├───────────────────────┤  │
                          │  │  Domain Layer         │  │  Entities · Policies · Scoring engines
                          │  ├───────────────────────┤  │
                          │  │  Infrastructure       │  │  Prisma · S3 · Redis · AI providers
                          │  └───────────────────────┘  │
                          └───┬──────────┬──────────┬───┘
                              │          │          │
              ┌───────────────▼──┐  ┌────▼─────┐  ┌─▼──────────────┐
              │  PostgreSQL 16   │  │  Redis   │  │  AWS S3        │
              │  Primary + RR    │  │ Cache ·  │  │  Assets ·      │
              │                  │  │ PubSub · │  │  Documents     │
              │                  │  │ BullMQ   │  │                │
              └──────────────────┘  └────┬─────┘  └────────────────┘
                                         │
                          ┌──────────────▼──────────────┐
                          │   Worker Process (BullMQ)   │
                          │  Automation · Notifications │
                          │  AI jobs · Analytics rollup │
                          │  Recurring tasks · Reports  │
                          └──────────────┬──────────────┘
                                         │
      ┌──────────┬───────────┬───────────┼───────────┬──────────┬──────────┐
      ▼          ▼           ▼           ▼           ▼          ▼          ▼
  OpenAI      Claude      Gemini     Meta Ads    Google Ads  WhatsApp   Razorpay
                                     Lead Ads     + GA4       Cloud API   / Stripe
```

### Why a worker process, not in-process jobs

Creative agencies run bursty workloads: a campaign launch fires 400 lead webhooks in
90 seconds; a month-end close renders 200 PDF invoices. Those must never contend with
the request path that a CEO is using to load the Executive Dashboard. The API process
enqueues; the worker executes. Both share the same Nest module graph, so services are
written once.

---

## 3. Module Boundaries

Each module is a NestJS module owning its own controllers, services, DTOs and Prisma
access. Cross-module reads go through the owning module's **public service interface** —
never by reaching into another module's tables directly.

```
apps/api/src/modules/
├── auth/            JWT, refresh rotation, OAuth, sessions, MFA
├── organizations/   Tenant, settings, branding, subscription tier
├── users/           Employees, profiles, skill matrix, reporting lines
├── rbac/            Roles, permissions, policy evaluation
├── crm/             Leads, pipelines, deals, quotations, proposals, contracts
├── clients/         Accounts, contacts, health score, renewals
├── projects/        Projects, tasks, sprints, dependencies, time tracking
├── creative/        Production queues, revisions, approvals, ratings
├── hrm/             Attendance, leave, payroll, performance, hiring
├── finance/         Invoices, GST, expenses, vendors, P&L, cash flow
├── operations/      SOPs, recurring tasks, approvals, escalations
├── knowledge/       Wiki, templates, prompt library, playbooks
├── assets/          DAM, versioning, storage providers
├── social/          Content calendar, scheduling, publishing, analytics
├── portal/          Client-facing scoped surface
├── analytics/       Snapshots, KPI engine, forecasting
├── automation/      Rule engine, triggers, conditions, actions
├── ai/              Agent registry, memory, tools, orchestration
├── notifications/   Multi-channel fan-out and preferences
├── search/          Global full-text + trigram search
├── documents/       PDF generation from templates
├── audit/           Immutable activity log
└── integrations/    Meta, Google, WhatsApp, payment gateways, Drive
```

**Dependency rule:** modules may depend on `auth`, `rbac`, `audit`, `notifications`,
`automation` and shared infrastructure. Business modules must not import each other's
internals; they communicate via the event bus or public service interfaces.

---

## 4. Request Lifecycle

```
HTTP Request
  → ThrottlerGuard            rate limit per IP + per user
  → JwtAuthGuard              verify access token, load principal
  → OrganizationGuard         resolve tenant, inject into AsyncLocalStorage
  → PermissionsGuard          evaluate @RequirePermission() against role matrix
  → ValidationPipe            class-validator DTO, whitelist + forbid unknown
  → Controller
      → Service               business logic, transaction boundary
          → Prisma            tenant filter injected by middleware
          → EventEmitter      domain event published
  → AuditInterceptor          write AuditLog with diff
  → TransformInterceptor      envelope response
  → Response
```

The tenant context lives in `AsyncLocalStorage`, so a Prisma middleware can inject
`organizationId` into every query without any service passing it explicitly. This is
the single most important safety property in the system: a developer who forgets the
tenant filter still gets a tenant-scoped query.

---

## 5. Event & Automation Architecture

Business logic emits typed domain events. It does not know who listens.

```
LeadCreatedEvent
   ├─→ AutomationEngine   evaluate rules with trigger=lead.created
   ├─→ NotificationEngine notify assigned owner
   ├─→ AnalyticsCollector increment funnel counters
   ├─→ SearchIndexer      upsert into search index
   └─→ AiAgentDispatcher  wake SalesAgent for qualification scoring
```

### Automation rule shape

```ts
{
  trigger:    { event: 'lead.created' },
  conditions: [
    { field: 'source',        operator: 'in',  value: ['META', 'GOOGLE'] },
    { field: 'estimatedValue', operator: 'gte', value: 50000 }
  ],
  actions: [
    { type: 'ASSIGN_OWNER',   config: { strategy: 'ROUND_ROBIN', roleId: '…' } },
    { type: 'CREATE_TASK',    config: { title: 'First call', dueInMinutes: 30 } },
    { type: 'SEND_WHATSAPP',  config: { templateId: 'welcome_v2' } },
    { type: 'AI_AGENT',       config: { agent: 'SALES', action: 'SCORE_LEAD' } }
  ]
}
```

Rules are data, not code. Ops staff build them in the UI. Every execution writes an
`AutomationRun` row with input, output, duration and error — so "why did this lead go
to Rahul?" is always answerable.

Full workflow catalogue: [`06-automation-workflows.md`](./06-automation-workflows.md)

---

## 6. Analytics Architecture

Dashboards must load in under 400 ms with five years of history. Live aggregation over
OLTP tables cannot do that. Three tiers:

| Tier | Mechanism | Freshness | Use |
|------|-----------|-----------|-----|
| **Live** | Direct indexed query | Real-time | Counters on a single entity — tasks due today, open tickets |
| **Cached** | Redis, 60–300 s TTL | Near-real-time | Pipeline value, team workload, active project counts |
| **Snapshot** | `AnalyticsSnapshot` table, hourly/daily/monthly rollups by BullMQ | Hourly–daily | Revenue trends, MRR/ARR, CAC, LTV, retention, cohorts |

The Executive Dashboard reads almost entirely from snapshots. The "60-second business
understanding" goal is a latency requirement, and it is met by precomputation.

---

## 7. AI Architecture

AI agents are first-class principals with identity, memory, permissions and tools.

```
┌─────────────────────────────────────────────────────────┐
│                   AI Orchestrator                        │
│  routing · retries · cost tracking · provider fallback   │
└───────┬─────────────────────┬───────────────────┬───────┘
        │                     │                   │
   ┌────▼─────┐         ┌─────▼──────┐     ┌──────▼──────┐
   │ Claude   │         │  OpenAI    │     │  Gemini     │
   │ reasoning│         │  general   │     │  multimodal │
   │ analysis │         │  embeddings│     │  video      │
   └──────────┘         └────────────┘     └─────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  ┌───────────┐        ┌────────────┐        ┌────────────┐
  │  Memory   │        │   Tools    │        │  Guardrails│
  │ pgvector  │        │ scoped to  │        │ RBAC · PII │
  │ short/long│        │ agent role │        │ cost caps  │
  └───────────┘        └────────────┘        └────────────┘
```

**Memory model**
- *Working memory* — current conversation, Redis, TTL 24 h
- *Episodic memory* — past interactions, `AiMemory` table with pgvector embeddings
- *Semantic memory* — company knowledge base, embedded and retrieved via RAG
- *Procedural memory* — the agent's SOPs from the Knowledge module

**Tool execution** — an agent calling `create_task` goes through the exact same
`PermissionsGuard` a human would. The Sales Agent cannot approve an invoice, because
its role has no `finance:invoice:approve` permission. This is the guarantee that makes
autonomous agents safe to deploy.

Full agent specification: [`08-ai-command-center.md`](./08-ai-command-center.md)

---

## 8. Security Model

| Layer | Control |
|-------|---------|
| Transport | TLS 1.3, HSTS, secure cookies |
| Authentication | Argon2id passwords, JWT access (15 min) + rotating refresh (7 d), device sessions, optional TOTP MFA |
| Authorisation | RBAC with resource:action permissions, ownership + team scoping, field-level redaction for salary/margin data |
| Tenancy | `organizationId` injected by Prisma middleware; cross-tenant access structurally impossible |
| Input | class-validator whitelist, Zod on the frontend boundary, parameterised queries only |
| Rate limiting | Global, per-user, and per-endpoint throttles; stricter on auth routes |
| Secrets | Environment-injected, never committed; rotation documented in runbook |
| Files | Pre-signed S3 URLs, MIME + magic-byte validation, size caps, virus scan hook |
| Audit | Immutable append-only log with actor, diff, IP, UA |
| Compliance | Soft delete + export + purge endpoints for data-subject requests |

**Refresh token rotation with reuse detection:** each refresh mints a new token and
invalidates the old. Presenting a used token revokes the entire session family and
alerts the user — this turns stolen-token replay into a detected incident.

---

## 9. Realtime

Socket.IO over Redis adapter, so any API instance can push to any client.

| Room | Purpose |
|------|---------|
| `org:{orgId}` | Company-wide announcements, KPI ticks |
| `user:{userId}` | Personal notifications, mentions, assignments |
| `project:{projectId}` | Task moves, comments, presence |
| `lead:{leadId}` | Pipeline movement, new activity |
| `agent:{runId}` | Streaming AI agent output |

---

## 10. Repository Layout

```
ayv-os/
├── apps/
│   ├── api/                 NestJS — REST, WebSocket, worker
│   │   ├── prisma/          schema, migrations, seed
│   │   └── src/
│   │       ├── common/      guards, interceptors, decorators, filters
│   │       ├── config/      typed env configuration
│   │       ├── infra/       prisma, redis, s3, queue, mail
│   │       └── modules/     business modules (§3)
│   └── web/                 Next.js 15 App Router
│       └── src/
│           ├── app/         routes — (auth) (app) (portal)
│           ├── components/  ui primitives + feature components
│           ├── lib/         api client, hooks, utils
│           └── styles/      design tokens
├── packages/
│   ├── types/               shared DTO + enum contracts
│   └── config/              shared eslint / tsconfig / tailwind preset
├── docs/                    this documentation set
├── docker-compose.yml       postgres + redis + api + web
└── .github/workflows/       CI: lint, typecheck, test, build
```

---

## 11. Environments

| Env | Frontend | API | Database | Purpose |
|-----|----------|-----|----------|---------|
| Local | `localhost:3000` | `localhost:4000` | Docker Postgres | Development |
| Preview | Vercel preview | Railway PR env | Branch DB | Per-PR review |
| Staging | staging.ayv.os | Railway staging | Staging DB | Pre-release QA |
| Production | app.adyourvision.com | api.adyourvision.com | Managed PG + replica | Live |

---

## 12. Scaling Path

| Stage | Seats | Action |
|-------|-------|--------|
| 1 | 0–50 | Single API instance, single Postgres. Current design. |
| 2 | 50–200 | Horizontal API replicas behind LB, Redis cluster, read replica for analytics. |
| 3 | 200–1000 | Extract AI workers and file processing to dedicated services. Partition `AuditLog` and `Activity` by month. |
| 4 | 1000+ | Per-tenant schema isolation for enterprise accounts. CQRS read store for analytics. |

Nothing in Phase 1 forecloses any of these. Module boundaries are the seams along
which extraction happens.
