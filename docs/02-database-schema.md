# AYV OS — Database Schema

PostgreSQL 16 · Prisma ORM · canonical definition in [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)

---

## 1. Universal Conventions

Every business table carries:

```prisma
id             String    @id @default(cuid())
organizationId String                          // tenant key — on everything
createdAt      DateTime  @default(now())
updatedAt      DateTime  @updatedAt
deletedAt      DateTime?                       // soft delete
createdById    String?                         // actor attribution
```

- **Tenant isolation** — `organizationId` is injected into every query by Prisma
  middleware reading `AsyncLocalStorage`. Not developer-enforced.
- **Soft delete** — `delete()` is rewritten to `update({ deletedAt: now })`; all reads
  filter `deletedAt: null` unless explicitly overridden with restore permission.
- **Money** — `Decimal @db.Decimal(14,2)`. Never floats. Currency stored per row.
- **Indexes** — every foreign key, every `(organizationId, status)` pair used in list
  views, GIN trigram indexes on searchable text, and `@@index([organizationId, deletedAt])`
  on high-volume tables.

---

## 2. Domain Map

```
Organization ──┬── User ──── Role ──── Permission
               │     └────── Team
               │
               ├── Lead ──┬── Activity
               │          ├── Quotation ── QuotationItem
               │          ├── Proposal
               │          └── Contract
               │              │
               │              ▼
               ├── Client ─┬── ClientContact
               │           ├── ClientHealthSnapshot
               │           ├── Subscription ── Renewal
               │           └── Ticket
               │               │
               ├── Project ─┬── Task ──┬── Subtask
               │            │          ├── TaskComment
               │            │          ├── TaskDependency
               │            │          └── TimeLog
               │            ├── Milestone
               │            ├── Sprint
               │            └── ProjectMember
               │
               ├── CreativeBrief ──┬── CreativeSubmission ── Revision
               │                   └── Approval
               │
               ├── Invoice ──┬── InvoiceItem
               │             └── Payment
               ├── Expense · Vendor · PurchaseOrder · Budget
               │
               ├── Employee ─┬── Attendance
               │             ├── Leave ── LeaveBalance
               │             ├── Payroll
               │             ├── PerformanceReview ── Goal ── Kra
               │             └── EmployeeDocument
               ├── JobOpening ── Candidate ── Interview
               │
               ├── Asset ── AssetVersion · AssetFolder
               ├── KnowledgeArticle · DocumentTemplate · PromptTemplate
               ├── SocialPost · Campaign · ContentPillar
               ├── Sop · RecurringTask · Escalation
               │
               ├── AutomationRule ── AutomationRun
               ├── AiAgent ── AiConversation ── AiMessage · AiMemory
               ├── AnalyticsSnapshot · KpiTarget
               ├── Notification · NotificationPreference
               ├── AuditLog · Activity
               └── Integration · Webhook · FileUpload
```

---

## 3. Core Entity Notes

### Organization
Tenant root. Holds branding, locale, currency, fiscal-year start, GST number, working
days/hours, subscription tier and feature flags. Every other row hangs off it.

### User
Employees and clients alike. `userType` distinguishes `EMPLOYEE | CLIENT | AI_AGENT`.
Clients carry a `clientId` that hard-scopes every query they make. AI agents are real
rows so that `AuditLog.actorId` is always a valid foreign key — machine actions are
attributable forever.

### Role & Permission
Roles are per-organisation, with `isSystem` protecting the eleven built-ins from edits.
Permissions are `resource:action` strings joined through `RolePermission`, each carrying
a `scope` of `ALL | TEAM | OWN`. `UserPermission` provides per-user grant/deny overrides
evaluated before role permissions.

### Lead
The CRM spine. Carries source, temperature (`HOT | WARM | COLD`), AI score 0–100,
estimated value, requested services, current pipeline stage, owner, and full timestamp
history per stage transition (used to compute stage velocity). Converting a lead writes
`convertedToClientId` and preserves the entire lead record — the sales history of a
client is never lost.

### Client
Health score is stored denormalised on the row for fast list rendering, with the full
per-signal breakdown in `ClientHealthSnapshot` written nightly. That gives both a fast
badge and an auditable history of *why* a score moved.

### Project & Task
Projects carry `budget`, `internalCost` and a computed `margin` — field-redacted from
most roles. Tasks support self-referencing subtasks, an explicit `TaskDependency` join
for blocking relationships, `position` as a float for cheap drag-reorder, and
`clientVisible` to control what surfaces in the portal.

