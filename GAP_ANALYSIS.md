# Architecture & Business Workflow Gap Analysis

Date: 06 Aug 2026. Status: **review only — no code, schema, or migration changes accompany
this document.** Every finding below is grounded in direct inspection of the current
codebase (`prisma/schema.prisma`, `src/lib/actions/*`, `src/lib/queries/*`, the page/layout
gates), not assumption — where something is described as "not modeled," that was confirmed
by checking for the relevant Prisma model, enum, or query and finding none.

Primary lens: **OceanForge Naval Systems** — large defense manufacturing, multi-location,
multi-plant, multiple business units, departments, sections, teams. Secondary constraint
throughout: nothing recommended here should make the platform *less* usable for
manufacturing, construction, IT, healthcare, logistics, retail, or professional services.

---

## Executive summary

The ERP today is, honestly, a well-built **HR administration + CRM + light procurement +
light field-tracking system**. Within that scope it's genuinely solid — the Department
phase just closed gave it a real organizational backbone, the Approval Engine is a good
generic pattern, and employee self-service (`/me`) is one of the most complete parts of the
app. But measured against how OceanForge — or any multi-plant manufacturer — actually
runs, three entire categories are effectively unbuilt, not partially built:

1. **The employee journey before "active employee" and after "last day"** — recruitment,
   hiring, onboarding, resignation, exit, alumni are not modeled at all. The system knows
   how to administer an already-hired, still-employed person; it has no concept of someone
   becoming or ceasing to be one.
2. **How a person's time is actually spent** — skills, certifications, training, capacity,
   shift planning, and project staffing don't exist as data. The only "who's working on
   what" signal today is a task-level assignee field, which answers "who owns this task,"
   not "who is staffed on this project at what percentage, for how long."
3. **Manufacturing operations itself** — Engineering, Production, Quality, Maintenance,
   Warehouse, and Safety exist only as job-title values or department *names* an admin can
   type in; none of them has an actual operational data model behind it. This is the
   single largest gap relative to OceanForge's real business.

None of this is a criticism of what's been built — it's a criticism of what hasn't been
started yet, and the good news is that the Department Foundation phase set up exactly the
right base (organization-scoped, self-referencing, generic) for all three categories to be
built on without another redesign. The roadmap at the end sequences the work accordingly:
foundation primitives first, then workforce, then operations, then the executive-reporting
layer that depends on all three having real data underneath it.

---

## 1. Organization Model

**Executive question (CEO/COO):** can this represent OceanForge's actual company chart —
Company → Business Unit → Division → Branch → Plant → Department → Section → Team — and
can I trust it as the source of truth for "who works where"?

**Current state:** yes, structurally. The self-referencing `Department` model (with the
`OrgUnitType` enum covering exactly those seven levels) was purpose-built for this in the
phase just closed, and every level maps without a schema change — confirmed in
`ORGANIZATION_HIERARCHY_PROPOSAL.md` §1 across all seven target industries, OceanForge
included. `Employee.departmentId` gives every person one structural home at whatever depth
the org actually manages people at.

**Limitations, from a COO/CFO lens rather than a developer lens:**

- **The org tree and the reporting chain can silently disagree, with no way to detect it.**
  An employee's `departmentId` (where they structurally sit) and their `reportingToId`
  (who they report to) are two independent fields — nothing requires them to be
  consistent. In a real matrix org that's *correct* (a Production employee can report
  administratively to someone outside Production), but today there is no report or
  dashboard that surfaces the cases where they diverge unexpectedly, so a COO can't ask
  "which employees report to someone outside their own department" and get an answer.
- **No org-history.** Reorganizing — moving a Department under a new Business Unit, for
  instance — takes effect immediately with no record of what the tree looked like before.
  A CFO asking "what was our headcount under the old structure last quarter, for
  comparison" cannot be answered; there's no point-in-time snapshot of the hierarchy.
- **No target vs. actual capacity per unit.** The tree tells you who's *in* a unit today,
  not what that unit is *supposed* to hold. A Plant Head cannot see "we're budgeted for 40
  technicians in this Section and currently have 34" — that number doesn't exist anywhere.
