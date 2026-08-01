# AYV OS — UX & Wireframes

---

## 1. Application Shell

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ░░ glass top bar ░░                                                           │
│  ☰  AYV OS          ⌘K  Search or ask AI…              🔔3   ✦   ◐   PN ▾    │
├──────────────┬────────────────────────────────────────────────────────────────┤
│              │                                                                │
│  ⌂ Dashboard │   Page Header ───────────────────────────────────────────────  │
│              │   Title                              [Filter] [View] [+ New]   │
│  ─ SALES     │                                                                │
│  ◈ Leads  12 │   ┌──────────────────────────────────────────────────────┐    │
│  ◉ Pipeline  │   │                                                      │    │
│  ⬡ Deals     │   │              Content region                          │    │
│              │   │                                                      │    │
│  ─ DELIVERY  │   │                                                      │    │
│  ▤ Projects  │   │                                                      │    │
│  ✓ Tasks   8 │   │                                                      │    │
│  ◫ Creative  │   │                                                      │    │
│  ◷ Approvals │   └──────────────────────────────────────────────────────┘    │
│              │                                                                │
│  ─ CLIENTS   │                                                                │
│  ☺ Clients   │                                                                │
│  ⌾ Health    │                                                                │
│              │                                                                │
│  ─ BUSINESS  │                                                                │
│  ₹ Finance   │                                                                │
│  ⊞ HR        │                                                                │
│  ◎ Marketing │                                                                │
│              │                                                                │
│  ─ SYSTEM    │                                                                │
│  ✦ AI Center │                                                                │
│  ⚙ Settings  │                                                                │
│              │                                                                │
│  ─────────── │                                                                │
│  PN Priya N. │                                                                │
│     Sales    │                                                                │
└──────────────┴────────────────────────────────────────────────────────────────┘
```

- Sidebar collapses to 64 px icon rail (`⌘B`); state persists per user.
- Navigation is filtered by permission — a Designer never sees Finance at all.
- Badge counts are live over WebSocket.
- Below `md`, the sidebar becomes a bottom tab bar with the five most-used sections.

---

## 2. Executive Dashboard

The 60-second business understanding. Everything above the fold answers "is the company
healthy today?"

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Good morning, Rahul                          Today · 31 Jul      [This Month ▾]│
│                                                                                │
│  ┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐             │
│  │ REVENUE MTD  ││ PROFIT       ││ CASH IN BANK ││ PIPELINE     │             │
│  │ ₹18,42,000   ││ ₹6,20,400    ││ ₹24,10,000   ││ ₹47,50,000   │             │
│  │ ▲ 23% ▁▃▅▆█  ││ 33.7% margin ││ 4.2mo runway ││ 34 open deals│             │
│  └──────────────┘└──────────────┘└──────────────┘└──────────────┘             │
│                                                                                │
│  ┌────────────────────────────────────┐┌────────────────────────────────────┐ │
│  │ REVENUE TREND            12 months ││ ✦ AI BRIEF                         │ │
│  │                              ▄█    ││                                    │ │
│  │                       ▄▆█ ▆█ ██    ││ ⚠ Skyline Realty health fell to 52 │ │
│  │              ▃▅▆ ▅▆█ ███ ██ ██    ││   3 approvals pending over 5 days  │ │
│  │      ▂▃▄ ▃▄▅ ███ ███ ███ ██ ██    ││                                    │ │
│  │  MRR ₹14.2L      ARR ₹1.70Cr      ││ ⚠ ₹4,80,000 overdue across 6       │ │
│  └────────────────────────────────────┘│   invoices, oldest 38 days         │ │
│                                        ││                                    │ │
│  ┌────────────────────────────────────┐│ ↑ Meta leads converting at 31%     │ │
│  │ SALES FUNNEL                       ││   vs 18% Google — shift budget?    │ │
│  │ New        ████████████████  142   ││                                    │ │
│  │ Contacted  ███████████        98   ││ ✓ 3 renewals due in 30 days,       │ │
│  │ Qualified  ███████            61   ││   ₹6,40,000 combined ARR           │ │
│  │ Proposal   ████               34   ││                                    │ │
│  │ Negotiate  ██                 19   ││        [ Ask a follow-up → ]       │ │
│  │ Won        █                  12   │└────────────────────────────────────┘ │
│  │            8.5% conversion         │                                       │
│  └────────────────────────────────────┘                                       │
│                                                                                │
│  ┌──────────────────┐┌──────────────────┐┌──────────────────┐                 │
│  │ CLIENT HEALTH    ││ TEAM PRODUCTIVITY││ RISK ALERTS    4 │                 │
│  │ ●●●●●●●●○○  8/10 ││ Utilisation  78% ││ ● 2 projects     │                 │
│  │ healthy          ││ On-time      91% ││   at deadline    │                 │
│  │ 2 at risk        ││ Tasks/day    4.2 ││ ● 1 client churn │                 │
│  │ [view →]         ││ [view →]         ││ ● 1 cash flow    │                 │
│  └──────────────────┘└──────────────────┘└──────────────────┘                 │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Role-adaptive:** the same route renders a different composition per role. A Sales Head
sees pipeline, targets and leaderboard in the hero slots. A Designer sees their queue,
today's deliverables and pending revisions. The layout engine picks widgets by
permission and role preference.

---

## 3. CRM — Pipeline

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Pipeline                    [Kanban] [Table] [Calendar]   [Filters ▾] [+ Lead]│
│  Total ₹47,50,000 · 34 deals · avg age 12d · forecast ₹18,20,000              │
├───────────┬───────────┬───────────┬───────────┬───────────┬───────────────────┤
│ NEW       │ CONTACTED │ QUALIFIED │ PROPOSAL  │ NEGOTIATE │ WON               │
│ 12·₹8.4L  │ 8·₹11.2L  │ 6·₹14.0L  │ 4·₹9.8L   │ 3·₹4.1L   │ 1·₹2.5L           │
├───────────┼───────────┼───────────┼───────────┼───────────┼───────────────────┤
│┌─────────┐│┌─────────┐│┌─────────┐│┌─────────┐│┌─────────┐│┌─────────┐        │
││🔥 HOT   │││ WARM    │││🔥 HOT   │││ WARM    │││🔥 HOT   │││ ✓ WON   │        │
││Skyline  │││Meridian │││Aster    │││Vertex   │││Nova Auto│││Bloom Ed │        │
││Realty   │││Health   │││Motors   │││Retail   │││         │││         │        │
││₹2,40,000│││₹1,80,000│││₹4,50,000│││₹3,20,000│││₹1,60,000│││₹2,50,000│        │
││Branding │││SMM+Ads  │││Full     │││Website  │││Meta Ads │││Branding │        │
││         │││         │││         │││         │││         │││         │        │
││PN  ⏱2d  │││AK  ⏱5d  │││PN  ⏱1d  │││SM ⏱12d  │││AK  ⏱3d  │││PN       │        │
││●●●●○ 82 │││●●●○○ 58 │││●●●●● 91 │││●●●○○ 64 │││●●●●○ 77 │││         │        │
│└─────────┘│└─────────┘│└─────────┘│└─────────┘│└─────────┘│└─────────┘        │
│┌─────────┐│┌─────────┐│           │           │           │                   │
││ COLD    │││🔥 HOT   ││           │           │           │                   │
││…        │││…        ││           │           │           │                   │
└───────────┴───────────┴───────────┴───────────┴───────────┴───────────────────┘
```

