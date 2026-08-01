# AYV OS — API Specification

Base URL `https://api.adyourvision.com/api/v1` · OpenAPI served at `/api/docs`

---

## 1. Conventions

### Response envelope

```jsonc
// success
{ "success": true, "data": { … }, "meta": { "timestamp": "…", "requestId": "…" } }

// paginated
{ "success": true, "data": [ … ],
  "meta": { "page": 1, "limit": 25, "total": 342, "totalPages": 14,
            "hasNext": true, "hasPrev": false } }

// error
{ "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Validation failed",
             "details": [ { "field": "email", "message": "must be an email" } ],
             "requestId": "req_01H…" } }
```

### Standard query parameters

| Param | Example | Notes |
|-------|---------|-------|
| `page` `limit` | `?page=2&limit=50` | limit max 100 |
| `sort` | `?sort=-createdAt,name` | `-` prefix = descending |
| `search` | `?search=skyline` | Full-text across the resource's indexed fields |
| `filter[field]` | `?filter[status]=QUALIFIED` | Repeatable; comma = IN |
| `filter[field][op]` | `?filter[value][gte]=50000` | `gt gte lt lte ne in nin like` |
| `include` | `?include=owner,activities` | Relation expansion, max depth 2 |
| `fields` | `?fields=id,name,value` | Sparse fieldsets |
| `deleted` | `?deleted=true` | Include soft-deleted; requires `:restore` permission |

### Error codes

`VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 · `TOKEN_EXPIRED` 401 ·
`FORBIDDEN` 403 · `INSUFFICIENT_PERMISSION` 403 · `NOT_FOUND` 404 ·
`CONFLICT` 409 · `UNPROCESSABLE` 422 · `RATE_LIMITED` 429 ·
`INTERNAL_ERROR` 500 · `SERVICE_UNAVAILABLE` 503

### Headers

`Authorization: Bearer <accessToken>` · `X-Organization-Id` (multi-org users) ·
`X-Request-Id` (echoed for tracing) · `Idempotency-Key` (on POST that moves money)

---

## 2. Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create organisation + first Super Admin |
| POST | `/auth/login` | Email + password → access + refresh token |
| POST | `/auth/refresh` | Rotate refresh token, mint new access token |
| POST | `/auth/logout` | Revoke current session |
| POST | `/auth/logout-all` | Revoke every session for the user |
| GET | `/auth/me` | Current principal, role, permissions, organisation |
| POST | `/auth/forgot-password` | Send reset link |
| POST | `/auth/reset-password` | Consume reset token |
| POST | `/auth/change-password` | Authenticated change |
| POST | `/auth/mfa/enable` | Begin TOTP enrolment, returns QR payload |
| POST | `/auth/mfa/verify` | Confirm enrolment |
| POST | `/auth/mfa/challenge` | Second factor during login |
| GET | `/auth/sessions` | List active device sessions |
| DELETE | `/auth/sessions/:id` | Revoke a specific session |
| GET | `/auth/oauth/:provider` | Begin OAuth (google, microsoft) |
| GET | `/auth/oauth/:provider/callback` | Complete OAuth |

```jsonc
// POST /auth/login  →  200
{ "success": true, "data": {
    "accessToken": "eyJ…", "refreshToken": "eyJ…", "expiresIn": 900,
    "user": { "id": "usr_…", "name": "Priya Nair", "email": "priya@…",
              "role": { "key": "SALES_EXECUTIVE", "name": "Sales Executive" },
              "permissions": ["crm:lead:read:own", "crm:lead:create", …],
              "organizationId": "org_…" } } }
```

---

## 3. Organisations, Users, RBAC

| Method | Path | Permission |
|--------|------|-----------|
| GET / PATCH | `/organizations/current` | `org:read` / `org:update` |
| GET / PATCH | `/organizations/current/settings` | `setting:*` |
| GET | `/users` | `user:read` |
| POST | `/users` | `user:create` |
| GET / PATCH / DELETE | `/users/:id` | `user:*` |
| POST | `/users/:id/restore` | `user:restore` |
| POST | `/users/invite` | `user:create` |
| GET | `/users/:id/permissions` | `user:read` |
| PATCH | `/users/:id/role` | `role:assign` |
| GET | `/users/me/preferences` | self |
| GET / POST | `/teams` | `team:*` |
| GET / POST / PATCH / DELETE | `/roles` | `role:*` |
| GET | `/permissions` | `role:read` |

---

## 4. CRM

### Leads

| Method | Path | Description |
|--------|------|-------------|
| GET | `/crm/leads` | List, filter, search — scoped by permission |
| POST | `/crm/leads` | Create; fires `lead.created` |
| GET / PATCH / DELETE | `/crm/leads/:id` | Detail, update, soft delete |
| POST | `/crm/leads/:id/restore` | Restore |
| PATCH | `/crm/leads/:id/stage` | Move stage; fires `deal.stage_changed` |
| PATCH | `/crm/leads/:id/assign` | Reassign owner |
| POST | `/crm/leads/:id/convert` | Lead → Client + Project + Invoice (A06) |
| POST | `/crm/leads/:id/activities` | Log call, meeting, email, note |
| GET | `/crm/leads/:id/timeline` | Unified activity stream |
| POST | `/crm/leads/:id/score` | Recompute AI score |
| POST | `/crm/leads/import` | CSV bulk import with column mapping |
| GET | `/crm/leads/export` | CSV / XLSX export |
| GET | `/crm/leads/stats` | Funnel counts, conversion, sources |

```jsonc
// POST /crm/leads
{ "name": "Skyline Realty", "contactName": "Rajesh Kumar",
  "email": "rajesh@skylinerealty.in", "phone": "+919876543210",
  "source": "META", "industry": "REAL_ESTATE",
  "services": ["BRANDING", "SOCIAL_MEDIA"],
  "estimatedValue": 240000, "notes": "Wants rebrand before Sept launch" }