- **Rollup queries walk the tree, not an index.** "How many people report up through this
  Business Unit" requires descending through every child department; fine at today's
  scale, a real cost once OceanForge's full multi-plant tree and dashboards (§6) are both
  live simultaneously. Flagged, not urgent — see the Foundation-phase note on this in
  `ORGANIZATION_HIERARCHY_PROPOSAL.md` §3.
- **One Organization = one legal entity.** There's no concept of a parent holding company
  with multiple subsidiary Organizations sharing anything (people, reporting, consolidated
  finance). For a single large manufacturer like OceanForge this is very unlikely to
  matter; naming it because "defense conglomerate" sometimes implies multiple legal
  entities under one banner — worth a one-line confirmation with the business, not a
  design gap to fix speculatively.

**Bottom line:** the *shape* is right and needs no rework. What's missing is history,
capacity targets, and cross-checking — all additive, none of them require touching the
Department model itself.

---

## 2. Employee Lifecycle

**Executive question (CHRO/HR Manager):** does the system support a person's entire
journey, or just the middle of it?

Walking the stages as given, current-state honestly stated for each:

| Stage | Current reality |
|---|---|
| **Recruitment** | **Not modeled at all.** No candidate, job requisition, interview pipeline, or offer model exists anywhere. A person simply doesn't exist in the system until HR creates them directly as an `Employee` + `User`. |
| **Hiring** | Is, functionally, the same single action as "create an employee" — immediate portal login with a temp password, no offer-acceptance step, no background-check tracking, no "hired, starts Monday" pending state. `EmployeeDocument` has an `OFFER_LETTER` type, implying the offer itself happens outside the system and only its PDF gets uploaded afterward. |
| **Onboarding** | Partial. `CompleteProfileBanner` lets a portal-only user (the founding admin, or anyone without a linked Employee) self-fill their profile; a welcome notification carries the temp password. There is no structured checklist — no IT/asset provisioning, no induction training gate, no policy acknowledgment. For OceanForge specifically, there is no safety-induction-before-plant-access gate, which a defense manufacturer would very plausibly require as a hard prerequisite, not a nice-to-have. |
| **Training** | **Not modeled at all.** No course, session, or completion-record entity. |
| **Skill Development** | **Not modeled at all.** No skill entity, no proficiency levels, no gap analysis. |
| **Project Assignment** | Only exists as `ProjectTask.assigneeId` — "who owns this task." There is no "staffed on Project X" concept: no allocation percentage, no start/end date, no way to see or prevent over-allocation. |
| **Performance** | **Not modeled at all.** No review cycle, no goals/OKRs, no manager-employee review workflow. `DailySummary` (self-reported daily notes) and `PersonalTask` (a personal kanban) exist and are useful day-to-day signals, but neither is a performance-management system. |
| **Promotion** | Not a workflow — an admin edits `Employee.role` (job title) or `User.accessRole` directly via the Edit sheet, instantly, with no approval, no effective date, and no link to a corresponding compensation change. `PayrollRecord`/`SalaryStructure` exist but nothing connects "this person was promoted" to "their salary structure changed" beyond both being independently editable. |
| **Transfer** | Same story as Promotion — `Employee.departmentId` is just an editable field. No transfer request, no approval, no history. There is no way to answer "how long was this person in each department they've worked in." |
| **Resignation** | **Not modeled as distinct from exit.** No resignation request, no notice-period tracking, no last-working-day field. |
| **Exit** | Is a single, instantaneous action (`deleteEmployee`): soft-deletes the `Employee` row (`deletedAt`) and hard-deletes the linked login in the same transaction. No exit interview, no clearance checklist (IT access, asset return, badge/ID revocation — all of which matter more, not less, for a defense manufacturer), no distinction between resignation, termination, and retirement. |
| **Alumni** | **Not modeled at all.** Once `deletedAt` is set, the employee vanishes from virtually every query in the app (every list filters `deletedAt: null`) — there is no "recently exited" report, no rehire-eligibility flag, no alumni pool. A departed employee isn't tracked as an alumnus; they're effectively frozen, invisible data. |

**Bottom line:** the ERP currently covers roughly the middle third of this journey — and
even that middle third (Project Assignment, Performance, Promotion, Transfer) exists only
as raw, unapproved, unversioned field edits rather than real workflows. Everything before
"already hired" and everything from "resignation" onward is a blank slate.

