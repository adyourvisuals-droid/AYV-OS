# AYV OS — AI Command Center

> AI agents are employees, not features. They have a role, a manager, permissions,
> memory, a workload and a performance record.

---

## 1. Agent Anatomy

```ts
interface AiAgent {
  key:          AgentKey;          // SALES, DESIGN, FINANCE, …
  name:         string;            // "Aria" — agents have names, people talk to them
  role:         RoleId;            // real RBAC role, enforced identically to humans
  model:        ModelPreference;   // primary + fallback provider
  systemPrompt: string;            // versioned, stored in Knowledge module
  tools:        ToolName[];        // subset of the platform API
  memory:       MemoryConfig;      // retention, embedding, scope
  autonomy:     'SUGGEST' | 'ACT_WITH_APPROVAL' | 'ACT';
  costCapDaily: number;            // hard USD ceiling
}
```

**Autonomy levels** — the single most important safety dial:

| Level | Behaviour |
|-------|-----------|
| `SUGGEST` | Produces a recommendation; a human accepts or rejects it |
| `ACT_WITH_APPROVAL` | Prepares the action fully, executes only on approval |
| `ACT` | Executes directly within its permission scope, logged |

New agents start at `SUGGEST`. Promotion to `ACT` happens per-action after a measured
acceptance rate, tracked in the agent's performance record.

---

## 2. The Roster

### Aria — Sales Agent
*Role: Sales Executive + `lead:assign` · Autonomy: ACT_WITH_APPROVAL*

Scores and qualifies inbound leads within seconds of arrival. Drafts first-touch
messages matched to source and service interest. Watches every open deal for silence
and proposes the next action. Writes proposals from the lead brief and the service
catalogue. Predicts close probability from stage, age, engagement and historical
comparables. Prepares pre-meeting briefs — who they are, what they asked for, what
similar clients bought.

**Tools:** `search_leads` `get_lead` `update_lead_score` `create_activity` `draft_message` `generate_proposal` `suggest_next_action` `forecast_deal`

### Nova — Marketing Agent
*Role: Marketing scope · Autonomy: SUGGEST*

Monitors campaign performance across Meta and Google. Diagnoses ROAS decline —
separating creative fatigue from audience saturation from landing-page drop-off.
Generates ad copy variants and hooks. Builds the weekly client performance narrative,
not just the numbers. Watches competitors' public content cadence.

**Tools:** `get_campaign_metrics` `analyse_creative_performance` `generate_ad_copy` `suggest_audience` `build_report` `competitor_scan`

### Kite — Design Agent
*Role: Designer + `asset:create` · Autonomy: SUGGEST*

Turns briefs into design directions and moodboards. Checks submitted work against the
client's brand guidelines and flags deviations before internal review. Suggests
thumbnail and layout variants. Maintains the prompt library for image and video
generation. **Cannot approve its own output** — that permission is withheld deliberately.

**Tools:** `read_brief` `generate_concept` `check_brand_compliance` `suggest_variants` `tag_asset` `search_assets`

### Quill — Copywriter Agent
*Role: Content scope · Autonomy: ACT_WITH_APPROVAL*

Writes captions, scripts, blogs, email sequences and landing copy in each client's
documented tone of voice. Generates the social calendar from the content pillars.
Repurposes one long asset into a full week of short-form content.

**Tools:** `get_client_voice` `generate_content` `generate_calendar` `repurpose_asset` `check_tone`

### Atlas — Project Manager Agent
*Role: Ops Head minus `user:delete` · Autonomy: ACT*

Breaks approved projects into tasks with dependencies and realistic estimates from
historical actuals. Assigns work by skill match and current utilisation. Detects
schedule risk before it becomes delay. Runs the async standup. Reallocates when someone
is overloaded or absent.

**Tools:** `create_project_plan` `estimate_task` `assign_by_capacity` `detect_risk` `rebalance_workload` `run_standup`

### Sage — HR Assistant
*Role: HR read + `candidate:*` · Autonomy: ACT_WITH_APPROVAL*

Screens applicants against the job description with a structured rubric. Drafts JDs and
interview guides. Answers policy questions from the handbook with citations. Assembles
performance review packets from real evidence — task completion, quality ratings, peer
notes. Flags attendance and attrition risk patterns. **Cannot approve leave or run
payroll.**

**Tools:** `screen_candidate` `draft_jd` `answer_policy` `compile_review` `analyse_attendance`

### Ledger — Finance Assistant
*Role: Finance read + `invoice:create` · Autonomy: ACT_WITH_APPROVAL*

Generates invoices with correct GST treatment. Categorises expenses. Reconciles
payments to invoices. Forecasts cash flow 90 days out from committed receivables,
recurring revenue and scheduled costs. Flags margin erosion per project. Prepares the
month-end close pack. **Cannot approve or send payments.**

**Tools:** `generate_invoice` `categorise_expense` `reconcile_payment` `forecast_cashflow` `analyse_margin` `prepare_close`

### Codex — Legal Assistant
*Role: Contract read + `document:create` · Autonomy: SUGGEST*

Drafts contracts, NDAs, SOWs and offer letters from approved templates. Reviews
incoming client paperwork and flags unusual clauses — unlimited revisions, unbounded
liability, IP assignment, payment terms beyond 45 days. Tracks renewal and notice
dates. **Never executes a contract.**

