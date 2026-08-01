# AYV OS — Design System

> Luxury · Minimal · Modern. The reference points are Linear's density, Stripe's
> clarity, Notion's calm, Arc's softness and Apple's restraint.

---

## 1. Design Principles

1. **Information density without noise.** An agency operator scans a screen in three
   seconds. Show the number, the trend and the exception — nothing decorative.
2. **One accent, used sparingly.** Colour carries meaning. If everything is highlighted,
   nothing is.
3. **Depth through light, not lines.** Soft shadows and translucency separate layers;
   borders are a last resort.
4. **Motion explains causality.** Animation shows where a thing came from and where it
   went. Never longer than 300 ms.
5. **Keyboard is the primary interface.** Every action reachable without a mouse.

---

## 2. Colour

Semantic tokens map to raw palette values per theme. Components only ever reference
semantic tokens.

### Brand

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--brand-50` | `#EEF2FF` | `#1E1B4B` | Subtle backgrounds |
| `--brand-100` | `#E0E7FF` | `#312E81` | Hover on subtle |
| `--brand-500` | `#6366F1` | `#818CF8` | **Primary accent** |
| `--brand-600` | `#4F46E5` | `#6366F1` | Primary hover |
| `--brand-700` | `#4338CA` | `#4F46E5` | Primary active |

### Surfaces

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--bg-canvas` | `#FAFAFA` | `#0A0A0B` | App background |
| `--bg-surface` | `#FFFFFF` | `#141416` | Cards, panels |
| `--bg-raised` | `#FFFFFF` | `#1C1C1F` | Modals, popovers |
| `--bg-sunken` | `#F4F4F5` | `#09090B` | Wells, code blocks |
| `--bg-glass` | `rgba(255,255,255,.72)` | `rgba(20,20,22,.72)` | Glassmorphic bars |

### Text

| Token | Light | Dark |
|-------|-------|------|
| `--text-primary` | `#09090B` | `#FAFAFA` |
| `--text-secondary` | `#52525B` | `#A1A1AA` |
| `--text-tertiary` | `#A1A1AA` | `#71717A` |
| `--text-inverse` | `#FFFFFF` | `#09090B` |

### Semantic status

| Token | Light | Dark | Meaning |
|-------|-------|------|---------|
| `--success` | `#16A34A` | `#22C55E` | Won, paid, approved, healthy |
| `--warning` | `#D97706` | `#F59E0B` | Due soon, at risk, pending |
| `--danger` | `#DC2626` | `#EF4444` | Overdue, lost, blocked, critical |
| `--info` | `#0891B2` | `#06B6D4` | Neutral system information |
| `--ai` | `#9333EA` | `#A855F7` | **AI-generated or AI-suggested content** |

The AI purple is a load-bearing convention: anywhere it appears, a machine produced the
content and a human has not yet confirmed it.

### Client health scale

`0–39` danger · `40–59` warning · `60–79` info · `80–100` success

---

## 3. Typography

**Sans:** Inter Variable · **Mono:** JetBrains Mono · **Display:** Inter Display (600–700)

| Token | Size / Line | Weight | Tracking | Use |
|-------|-------------|--------|----------|-----|
| `display-lg` | 48 / 56 | 700 | −0.03em | Hero KPI numbers |
| `display-sm` | 32 / 40 | 700 | −0.02em | Dashboard metrics |
| `heading-lg` | 24 / 32 | 600 | −0.02em | Page titles |
| `heading-md` | 18 / 26 | 600 | −0.01em | Section headers |
| `heading-sm` | 15 / 22 | 600 | −0.01em | Card titles |
| `body-md` | 14 / 21 | 400 | 0 | **Default UI text** |
| `body-sm` | 13 / 19 | 400 | 0 | Secondary text |
| `caption` | 12 / 16 | 500 | 0.01em | Labels, metadata |
| `overline` | 11 / 14 | 600 | 0.08em | Uppercase section labels |
| `mono` | 13 / 20 | 450 | 0 | IDs, code, amounts |

Numerals use `font-variant-numeric: tabular-nums` in every table and metric so digits
align vertically across rows.

---

## 4. Spacing, Radius, Elevation

**Spacing** — 4 px base: `0.5→2px  1→4  2→8  3→12  4→16  5→20  6→24  8→32  10→40  12→48  16→64`

**Radius** — `sm 6px · md 8px · lg 12px · xl 16px · 2xl 20px · full 9999px`
Cards use `lg`. Modals use `xl`. Buttons and inputs use `md`.

**Elevation**

| Token | Value | Use |
|-------|-------|-----|
| `shadow-xs` | `0 1px 2px rgba(0,0,0,.04)` | Subtle separation |
| `shadow-sm` | `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)` | Cards at rest |
| `shadow-md` | `0 4px 12px rgba(0,0,0,.08)` | Card hover, dropdowns |
| `shadow-lg` | `0 12px 32px rgba(0,0,0,.12)` | Modals, command palette |
| `shadow-glow` | `0 0 0 3px rgba(99,102,241,.12)` | Focus ring |