Card shows: temperature, name, value, service, owner avatar, days in stage, AI score.
Drag between columns triggers `deal.stage_changed`, which fires the relevant
automations. Dropping into `WON` opens the conversion sheet (A06).

### Lead detail — three-pane

```
┌────────────────┬──────────────────────────────┬──────────────────────────────┐
│ Skyline Realty │  TIMELINE   Notes  Files  ⚙  │  ✦ AI INSIGHTS               │
│ 🔥 HOT   82    │                              │                              │
│                │  ● Today 11:20               │  Close probability      78%  │
│ ₹2,40,000      │    Proposal viewed 3×        │  Expected close    12 Aug    │
│ Branding       │                              │                              │
│ Real Estate    │  ● Yesterday 16:45           │  Next best action:           │
│                │    Proposal sent  📎         │  Call now — they opened the  │
│ Owner   PN     │    by Priya Nair             │  proposal 3× in 40 minutes,  │
│ Source  Meta   │                              │  which historically precedes │
│ Age     12d    │  ● 28 Jul 14:00              │  a close within 4 days.      │
│                │    Discovery meeting  45m    │                              │
│ ─────────────  │    Summary: needs rebrand +  │  Risk: no decision-maker has │
│ Rajesh Kumar   │    launch campaign by Sept   │  been identified yet.        │
│ 📞 +91 98…     │    → 3 action items created  │                              │
│ ✉ rajesh@…     │                              │  [ Draft follow-up ]         │
│                │  ● 19 Jul 10:12              │  [ Generate quotation ]      │
│ [Call][WA][✉]  │    Lead captured · Meta Ads  │                              │
└────────────────┴──────────────────────────────┴──────────────────────────────┘
```

---

