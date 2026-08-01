# AYV OS — Delivery Roadmap

---

## Phase 1 — Foundation ✅ *implemented in this repository*

| Area | Delivered |
|------|-----------|
| Infrastructure | pnpm monorepo, Docker Compose (Postgres + Redis), CI pipeline, typed env config |
| Data | Complete Prisma schema covering all modules, seed data, migrations |
| Auth | Registration, login, Argon2id hashing, JWT access + rotating refresh with reuse detection, sessions |
| Tenancy | `AsyncLocalStorage` context + Prisma middleware — automatic `organizationId` scoping |
| RBAC | 12 system roles, permission registry, `@RequirePermission` guard, scope resolution |
| Safety | Soft delete middleware, audit interceptor with before/after diffs, global exception filter |
| CRM | Leads CRUD, pipeline stages, drag-to-move, activities, timeline, scoring, conversion |
| Clients | Accounts, contacts, health scoring engine |
| Projects | Projects, tasks, Kanban with position ordering, comments, time logs |
| Analytics | Snapshot model + executive dashboard endpoint |
| Frontend | Design tokens, UI primitives, app shell, command palette, dark/light, Executive Dashboard, CRM pipeline, projects board, login |

## Phase 2 — Business Operations

- **HRM** — attendance with geo/IP check-in, leave workflow and balances, payroll generation and payslips, performance reviews with KRA/KPI, hiring pipeline, onboarding and exit checklists, skill matrix
- **Finance** — invoicing with Indian GST (CGST/SGST/IGST), payment recording and reconciliation, expense approval tiers, vendor and purchase orders, P&L, cash flow, ageing, budget vs actual
- **Operations** — SOP library, recurring task engine, approval routing, escalation ladder, department health
- **Asset Management** — S3 DAM with pre-signed uploads, versioning, folder tree, tagging, brand kit
- **Document Generator** — PDF templates for proposal, invoice, quotation, agreement, NDA, offer letter, experience letter, salary slip, PO, work order

## Phase 3 — Client Experience & Automation

- **Client Portal** — scoped dashboard, approvals with annotation, invoices and payments, file access, live analytics, tickets, meeting booking
- **Automation Engine** — visual rule builder, all trigger classes, condition groups, full action library, dry-run simulation, run history, kill switches
- **Knowledge Base** — wiki with permissions, brand guidelines, sales scripts, proposal templates, contract library, HR policies, prompt library
- **Social Media** — content calendar, multi-platform scheduling and publishing, approval flow, performance sync, competitor tracking, hashtag and idea bank
- **Notifications** — email, WhatsApp Cloud API, web push, in-app, digests, quiet hours, per-channel preferences
- **Integrations** — Meta Lead Ads, Google Ads, GA4, Razorpay/Stripe, Google Drive, Google Calendar, WhatsApp

## Phase 4 — AI Native

- **Agent runtime** — orchestrator, provider routing with fallback, tool registry bound to RBAC, cost caps, streaming
- **Memory** — pgvector store, hybrid retrieval, correction-based learning loop
- **The eleven agents** — Aria, Nova, Kite, Quill, Atlas, Sage, Ledger, Codex, Echo, Halo, Vista
- **Predictive analytics** — revenue forecasting, churn prediction, deal close probability, resource demand
- **AI Command Center** — agent monitoring, approval queue, performance metrics, autonomy promotion
- **Voice** — voice commands and meeting capture

## Phase 5 — Scale

Mobile apps (React Native), white-label multi-agency mode, public API with developer
keys, marketplace for automation templates, advanced BI with custom query builder,
SOC 2 readiness.

---

## Definition of Done

A module is not complete until:

1. Prisma models, migrations and seed data exist
2. Service layer has unit tests covering the business rules
3. Controllers have e2e tests covering the happy path and every permission boundary
4. Every endpoint is documented in OpenAPI with examples
5. Permissions are registered and enforced for all twelve roles
6. Audit logging is verified on every mutation
7. Soft delete and restore both work
8. Frontend renders loading, empty, error and populated states
9. Responsive from 375 px to 2560 px
10. Dark and light themes verified
11. Keyboard navigation works end to end
12. Module documentation is written in `docs/modules/`