```

### Pipelines, quotations, proposals, contracts

| Method | Path |
|--------|------|
| GET / POST / PATCH | `/crm/pipelines`, `/crm/pipelines/:id/stages` |
| GET / POST | `/crm/quotations` · `POST /crm/quotations/:id/send` · `/accept` · `/reject` |
| GET / POST | `/crm/proposals` · `POST /crm/proposals/:id/generate` (AI) · `/send` |
| GET / POST | `/crm/contracts` · `POST /crm/contracts/:id/send-for-signature` · `/sign` |
| GET | `/crm/targets` · `/crm/leaderboard` · `/crm/commissions` |

---

## 5. Clients & Portal

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `/clients` | List, create |
| GET / PATCH / DELETE | `/clients/:id` | Detail, update, soft delete |
| GET | `/clients/:id/health` | Score with per-signal breakdown |
| GET | `/clients/:id/projects` `/invoices` `/files` `/activities` | Related resources |
| GET / POST | `/clients/:id/contacts` | Contact people |
| POST | `/clients/:id/portal-access` | Provision portal login |
| GET | `/clients/:id/renewals` | Upcoming renewals |
| GET / POST | `/clients/:id/tickets` | Support tickets |

**Portal namespace** — same auth, `CLIENT` role, hard-scoped to the caller's `clientId`:

`/portal/dashboard` · `/portal/projects` · `/portal/approvals` ·
`POST /portal/approvals/:id/approve|reject` · `/portal/invoices` ·
`/portal/files` · `/portal/reports` · `/portal/tickets` · `/portal/meetings`

---

## 6. Projects & Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `/projects` | List, create |
| GET / PATCH / DELETE | `/projects/:id` | Detail, update, soft delete |
| POST | `/projects/from-template` | Instantiate a service template |
| GET | `/projects/:id/health` | Schedule, budget and quality risk |
| GET / POST | `/projects/:id/members` | Team assignment |
| GET / POST | `/projects/:id/milestones` `/sprints` | Planning |
| GET / POST | `/tasks` | List, create |
| GET / PATCH / DELETE | `/tasks/:id` | Detail, update, soft delete |
| PATCH | `/tasks/:id/status` | Move; fires `task.status_changed` |
| PATCH | `/tasks/:id/assign` | Assign |
| POST | `/tasks/:id/subtasks` `/comments` `/attachments` `/dependencies` | Nested |
| POST | `/tasks/:id/time` | Log time |
| POST | `/tasks/reorder` | Bulk position update after drag |
| GET | `/tasks/my` | Current user's tasks, prioritised by AI |

---

## 7. Creative Production

| Method | Path |
|--------|------|
| GET | `/creative/queues` · `/creative/queues/:type` |
| GET / POST | `/creative/briefs` · `GET/PATCH /creative/briefs/:id` |
| POST | `/creative/briefs/:id/submit` — submit work for review |
| GET / POST | `/creative/revisions` · `/creative/revisions/:id/resolve` |
| GET | `/approvals` — unified queue across every approvable entity |
| POST | `/approvals/:id/approve` · `/reject` · `/request-changes` |
| POST | `/creative/:id/rate` — quality rating |
| GET | `/creative/metrics` — turnaround, revision rate, on-time |

---

## 8. HRM

`/hrm/employees` · `/hrm/attendance` (`POST /check-in`, `/check-out`, `GET /summary`) ·
`/hrm/leaves` (`POST /:id/approve|reject`, `GET /balance`) ·
`/hrm/payroll` (`POST /generate`, `/:id/approve`, `GET /:id/payslip`) ·
`/hrm/performance` (`/reviews`, `/goals`, `/kras`) ·
`/hrm/hiring` (`/jobs`, `/candidates`, `POST /candidates/:id/screen`, `/interviews`) ·
`/hrm/onboarding` · `/hrm/documents` · `/hrm/skills`

---

## 9. Finance

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `/finance/invoices` | List, create |
| POST | `/finance/invoices/:id/send` | Deliver to client |
| POST | `/finance/invoices/:id/payments` | Record payment |
| GET | `/finance/invoices/:id/pdf` | Rendered PDF |
| POST | `/finance/invoices/:id/reminder` | Manual reminder |
| GET / POST | `/finance/expenses` · `POST /:id/approve` | Expense workflow |
| GET / POST | `/finance/vendors` · `/finance/purchase-orders` | Procurement |
| GET / POST | `/finance/subscriptions` | Recurring revenue |
| GET | `/finance/reports/pnl` `/cash-flow` `/gst` `/ageing` `/forecast` | Reporting |
| GET / POST | `/finance/budgets` | Budgeting |

---

## 10. Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/executive` | The Executive Dashboard payload, snapshot-backed |
| GET | `/analytics/sales` `/marketing` `/operations` `/hr` `/finance` | Role dashboards |
| GET | `/analytics/revenue` | `?groupBy=month|client|service|employee` |
| GET | `/analytics/kpi/:key` | Single KPI with trend and target |
| GET | `/analytics/funnel` `/cohorts` `/retention` `/forecast` | Deep analysis |
| POST | `/analytics/query` | Saved custom query execution |

