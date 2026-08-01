# AYV OS — Roles & Permission Model

---

## 1. Model

Permissions are strings shaped `resource:action` with an optional scope modifier.

```
crm:lead:read:all        every lead in the organisation
crm:lead:read:team       leads owned by anyone in the actor's team
crm:lead:read:own        only leads the actor owns
```

Evaluation order — first match wins:

```
1. Explicit user-level DENY          hard block, nothing overrides
2. Explicit user-level GRANT         individual override
3. Role permission with scope        the normal path
4. Default DENY                      everything not granted is forbidden
```

Scope resolution happens in the data layer, not the controller. A `@Scope('crm:lead')`
decorator makes the repository append the right `WHERE` clause, so `read:own` and
`read:all` hit the same service method and differ only in the generated query.

---

## 2. Resources

| Domain | Resources |
|--------|-----------|
| Core | `org`, `user`, `role`, `team`, `setting`, `audit`, `integration` |
| CRM | `lead`, `pipeline`, `deal`, `quotation`, `proposal`, `contract`, `activity` |
| Clients | `client`, `contact`, `health`, `renewal`, `ticket` |
| Projects | `project`, `task`, `sprint`, `milestone`, `timelog`, `comment` |
| Creative | `queue`, `brief`, `revision`, `approval`, `rating` |
| HRM | `employee`, `attendance`, `leave`, `payroll`, `review`, `candidate`, `document` |
| Finance | `invoice`, `payment`, `expense`, `vendor`, `salary`, `budget`, `pnl` |
| Ops | `sop`, `recurring`, `escalation`, `automation` |
| Content | `asset`, `article`, `template`, `post`, `campaign` |
| AI | `agent`, `conversation`, `memory` |
| Analytics | `dashboard`, `report`, `forecast` |

Actions: `create`, `read`, `update`, `delete`, `approve`, `export`, `assign`, `restore`.

---

## 3. Role Matrix

`A` = all · `T` = team · `O` = own · `—` = none · `R` = read-only

| Resource | Super Admin | CEO | Ops Head | Sales Head | Sales Exec | Creative Head | Designer / Editor | Developer | HR | Finance | Intern | Client |
|----------|:-----------:|:---:|:--------:|:----------:|:----------:|:-------------:|:-----------------:|:---------:|:--:|:-------:|:------:|:------:|
| org / setting | A | R | — | — | — | — | — | — | — | — | — | — |
| user | A | R | R | T | — | T | — | — | A | R | — | — |
| role | A | R | — | — | — | — | — | — | — | — | — | — |
| audit | A | A | T | T | — | — | — | — | — | R | — | — |
| lead | A | A | R | A | O | — | — | — | — | — | — | — |
| deal / quotation | A | A | R | A | O | — | — | — | R | R | — | — |
| contract | A | A | R | A | O | — | — | — | — | R | — | — |
| client | A | A | A | A | T | T | R | R | — | R | — | O |
| health score | A | A | A | T | O | R | — | — | — | — | — | — |
| project | A | A | A | R | R | T | O | O | — | R | O | O |
| task | A | A | A | T | O | T | O | O | — | — | O | R |
| timelog | A | A | A | T | O | T | O | O | R | R | O | — |
| creative queue | A | A | A | R | R | A | O | — | — | — | O | — |
| approval | A | A | A | T | — | A | — | — | — | — | — | O |
| asset | A | A | A | R | R | A | A | R | — | — | R | O |
| employee | A | R | R | — | — | — | — | — | A | R | — | — |
| attendance | A | R | T | T | O | T | O | O | A | — | O | — |
| leave | A | R | T | T | O | T | O | O | A | — | O | — |
| payroll | A | R | — | — | — | — | — | — | A | A | — | — |
| performance | A | A | T | T | O | T | O | O | A | — | O | — |
| candidate | A | R | R | R | — | R | — | — | A | — | — | — |
| invoice | A | A | R | T | O | — | — | — | — | A | — | O |
| payment | A | A | R | R | — | — | — | — | — | A | — | O |
| expense | A | A | T | T | O | T | O | O | O | A | O | — |
| vendor / salary | A | A | — | — | — | — | — | — | R | A | — | — |
| P&L / budget | A | A | R | — | — | — | — | — | — | A | — | — |
| SOP | A | A | A | T | R | T | R | R | A | R | R | — |
| automation | A | A | A | T | — | T | — | — | — | — | — | — |
| social post | A | A | A | R | — | A | O | — | — | — | O | R |
| campaign | A | A | A | A | O | R | — | — | — | R | — | R |
| AI agent | A | A | A | T | O | T | O | O | O | O | O | — |
| dashboard | A | A | A | T | O | T | O | O | T | A | O | O |
| ticket | A | A | A | T | O | T | O | O | — | — | — | O |

### Field-level redaction

Some fields are hidden even when the row is visible:

| Field | Visible to |
|-------|-----------|
| `User.salary`, `Payroll.*` | Super Admin, CEO, HR, Finance |
| `Project.internalCost`, `Project.margin` | Super Admin, CEO, Ops Head, Finance |
| `Lead.commissionAmount` | Super Admin, CEO, Sales Head, owning Sales Exec |
| `Client.internalNotes` | All internal roles; never the Client role |
| `Vendor.contractTerms` | Super Admin, CEO, Finance |

Redaction is applied by a response interceptor keyed on the actor's permissions, so a
field is stripped from the payload rather than merely hidden in the UI.

---

## 4. The Client Role

Clients authenticate into the same system with a hard-scoped role. Their principal
carries a `clientId`, and every query is filtered by it in addition to the tenant
filter. A client sees:

- Their own projects, and only tasks marked `clientVisible`
- Deliverables awaiting their approval
- Their invoices, payments and renewal dates
- Their campaign analytics
- Their tickets and requests
- Shared files in their asset folder

A client never sees: internal costs, margins, team utilisation, internal comments,
other clients, employee data, or anything in the CRM.

---

## 5. Custom Roles

Organisations can clone any system role and adjust its permission set. System roles are
immutable (`isSystem: true`) so an accidental edit cannot lock everyone out. The last
remaining Super Admin cannot be demoted or deleted — enforced in the service layer, not
just the UI.

---

## 6. AI Agent Permissions

Each AI agent runs under a service principal bound to a role.

| Agent | Role binding | Notably cannot |
|-------|-------------|----------------|
| Sales Agent | Sales Exec + `lead:assign` | Approve contracts, view payroll |
| Marketing Agent | Marketing scope | Spend budget without approval |
| Design Agent | Designer + `asset:create` | Approve its own deliverables |
| Copywriter | Content scope | Publish without approval |
| Project Manager | Ops Head minus `user:delete` | Modify payroll or contracts |
| HR Assistant | HR read + `candidate:*` | Approve leave, run payroll |
| Finance Assistant | Finance read + `invoice:create` | Approve or send payments |
| Legal Assistant | Contract read + `document:create` | Execute contracts |
| Meeting Assistant | `activity:*` scoped to attendees | Access unattended meetings |
| Support Agent | `ticket:*` + client read | Issue refunds or credits |
| CEO Assistant | Read-all, write-none | Any mutation whatsoever |

Every agent action writes an `AuditLog` row with `actorType: 'AI_AGENT'`, so the
distinction between human and machine action is permanently preserved.