### Invoice
Line items with per-item GST rate. `subtotal`, `taxAmount`, `total`, `amountPaid` and a
derived `balance`. Indian GST handled as CGST/SGST for intra-state and IGST for
inter-state, decided by comparing the organisation's and client's state codes.

### AuditLog
Append-only. `actorId`, `actorType`, `action`, `entity`, `entityId`, `before`, `after`
(JSONB diffs), `ip`, `userAgent`. Partitioned by month once volume warrants it.

### AnalyticsSnapshot
`(organizationId, metric, dimension, dimensionValue, period, periodStart)` unique.
This one table backs the entire Executive Dashboard, populated by scheduled rollup jobs.

### AiMemory
`embedding` as `vector(1536)` via pgvector, with `importance`, `memoryType` and
`accessCount` for retrieval weighting. Indexed with IVFFlat for cosine similarity.

---

## 4. Key Enumerations

| Enum | Values |
|------|--------|
| `UserType` | `EMPLOYEE` `CLIENT` `AI_AGENT` |
| `LeadSource` | `MANUAL` `WEBSITE` `META` `GOOGLE` `REFERRAL` `WHATSAPP` `IMPORT` `LINKEDIN` `WALK_IN` |
| `LeadStatus` | `NEW` `CONTACTED` `QUALIFIED` `PROPOSAL` `NEGOTIATION` `WON` `LOST` `ON_HOLD` |
| `Temperature` | `HOT` `WARM` `COLD` |
| `ServiceType` | `BRANDING` `SOCIAL_MEDIA` `PERFORMANCE_MARKETING` `META_ADS` `GOOGLE_ADS` `WEBSITE` `VIDEO_EDITING` `GRAPHIC_DESIGN` `AI_CONTENT` `AI_VIDEO` `AUTOMATION` `CONSULTING` |
| `Industry` | `REAL_ESTATE` `HEALTHCARE` `EDUCATION` `AUTOMOBILE` `RETAIL` `PERSONAL_BRAND` `HOSPITALITY` `FINANCE` `TECHNOLOGY` `OTHER` |
| `ProjectStatus` | `PLANNING` `ACTIVE` `ON_HOLD` `REVIEW` `COMPLETED` `CANCELLED` |
| `TaskStatus` | `BACKLOG` `TODO` `IN_PROGRESS` `IN_REVIEW` `CLIENT_REVIEW` `BLOCKED` `DONE` `CANCELLED` |
| `Priority` | `LOW` `MEDIUM` `HIGH` `URGENT` |
| `InvoiceStatus` | `DRAFT` `SENT` `VIEWED` `PARTIAL` `PAID` `OVERDUE` `CANCELLED` `REFUNDED` |
| `CreativeType` | `DESIGN` `VIDEO` `CONTENT` `THUMBNAIL` `COPY` `SCRIPT` `AI_CONTENT` |
| `ApprovalStatus` | `PENDING` `APPROVED` `REJECTED` `CHANGES_REQUESTED` |
| `AttendanceStatus` | `PRESENT` `ABSENT` `LATE` `HALF_DAY` `WFH` `LEAVE` `HOLIDAY` |
| `AgentAutonomy` | `SUGGEST` `ACT_WITH_APPROVAL` `ACT` |

---

## 5. Indexing Strategy

```sql
-- tenant + soft delete on every high-volume table
CREATE INDEX ON "Lead" ("organizationId", "deletedAt");

-- list-view composite indexes
CREATE INDEX ON "Lead"    ("organizationId", "status", "ownerId");
CREATE INDEX ON "Task"    ("organizationId", "status", "assigneeId", "dueDate");
CREATE INDEX ON "Invoice" ("organizationId", "status", "dueDate");

-- global search
CREATE EXTENSION pg_trgm;
CREATE INDEX ON "Lead"   USING GIN ("name" gin_trgm_ops);
CREATE INDEX ON "Client" USING GIN ("name" gin_trgm_ops);

-- analytics
CREATE UNIQUE INDEX ON "AnalyticsSnapshot"
  ("organizationId", "metric", "dimension", "dimensionValue", "period", "periodStart");

-- AI memory similarity
CREATE EXTENSION vector;
CREATE INDEX ON "AiMemory" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
```

---

## 6. Migration Discipline

- Every change ships as a Prisma migration; no manual production DDL.
- Additive-first: add nullable column → backfill → enforce not-null in a later migration.
- Renames are add + copy + drop across three deploys, never a bare `RENAME`.
- Destructive migrations require an explicit reviewed approval and a tested rollback.
- Seed data is idempotent — `prisma/seed.ts` can run repeatedly without duplicating rows.