---

## 3. Workforce Management

**Executive question (COO/Plant Head):** can I plan and see how my workforce is actually
deployed, not just who's on the payroll?

- **Shift planning — not modeled.** `Attendance` records a check-in/check-out and computes
  hours worked, but there is no shift definition (day/night/rotating), no shift roster, no
  shift-differential or overtime rule tied to a shift. For a multi-plant manufacturer
  running continuous or multi-shift operations, this is a direct, material gap.
- **Resource / workforce planning — not modeled.** No headcount-target concept exists (see
  §1). `Budget` now carries a `departmentId` (from the phase just closed) but that's a
  *money* plan, not a *people* plan — the two are structurally similar but currently
  unconnected.
- **Capacity planning — not modeled.** No utilization percentage, no "bench" (available
  for new assignment) view, nothing that tells a Department Head whether their unit is
  over- or under-committed.
- **Availability — partially covered.** Attendance + Leave give an accurate *today* view
  (present/absent/on-leave, surfaced on the HRMS Overview KPIs), and the Field module adds
  a real-time *on-site now* view. There is no forward-looking availability calendar —
  nothing answers "who is free to start on a new project next month."
- **Skills — not modeled.**
- **Certifications — not modeled as structured data.** `EmployeeDocument` has a
  `CERTIFICATE` type, but that's a file upload with no issuing body, expiry date, or
  renewal reminder attached. Worth flagging explicitly: if a Certification model is built
  later, it must compute "expired / expiring soon" live from the stored date on every
  read — this codebase has already been burned by the opposite pattern twice (AMC
  contract status and vendor-payment `OVERDUE`, both documented as static values set once
  at seed time and never recomputed), and a defense manufacturer's compliance
  certifications are exactly the kind of thing that must never silently go stale.
- **Competencies — not modeled.** No framework linking `EmployeeRole` (job title) to an
  expected competency set.

**Bottom line:** the app can tell you who showed up today. It cannot tell you what any of
them are actually capable of, certified for, or committed to.

---

## 4. Project Workforce

**Executive question (PMO Director/Production Director/Engineering Director):** how does
an employee actually relate to the projects they work on?

**Current reality:** there is effectively no employee-to-project relationship today. The
CRM `Project` model exists but is entirely client/sales-facing — it's tied to `Client`,
`Lead`, and `Quotation`, carries a single monetary `value`, and its only person-level link
is `ProjectTask.assigneeId`, which is task ownership, not project staffing. A PMO Director
cannot currently ask "who is on my project team" — only "who owns each individual task on
it," which is a materially different and much narrower question.

**Conceptually, how this should work** (workflow description, not a schema proposal —
already named as a Phase A architectural need in `ORGANIZATION_HIERARCHY_PROPOSAL.md` §2–3):

- An employee's **structural home** (which Department/Section/Team they belong to) should
  stay stable and single-valued — that's what `departmentId` already correctly is, and it
  shouldn't change just because someone is temporarily working on a project.
- An employee's **project involvement** is a separate, parallel relationship: potentially
  many concurrent projects, each with a percentage of time, a start date, and usually an
  end date. This is what's genuinely missing.
- **Functional reporting** (day-to-day technical direction, usually from the Department
  Head or a senior peer in the same discipline) and **project reporting** (direction from
  the Project/Production Manager for the duration of the engagement) are two different
  relationships that can be active *at the same time* for the same person — the defining
  feature of a matrix organization, and exactly the case a single `reportingToId` field
  cannot represent on its own.
- With that distinction in place, the three roles who most need this get real answers for
  the first time: a **Department Head** can see how much of their team's time is currently
  loaned out to projects vs. available; a **PMO/Production Director** can see exactly who
  is staffed on their project and at what percentage; and neither view requires the other
  to give up their own.

**Bottom line:** this is a modeling gap, not a UI gap — there's no amount of new screens
that fixes it without the underlying relationship existing first.

---

## 5. Manufacturing Operations

**Executive question (Production Director/Engineering Director/CTO):** does the ERP
understand how a defense manufacturer actually operates, from engineering through to a
delivered, safe, quality-checked product?