**Tools:** `draft_document` `review_contract` `flag_clauses` `track_obligations`

### Echo — Meeting Assistant
*Role: `activity:*` scoped to attendees · Autonomy: ACT*

Joins, transcribes and summarises. Extracts decisions, action items with owners and
dates, and open questions. Creates the tasks. Circulates minutes within five minutes of
the meeting ending. Only ever has access to meetings it was invited to.

**Tools:** `transcribe` `summarise` `extract_actions` `create_tasks` `send_minutes`

### Halo — Customer Support Agent
*Role: `ticket:*` + client read · Autonomy: ACT_WITH_APPROVAL*

First response on every client ticket, drafted from the knowledge base and that
client's history. Classifies urgency and routes. Escalates anything touching money,
scope or dissatisfaction to a human immediately. **Cannot issue refunds or credits.**

**Tools:** `search_knowledge` `get_client_context` `draft_reply` `classify_ticket` `escalate`

### Vista — CEO Assistant
*Role: Read-all, write-none · Autonomy: SUGGEST*

The one agent with company-wide read access and zero write capability. Produces the
daily executive brief: what changed, what needs attention, what is at risk. Answers
natural-language questions across every module — "what's our real margin on healthcare
clients this quarter?" Detects anomalies against trend. Models scenarios: what happens
to runway if we hire two designers in September.

**Tools:** `query_analytics` `generate_brief` `detect_anomaly` `model_scenario` `compare_period`

---

## 3. Memory

| Type | Store | Retention | Contents |
|------|-------|-----------|----------|
| Working | Redis | 24 h | Active conversation turns |
| Episodic | `AiMemory` + pgvector | 1 year | Past interactions, outcomes, corrections |
| Semantic | Knowledge module, embedded | Permanent | SOPs, brand guides, playbooks, policies |
| Procedural | `AiAgent.systemPrompt` (versioned) | Permanent | How this agent does its job |

**Retrieval** — hybrid search: pgvector cosine similarity for semantic recall, combined
with recency and importance weighting, then reranked. Top-k chunks are injected into
the system prompt under an explicit token budget so context never silently truncates
the instructions.

**Learning loop** — when a human edits or rejects an agent's output, the delta is
captured as a correction memory with high importance. The agent's future outputs
retrieve those corrections first. This is how Quill learns a specific client's tone
without anyone rewriting a prompt.

---

## 4. Orchestration

```
Request → Router → [context assembly] → Provider → [tool loop] → Guardrails → Response
                                            │
                                    fallback chain on failure
```

**Model routing**

| Workload | Primary | Fallback |
|----------|---------|----------|
| Reasoning, analysis, long documents | Claude | OpenAI |
| Fast classification, extraction | OpenAI small | Claude Haiku |
| Embeddings | OpenAI `text-embedding-3-large` | — |
| Multimodal image/video understanding | Gemini | Claude |
| Bulk low-stakes generation | cheapest available | — |

**Tool loop** — the agent proposes a tool call; the orchestrator validates arguments
against the tool schema, checks the agent's RBAC permission for that operation,
executes, and returns the result. Max 10 iterations, then forced summarisation.

**Cost control** — every call records tokens and cost against the agent and the
organisation. Daily caps are enforced before dispatch, not after. Approaching-limit
warnings fire at 80 %.

---

## 5. Guardrails

| Guardrail | Enforcement |
|-----------|-------------|
| Permission check | Every tool call passes through `PermissionsGuard`, same code path as human requests |
| PII redaction | Salary, bank details and personal identifiers stripped before leaving the platform |
| Output validation | Structured outputs validated against schema; malformed output retried once, then failed |
| Grounding | Financial and analytical claims must cite the query that produced them |
| Human gates | Money, contracts, external communication above threshold, and anything irreversible |
| Cost ceiling | Hard daily cap per agent and per organisation |
| Full audit | Prompt, response, tools called, tokens, cost, and outcome persisted |
| Rate limiting | Per-agent concurrency caps prevent runaway loops |

---

## 6. The AI Dock

Present on every page, `⌘J`. Context-aware — it knows what record you are looking at.

```
┌──────────────────────────────────────┐
│  ✦  Ask AYV                     ⌘J   │
├──────────────────────────────────────┤
│  Context: Skyline Realty             │
│                                      │
│  Suggested                           │
│   • Summarise this client's quarter  │
│   • Draft the renewal proposal       │
│   • Why did health drop 12 points?   │
│                                      │
│  ────────────────────────────────    │
│  Ask anything…                    ↵  │
└──────────────────────────────────────┘
```

Answers stream token by token. Any action the assistant proposes appears as an explicit
confirm card — never executed silently. Every AI-generated element in the product
carries the `--ai` purple marker until a human confirms it.

---

## 7. Agent Performance

Agents are reviewed like employees. Tracked per agent:

- **Acceptance rate** — proportion of outputs used without material edit
- **Edit distance** — how much humans change what it produces
- **Time saved** — estimated against the manual baseline for that task
- **Cost per accepted output**
- **Error rate** — failed runs, invalid outputs, rejected actions
- **Escalation rate** — how often it correctly hands off to a human

These feed the AI Command Center dashboard, and they are the evidence base for
promoting an agent from `SUGGEST` to `ACT`.