In dark mode shadow alphas roughly double, since shadow reads as depth only against
sufficient contrast.

**Glassmorphism** — reserved for the top bar, command palette and floating AI dock:
`background: var(--bg-glass); backdrop-filter: blur(16px) saturate(180%); border: 1px solid rgba(255,255,255,.08)`

---

## 5. Motion

| Token | Duration | Easing | Use |
|-------|----------|--------|-----|
| `instant` | 100 ms | `ease-out` | Hover, focus |
| `fast` | 150 ms | `cubic-bezier(.16,1,.3,1)` | Dropdowns, tooltips |
| `base` | 200 ms | `cubic-bezier(.16,1,.3,1)` | Modals, drawers, page transitions |
| `slow` | 300 ms | `cubic-bezier(.16,1,.3,1)` | Complex layout shifts |
| `spring` | — | `{ type:'spring', stiffness:400, damping:30 }` | Drag, reorder, Kanban |

All motion is wrapped in `prefers-reduced-motion` guards that collapse duration to 0.

---

## 6. Component Inventory

### Primitives
Button (primary · secondary · ghost · danger · ai) · Input · Textarea · Select ·
Combobox · Checkbox · Radio · Switch · Slider · DatePicker · DateRangePicker ·
FileUpload · Avatar · AvatarGroup · Badge · Tag · Tooltip · Popover · Dropdown ·
ContextMenu · Dialog · Sheet · Drawer · Tabs · Accordion · Separator · Skeleton ·
Spinner · Progress · Toast · EmptyState · Breadcrumb · Pagination · Kbd

### Data display
DataTable — sorting, filtering, column visibility, row selection, virtualised, saved
views · KanbanBoard — drag-drop, swimlanes, WIP limits · Timeline · GanttChart ·
Calendar — month/week/day/agenda · MetricCard · TrendChart · FunnelChart ·
HeatMap · ActivityFeed · CommentThread · FilePreview · HealthGauge

### Domain components
`<LeadCard>` `<DealPipeline>` `<ClientHealthBadge>` `<ProjectProgressRing>`
`<TaskItem>` `<ApprovalCard>` `<InvoiceStatusBadge>` `<AttendanceGrid>`
`<CreativeQueueCard>` `<AiSuggestionCard>` `<AutomationBuilder>` `<RevenueWidget>`

### Layout
AppShell · Sidebar (collapsible, pinnable) · TopBar (glass) · PageHeader ·
SplitView · CommandPalette · AiDock · NotificationCenter

---

## 7. Command Palette

`⌘K` / `Ctrl+K` opens the single most important interaction in the product.

```
┌────────────────────────────────────────────────┐
│  ⌘  Search or type a command…                  │
├────────────────────────────────────────────────┤
│  RECENT                                        │
│   📁  Skyline Realty — Q3 Campaign             │
│   👤  Priya Nair                               │
├────────────────────────────────────────────────┤
│  CREATE                                        │
│   +  New Lead                            ⌘⇧L   │
│   +  New Task                            ⌘⇧T   │
│   +  New Invoice                         ⌘⇧I   │
├────────────────────────────────────────────────┤
│  ASK AI                                        │
│   ✦  "Which clients are at risk this month?"   │
└────────────────────────────────────────────────┘
```

Modes are entered by prefix: `>` commands · `@` people · `#` projects ·
`/` navigation · `?` ask AI. Anything not matching a prefix runs global search.

### Global shortcuts

| Key | Action |
|-----|--------|
| `⌘K` | Command palette |
| `⌘/` | Shortcut cheatsheet |
| `⌘B` | Toggle sidebar |
| `⌘J` | Toggle AI dock |
| `⌘⇧D` | Dashboard |
| `⌘⇧L` | New lead |
| `⌘⇧T` | New task |
| `G` then `P` | Go to projects |
| `G` then `C` | Go to clients |
| `G` then `I` | Go to invoices |
| `Esc` | Close top layer |

---

## 8. Accessibility

- WCAG 2.1 AA contrast on all text and interactive elements
- Every interactive element reachable and operable by keyboard
- Visible focus ring (`shadow-glow`), never `outline: none` without replacement
- ARIA labels on all icon-only controls
- Live regions for toasts and async status
- Colour never the sole carrier of meaning — status always pairs with icon or text
- Full support for `prefers-reduced-motion` and `prefers-color-scheme`

---

## 9. Responsive Breakpoints

| Name | Width | Layout |
|------|-------|--------|
| `sm` | ≥640 | Single column, bottom tab bar, sheets replace modals |
| `md` | ≥768 | Two column, collapsible sidebar |
| `lg` | ≥1024 | Persistent sidebar, standard desktop |
| `xl` | ≥1280 | Sidebar + content + contextual right rail |
| `2xl` | ≥1536 | Max content width 1440 px, centred |

Tables collapse to card lists below `md`. Kanban becomes a horizontally scrolling
single-column-at-a-time view on mobile.