Going through the chain honestly:

- **Engineering** — exists only as an `EmployeeRole` value (`ENGINEER`) and, since the
  phase just closed, as a nameable `Department`. No drawings, bill-of-materials, or
  engineering-change-order concept exists.
- **Production** — **does not exist as a module.** No work orders, no production
  scheduling, no shop-floor/work-in-progress tracking. `ProjectTask` is the nearest
  adjacent concept, and it's a generic, CRM-flavored kanban item — not a manufacturing
  execution system.
- **Quality** — **does not exist.** No inspection records, no non-conformance/CAPA
  tracking, no quality-hold state on anything.
- **Maintenance** — **does not exist.** No asset/equipment registry, no preventive-
  maintenance schedule, no work orders, no downtime tracking.
- **Warehouse** — **does not exist.** No inventory, no stock movement, no bill-of-
  materials/issue tracking, and — notably — `PurchaseOrder` (which does exist, for
  procurement) has no closing loop into stock-on-hand once goods are delivered.
- **Safety** — **does not exist.** No incident/near-miss reporting, no safety-inspection
  record, no PPE-or-training gate on plant-floor access. For a defense manufacturer this is
  arguably the single highest-consequence gap on this entire list.
- **Projects** (as currently modeled) — client/quotation-centric, not an internal work-
  breakdown structure that Production/Engineering could actually plan against.

**How HR should integrate:** today, HR (Employee, Department, Attendance, Leave, Payroll)
is the *only* one of these seven areas that's actually built with real operational data
behind it — everything else is either entirely absent or represented as a label with
nothing operational underneath it. That's a completely reasonable place to have started
(the platform's own build discipline — Department Foundation before Skills Matrix, Skills
Matrix before Workforce Planning — got the sequencing right), but it means "Manufacturing
Operations" should be read as **0% built, not partially built.** The genuinely good news:
the Department phase gives Production/Quality/Maintenance/Warehouse/Safety exactly the
same stable, organization-scoped backbone that CRM and Finance already integrate with
(via `departmentId`) — so when those modules are eventually built, HR integration is a
foreign key to an existing, proven model, not a redesign of anything that exists today.

---

## 6. Executive Reporting

**Executive question (every persona listed):** what can I actually see today?