## 4. Projects

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Skyline Realty — Q3 Brand Campaign          [Board][List][Timeline][Calendar]│
│  ●───────────●───────────●───────────○───────────○      62%   Due 15 Aug (15d)│
│  Brief    Design    Review    Client    Deliver                                │
│  Team  PN AK SM +2      Budget ₹2,40,000 · spent ₹1,48,000 · margin 38%       │
├───────────┬───────────┬───────────┬───────────┬───────────────────────────────┤
│ BACKLOG 6 │ TODO    4 │ DOING   3 │ REVIEW  2 │ DONE                       14 │
├───────────┼───────────┼───────────┼───────────┼───────────────────────────────┤
│┌─────────┐│┌─────────┐│┌─────────┐│┌─────────┐│┌─────────┐                    │
││Brand    │││Logo     │││Social   │││Brochure │││Discovery│                    │
││guideline│││variants │││templates│││design   │││workshop │                    │
││         │││         │││         │││         │││         │                    │
││🔴 High  │││🟡 Med   │││🔴 High  │││🟡 Med   │││✓        │                    │
││AK  2 Aug│││SM  4 Aug│││AK  1 Aug│││SM  3 Aug│││PN       │                    │
││◷ 8h     │││◷ 6h     │││⚠ overdue│││👁 client│││         │                    │
│└─────────┘│└─────────┘│└─────────┘│└─────────┘│└─────────┘                    │
└───────────┴───────────┴───────────┴───────────┴───────────────────────────────┘
```

Task card: title, priority dot, assignee, due date, estimate, and badges for overdue,
blocked, client-visible and awaiting-approval.

---

## 5. Creative Production Queue

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Creative Production        [Design][Video][Content][Thumbnails][Scripts][AI]  │
│  Queue 18 · In progress 7 · Awaiting review 4 · Avg turnaround 2.3d           │
├───────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │ ▣  Instagram carousel — 5 slides            Skyline Realty      🔴 HIGH│   │
│  │    Brief: Launch teaser, brand colours, CTA to landing page           │   │
│  │    AK  Ananya Kapoor        Due today 18:00        Rev 1/3            │   │
│  │    ●───────●───────○───────○      [ Open brief ]  [ Upload work ]     │   │
│  │    Brief  Design  Internal  Client                                    │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │ ▶  Reel edit — 30s                          Nova Automotive     🟡 MED│   │
│  │    SM  Sameer Mehta         Due 2 Aug             Rev 2/3   ⚠ 1 late  │   │
│  │    ●───────●───────●───────○      [ Open ]  [ View revisions ]        │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Creative review — annotated approval

```
┌──────────────────────────────────────────┬────────────────────────────────────┐
│                                          │  REVIEW                       v3 ▾ │
│         [ creative preview ]             │                                    │
│                                          │  ┌──────────────────────────────┐  │
│              ①                           │  │ ① Priya Nair          11:20  │  │
│                          ②               │  │   Logo needs 20% more         │  │
│                                          │  │   breathing room from edge    │  │
│                                          │  └──────────────────────────────┘  │
│                                          │  ┌──────────────────────────────┐  │
│                                          │  │ ② Rajesh (Client)     14:02  │  │
│                                          │  │   Can we try the darker blue? │  │
│                                          │  └──────────────────────────────┘  │
│  ◀ v1   v2   ●v3                         │                                    │
│                                          │  [ ✓ Approve ]  [ ↻ Request rev ] │
└──────────────────────────────────────────┴────────────────────────────────────┘
```

Click anywhere on the creative to drop a numbered pin. Version history is a filmstrip;
any two versions can be compared side by side.

---

## 6. Client Portal

Deliberately calmer than the internal app — fewer numbers, more reassurance.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  ░░ Skyline Realty  ·  powered by Ad Your Vision ░░              Rajesh K.  ▾  │
├───────────────────────────────────────────────────────────────────────────────┤
│  Welcome back, Rajesh                                                          │
│                                                                                │
│  ┌─────────────────────────────────┐  ┌──────────────────────────────────────┐│
│  │ ⚠ 2 items need your approval    │  │ YOUR PROJECTS                        ││
│  │                                 │  │                                      ││
│  │ Instagram carousel — 5 slides   │  │ Q3 Brand Campaign      ████████░░ 62%││
│  │ submitted 2 hours ago           │  │ Due 15 Aug · on track                ││
│  │ [ Review now → ]                │  │                                      ││
│  │                                 │  │ Website Revamp         ███░░░░░░░ 28%││
│  │ Brochure design v2              │  │ Due 30 Sep · on track                ││
│  │ submitted yesterday             │  │                                      ││
│  │ [ Review now → ]                │  │ [ View all → ]                       ││
│  └─────────────────────────────────┘  └──────────────────────────────────────┘│
│                                                                                │
│  ┌─────────────────────────────────┐  ┌──────────────────────────────────────┐│
│  │ THIS MONTH'S PERFORMANCE        │  │ BILLING                              ││
│  │ Reach        2,84,000  ▲ 34%    │  │ Next invoice   ₹80,000 · 5 Aug       ││
│  │ Engagement      18,400  ▲ 22%   │  │ Outstanding    ₹0  ✓ all clear       ││
│  │ Leads              142  ▲ 51%   │  │ Renewal        12 Dec 2026           ││
│  │ Cost per lead     ₹284  ▼ 18%   │  │ [ View invoices → ]                  ││
│  │ [ Full report → ]               │  │                                      ││
│  └─────────────────────────────────┘  └──────────────────────────────────────┘│
│                                                                                │
│  [ 📁 Files ]  [ 💬 Messages ]  [ 🎫 Raise a request ]  [ 📅 Book a meeting ] │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Finance

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Finance          [Overview][Invoices][Expenses][Payroll][Vendors][Reports]    │
│                                                                    [This FY ▾] │
│  ┌───────────┐┌───────────┐┌───────────┐┌───────────┐┌───────────┐            │
│  │ REVENUE   ││ EXPENSES  ││ PROFIT    ││ RECEIVABLE││ GST DUE   │            │
│  │₹1,84,20,000││₹1,22,10,000││₹62,10,000││ ₹18,40,000││ ₹3,31,560 │            │
│  │ ▲ 28%     ││ ▲ 19%     ││ 33.7%     ││ 6 overdue ││ due 20 Aug│            │
│  └───────────┘└───────────┘└───────────┘└───────────┘└───────────┘            │
│                                                                                │
│  ┌──────────────────────────────────────┐┌──────────────────────────────────┐ │
│  │ CASH FLOW                90-day fcst ││ AGEING                           │ │
│  │      in ▁▃▅▆█▆▅▃▁                    ││ Current  ████████████  ₹9,20,000 │ │
│  │     out ▂▃▄▄▅▄▄▃▂                    ││ 1–30 d   ██████        ₹4,80,000 │ │
│  │     net ────────────  ▲ positive     ││ 31–60 d  ███           ₹2,60,000 │ │
│  │  Runway 4.2 months                   ││ 60+ d    ██            ₹1,80,000 │ │
│  └──────────────────────────────────────┘└──────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. AI Command Center

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  AI Command Center                            Today: 1,284 actions · $18.40    │
├───────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐┌──────────────────────┐┌──────────────────────┐    │
│  │ ✦ Aria — Sales       ││ ✦ Atlas — Projects   ││ ✦ Ledger — Finance   │    │
│  │ ● Active             ││ ● Active             ││ ● Active             │    │
│  │ 142 leads scored     ││ 38 tasks assigned    ││ 24 invoices generated│    │
│  │ 28 messages drafted  ││ 4 risks detected     ││ 3 anomalies flagged  │    │
│  │ Accepted        89%  ││ Accepted        94%  ││ Accepted        97%  │    │
│  │ ACT_WITH_APPROVAL    ││ ACT                  ││ ACT_WITH_APPROVAL    │    │
│  │ [ Configure ] [ Log ]││ [ Configure ] [ Log ]││ [ Configure ] [ Log ]│    │
│  └──────────────────────┘└──────────────────────┘└──────────────────────┘    │
│                                                                                │
│  PENDING APPROVALS                                                     3       │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │ ✦ Aria drafted a proposal for Meridian Health          ₹1,80,000      │   │
│  │   [ Preview ]  [ ✓ Approve & send ]  [ ✎ Edit ]  [ ✕ Reject ]        │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Key Interaction Patterns

| Pattern | Rule |
|---------|------|
| **Optimistic updates** | Drag, check, assign apply instantly; roll back with a toast on failure |
| **Inline editing** | Click a field, edit, blur to save. No modal for a single-field change |
| **Sheets over modals** | Detail views slide in from the right and keep the list context visible |
| **Bulk actions** | Select rows → floating action bar appears at the bottom |
| **Saved views** | Any filter combination can be saved, named, pinned and shared with a team |
| **Empty states** | Never a blank page. Explain the concept and offer the first action |
| **Skeletons** | Layout-accurate skeletons, never spinners, for content loading |
| **Undo** | Destructive actions show a 10-second undo toast instead of a confirm dialog |
| **AI marking** | Anything machine-generated carries the purple `✦` until a human confirms it |
