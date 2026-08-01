# AYV OS

Operations platform for AdYourVisuals. Built as a multi-module system — the
**CRM** is the first fully-built module, with room for future modules
(Projects, Finance, …) to register alongside it without touching the shell.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Prisma 7** ORM on **PostgreSQL**, via the `@prisma/adapter-pg` driver adapter
- **Auth.js (NextAuth v5)**, credentials provider, JWT sessions
- **Tailwind CSS v4** + **shadcn/ui** (Base UI primitives, not Radix — see note below)

> This checkout pins newer major versions than most training data reflects
> (Next 16, Prisma 7, a Base-UI-backed shadcn/ui). Breaking changes exist
> everywhere: Prisma's driver-adapter + `prisma.config.ts` workflow, Next's
> `proxy.ts` (renamed from `middleware.ts`) and async `params`/`searchParams`,
> and shadcn/ui components built on `@base-ui/react` (`render` prop instead
> of Radix's `asChild`). Read `node_modules/next/dist/docs` and the
> `.agents/skills/prisma-*` guides before assuming familiar APIs still apply.

## Architecture

### Multi-tenancy

Every domain row is scoped by `organizationId`. A user can belong to more
than one `Organization` via `Membership` (role: `OWNER` / `ADMIN` /
`MEMBER`). The active organization is tracked in an `ayvos_org` cookie and
resolved server-side by `getActiveOrg()` (`src/lib/session.ts`), which every
page, Server Action, and API route calls first — there is no query in this
codebase that isn't scoped through it.

### Module convention

```
src/modules/<module>/
  <entity>/
    service.ts   — Prisma queries, org-scoped, framework-agnostic
    actions.ts   — "use server" wrappers around service.ts for forms
    *-form.tsx   — client form components
  nav.tsx        — registers the module's sidebar nav via registerModule()

src/app/(dashboard)/<module>/...   — routes (pages only, no business logic)
src/app/api/<module>/...           — REST API wrapping the same service layer
```

Adding a new module means: define its Prisma models, add a `service.ts` per
entity, register its nav in a `nav.tsx`, and import that file (side-effect
import) from `src/lib/modules.ts`. The dashboard shell
(`src/app/(dashboard)/layout.tsx`) renders navigation purely from the
registry — it has no CRM-specific code.

### Data layer

`prisma/schema.prisma` holds the full schema. Notably, **Notes, Tasks,
Meetings, Calls, Follow-ups, Email Timeline, and WhatsApp Timeline** are one
`Activity` model with a `type` discriminator and optional type-specific
columns (`dueDate`, `duration`, `outcome`, `direction`, …), each activity
optionally linking to a Lead, Deal, Contact, and/or Company. This mirrors
how HubSpot/Salesforce model activities and avoids seven near-identical
tables — the module-level pages (`/crm/tasks`, `/crm/calls`, …) are the same
`ActivityModulePage` component filtered by `type`; the record-level timeline
on Lead/Deal/Contact/Company pages is the same data unfiltered.

### Automation & scoring engines

- **Lead Scoring** (`src/modules/crm/leads/scoring.ts`): `LeadScoringRule`
  rows (field/operator/value/points) are summed into `Lead.score` whenever a
  lead is created or updated.
- **Automation Rules** (`src/modules/crm/automations/engine.ts`):
  `AutomationRule` rows fire on `LEAD_CREATED`, `LEAD_STATUS_CHANGED`,
  `DEAL_CREATED`, and `DEAL_STAGE_CHANGED`. Conditions are evaluated against
  the entity's current fields; matching rules run their actions (assign
  owner, change status, create a task/follow-up, adjust score, move
  pipeline stage) and log the result to `AutomationRunLog`.

## Getting started

```bash
npm install
cp .env.example .env   # or edit .env directly — see below
npx prisma migrate dev
npx prisma db seed
npm run dev
```

`.env` needs:

```
DATABASE_URL="postgresql://user:password@localhost:5432/ayvos_dev?schema=public"
AUTH_SECRET="<random string>"
NEXTAUTH_URL="http://localhost:3000"
```

The seed script creates the `AdYourVisuals` organization with sample
companies, contacts, leads, deals, activities, proposals/quotations/
contracts, and automation rules. Sign in with:

```
adyourvisuals@gmail.com / password123
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — typecheck
- `npx prisma studio` — browse the database
- `npx prisma migrate dev --name <name>` — create + apply a migration
- `npx prisma db seed` — run `prisma/seed.ts`

## CRM feature map

| Feature | Where |
|---|---|
| Lead Management + Lead Scoring | `/crm/leads`, `/crm/lead-scoring` |
| Deal Pipeline (Kanban, drag-and-drop) | `/crm/deals` |
| Contacts / Companies | `/crm/contacts`, `/crm/companies` |
| Tasks / Notes / Meetings / Calls / Follow-ups | `/crm/tasks`, `/crm/notes`, `/crm/meetings`, `/crm/calls`, `/crm/follow-ups` |
| Email & WhatsApp Timelines | `/crm/emails`, `/crm/whatsapp` |
| Proposal Generator / Quotations / Contracts | `/crm/proposals`, `/crm/quotations`, `/crm/contracts` |
| Automation Rules | `/crm/automations` |
| Sales Dashboard | `/crm` |