| Persona | What they should plausibly need | What exists today |
|---|---|---|
| **CEO / COO** | Cross-functional summary: pipeline, delivery, workforce, finance, operations, in one view, scoped to the whole company | The single `/` Dashboard (`requireRole(["ADMIN"])`) — CRM pipeline, active projects, attendance, on-site field activity, overdue payments, AMC renewals, open POs. A reasonable *cross-functional* start, but it's the only dashboard in the entire app, every ADMIN user sees the identical thing, and it has no Production/Quality/Maintenance/Safety data to summarize because that data doesn't exist (§5). |
| **CFO** | Spend, budget utilization, and financial exposure by org unit | Expense Claims and Budgets exist as *list/detail pages*, functional but not an executive rollup. `Budget.departmentId` (added this phase) is exactly the dimension a CFO dashboard would key off — the data model is ready, the dashboard isn't built. |
| **CHRO** | Headcount, attrition, capacity, org health | The HRMS Overview page (`requireRole(["ADMIN","HR"])`) is the closest existing thing — active headcount, present/absent/on-leave today, headcount-by-department. It's a genuinely solid start, but it's an operational HR page, not framed or scoped as CHRO-level insight, and has no attrition trend (there's no exit history to trend against — see §2) and no capacity view (no Workforce Assignment concept yet — see §3–4). |
| **CTO** | Engineering/technology delivery status | **Nothing maps to this today.** Engineering appears only as a job title; there is no technology-delivery reporting surface of any kind. Stated plainly because stretching an answer here would be misleading. |
| **Plant Head / Department Head** | Everything scoped to *my* org-tree subtree — my headcount, my attendance, my budget, my open tasks | **Does not exist in any form.** Every dashboard and list query in the app today is organization-wide; nothing filters by "my Department/Plant and everything under it." This is a real, sharp gap for a multi-plant company — there is currently no way for a Plant Head to see only their plant. |
| **Supervisor** | My team's attendance, leave, tasks today | Partially answerable only by an HR/Admin-role user looking at the organization-wide HRMS Overview and mentally filtering — there's no supervisor-scoped view. The "who's a manager" check already exists and is cheap (`reportingToId` count > 0), so a supervisor-scoped page is a filtering problem, not a new concept — but it isn't built. |
| **Employee** | My attendance, leave, timesheet, expenses, tasks | **Built, and one of the more complete parts of the app** — `/me` covers all of this plus daily summaries and a personal task board. |

**Bottom line:** reporting today is either **organization-wide-and-undifferentiated**
(the one Admin dashboard, the HRMS Overview) or **fully personal** (`/me`). The entire
middle layer — anything scoped to a specific org-tree subtree (a Plant, a Department, a
team) — doesn't exist, and that middle layer is exactly what a multi-plant company like
OceanForge needs most.

---

## 7. Generic ERP Design

**Where the current design feels too specific, and the fix pattern already proven:**

The Department phase's core move — turn a fixed value that was actually business-specific
into organization-scoped master data, self-referential and generic — is the right template
for several other places in the schema that show the same symptom: a **closed Prisma
enum that is visibly modeled on one kind of business**, which any other tenant either
can't use meaningfully or can't extend without a migration.

| Enum | What it's visibly tuned for | Why it doesn't generalize |
|---|---|---|
| `EmployeeRole` | An industrial-equipment/EPC contractor (`INSTALLATION_CREW`, `TECHNICIAN`, `ENGINEER`, `PROJECT_MANAGER`) | A hospital has no "Installation Crew"; a school has no "Sales Rep." This is job *title*, which every other industry needs to define for itself — exactly the problem Department solved for org structure. Being a fixed enum (not per-org master data) means adding "Nurse" or "Teacher" requires a schema migration today. |
| `Client.industry` | Process-industry manufacturing (`PHARMACEUTICALS`, `CHEMICALS`, `COSMETICS`, `BIOTECH`, `FOOD_AND_BEVERAGE`) | Doesn't include defense manufacturing at all — OceanForge's own clients wouldn't cleanly fit this list today. |
| `ProductLine` | One specific kind of industrial-equipment business (`PROCESS_EQUIPMENT`, `CONTAINMENT_SYSTEMS`, `PIPING_DISTRIBUTION`, `TURNKEY_PROJECTS`) | Meaningless for IT, healthcare, retail, or professional-services tenants. |
| CRM vocabulary generally (`SiteVisit`, `AmcContract`, `VisitType`/`VisitOutcome`) | Field-sales-and-equipment-maintenance business model | A professional-services firm or retailer doesn't have "AMC Contracts" (equipment maintenance agreements) or field "Site Visits" in the same sense the CRM models them today. |

**Recommendation — apply the Department pattern selectively, not universally.** Turning
*every* enum into per-org master data would be over-engineering for values that are
genuinely universal and unlikely to ever need extension — `LeaveType`, `PayrollStatus`,
`ApprovalStatus`, `PersonalTaskStatus` and similar internal workflow states are safe to
leave exactly as they are; every organization recognizes "Approved/Rejected/Pending"
regardless of industry. The enums worth migrating to configurable master data are
specifically the ones shown above that encode *this business's* vocabulary rather than a
universal workflow state — `EmployeeRole` above all, since job title touches HR,
reporting, dashboards, and now Department integration all at once, and is the most visible
of the four to OceanForge and to every other industry this platform wants to serve.

---

## Roadmap

Grouped as requested. Each phase is sequenced so nothing in it depends on something later
in the list — Foundation unblocks Workforce, Workforce and Foundation together unblock
Operations, and all three produce the real data Executive Intelligence needs to report on
honestly rather than with empty dashboards.

### Phase A — Foundation
*Core architectural primitives everything else depends on.*

1. **Generic Workforce Assignment concept** — the single highest-leverage item on this
   entire list. Unblocks Project Workforce (§4), Shift Planning (§3), and Capacity
   Planning (§3) simultaneously, because all three are really the same underlying
   relationship. Already named in `ORGANIZATION_HIERARCHY_PROPOSAL.md` §2–3, modeled on
   the existing Approval Engine's proven generic pattern.
2. **`EmployeeRole` → organization-scoped master data**, mirroring the Department pattern
   exactly. Unblocks genuinely cross-industry job titles without further migrations.
3. **Org-subtree query primitive** — "everything under this Department/Plant/Business
   Unit node," built once and reused. Every Phase D dashboard (Plant Head, Department
   Head, Supervisor) and several Phase B/C features (capacity, headcount rollups) need
   this same capability; building it once now avoids five bespoke, inconsistent versions
   later.