```jsonc
// GET /analytics/executive?period=month  →  200
{ "success": true, "data": {
  "period": { "from": "2026-07-01", "to": "2026-07-31" },
  "revenue": { "value": 1842000, "change": 23.4, "trend": [ … ] },
  "profit":  { "value": 620400, "margin": 33.7 },
  "cash":    { "balance": 2410000, "runwayMonths": 4.2 },
  "pipeline":{ "value": 4750000, "deals": 34, "forecast": 1820000 },
  "mrr": 1420000, "arr": 17040000,
  "funnel": [ { "stage": "NEW", "count": 142 }, … ],
  "clientHealth": { "healthy": 8, "atRisk": 2, "critical": 0 },
  "productivity": { "utilisation": 78, "onTimeRate": 91 },
  "alerts": [ { "severity": "HIGH", "type": "CLIENT_HEALTH", "message": "…" } ],
  "aiInsights": [ { "type": "OPPORTUNITY", "message": "…", "confidence": 0.82 } ] } }
```

---

## 11. Automation

| Method | Path |
|--------|------|
| GET / POST / PATCH / DELETE | `/automations` |
| POST | `/automations/:id/enable` · `/disable` · `/test` (dry run) |
| GET | `/automations/:id/runs` — execution history |
| GET | `/automations/triggers` · `/actions` — builder metadata |

---

## 12. AI

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ai/agents` | Roster with status and metrics |
| GET / PATCH | `/ai/agents/:key` | Configuration, autonomy level |
| POST | `/ai/agents/:key/invoke` | Run an agent action |
| GET / POST | `/ai/conversations` | Chat threads |
| POST | `/ai/chat` | Streaming chat (SSE) with page context |
| GET | `/ai/suggestions` | Contextual suggestions for the current record |
| POST | `/ai/generate/proposal` `/content` `/email` `/report` | Generation endpoints |
| POST | `/ai/analyse/client-health` `/deal` `/risk` | Analysis endpoints |
| GET | `/ai/usage` | Token and cost breakdown by agent |
| GET | `/ai/approvals` · `POST /ai/approvals/:id/approve|reject` | Human gates |

---

## 13. Supporting

**Search** `GET /search?q=&types=&limit=` — global; returns grouped, ranked results
**Notifications** `/notifications` · `PATCH /:id/read` · `POST /read-all` · `/preferences`
**Assets** `POST /assets/upload-url` (pre-signed) · `/assets` · `/assets/:id/versions` · `/folders`
**Documents** `POST /documents/generate` with `{ template, entityId, data }` · `/templates`
**Knowledge** `/knowledge/articles` · `/categories` · `/templates` · `/prompts`
**Social** `/social/posts` · `POST /:id/schedule` · `/publish` · `/calendar` · `/campaigns`
**Operations** `/operations/sops` · `/recurring-tasks` · `/escalations`
**Audit** `GET /audit?entity=&entityId=&actorId=&from=&to=`
**Integrations** `/integrations` · `POST /:provider/connect` · `/disconnect` · `/sync`
**Webhooks (inbound)** `POST /webhooks/meta-leads` `/google-leads` `/razorpay` `/whatsapp`

---

## 14. WebSocket

Connect `wss://api.adyourvision.com` with `auth: { token }`.

| Event | Payload |
|-------|---------|
| `notification:new` | Notification object |
| `lead:updated` `lead:stage_changed` | Lead delta |
| `task:updated` `task:moved` | Task delta |
| `project:activity` | Activity item |
| `approval:requested` | Approval object |
| `ai:stream` | `{ runId, delta }` token stream |
| `presence:update` | `{ userId, status, viewing }` |
| `kpi:tick` | Live dashboard counters |

Client emits `join:project` / `leave:project` / `presence:viewing` to manage rooms.

---

## 15. Rate Limits

| Scope | Limit |
|-------|-------|
| Global per IP | 1000 req / 15 min |
| Authenticated per user | 3000 req / 15 min |
| `/auth/login`, `/auth/forgot-password` | 5 req / 15 min per IP |
| AI generation endpoints | 60 req / hour per user |
| File upload | 100 / hour per user |
| Export | 10 / hour per user |

Responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