4. **A minimal Employee Lifecycle Event/History record** — one append-only "what changed
   about this employee, when, and why" log (role change, department transfer, status
   change). Light and additive, similar in shape to the existing `AuditLog` but
   employee-lifecycle-specific and meant to be shown to HR directly, not just an internal
   trail. This is the prerequisite for Promotion, Transfer, and Resignation ever becoming
   real workflows instead of raw field edits.

### Phase B — Workforce
*Features about employees and how their time and capability are tracked.*

1. **Skills & Certifications** — Employee-owned, Department-filterable, live-expiry-
   computed (explicitly not the static-status pattern already documented as a bug class
   elsewhere in this codebase).
2. **Training records.**
3. **Formal onboarding checklist** — for OceanForge specifically, a safety-induction /
   clearance gate before plant-floor access is the standout item here.
4. **Formal resignation/exit workflow** (notice period, last working day, clearance
   checklist, exit interview), built on the Phase A lifecycle-event log.
5. **Shift planning**, built on the Phase A Workforce Assignment concept.
6. **Capacity/availability view** (percentage-allocated, forward-looking) — depends on
   Phase A's Workforce Assignment existing first.

### Phase C — Operations
*Features tightly integrated with manufacturing and internal project delivery.*

1. **Project Workforce staffing** — the PMO/Production Director's "who's on my project
   and at what percentage" view, built directly on Phase A's Workforce Assignment.
2. **Department-owned internal work** — either an owning-department field and internal
   work-breakdown structure added to the existing CRM `Project`, or a distinct internal
   "Work Order/Initiative" concept, needed before Production or Engineering can be
   modeled meaningfully as anything other than a job title.
3. **The manufacturing modules proper** — Production scheduling, Quality/NCR tracking,
   Maintenance/Asset registry, Warehouse/Inventory, Safety/Incident tracking. This is the
   largest and most industry-specific body of work on the entire roadmap, and is
   deliberately sequenced last within Operations: every module in this group needs
   Workforce Assignment and department ownership (both above) to integrate with HR and
   Projects properly, rather than becoming five more disconnected silos.

### Phase D — Executive Intelligence
*Dashboards, KPIs, planning, forecasting.*

1. **Role-scoped dashboards**, built on Phase A's org-subtree primitive: Plant Head /
   Department Head / Supervisor views first — highest leverage, most mechanical (largely
   the same KPI shapes the Admin dashboard and HRMS Overview already compute, just
   subtree-filtered rather than organization-wide).
2. **CFO financial rollup dashboard** — spend and budget utilization by org unit, using
   the `Budget.departmentId` dimension that already exists.
3. **CHRO workforce dashboard** — headcount, attrition, capacity utilization. Depends on
   Phase A/B's lifecycle-event history for attrition trending and Workforce Assignment for
   capacity — an honest attrition dashboard needs exit history to exist first.
4. **COO/CEO cross-functional executive summary** — deliberately sequenced after
   Operations (Phase C) produces real data to summarize; a COO dashboard built before then
   would just be the CFO and CHRO dashboards combined, not a genuine operations view.
5. **Forecasting/planning tools** (workforce planning targets, capacity forecasting) —
   last, because forecasting needs real historical data from Phases A–C to be calibrated
   against; building it earlier produces forecasts with nothing real behind them.
6. **Ancestor-path/closure-table rollup optimization** (already flagged as deferred in
   `ORGANIZATION_HIERARCHY_PROPOSAL.md` §3) — this is the phase where the dashboards
   actually need it, so it belongs here rather than earlier.

---

No code, schema, or migrations accompany this document. Awaiting your prioritization before
any implementation work begins on any of the above.
