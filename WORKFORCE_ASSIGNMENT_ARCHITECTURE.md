# Workforce Assignment — Architecture Proposal (Phase 4: Workforce Foundation)

Date: 06 Aug 2026. Status: **proposal only — no schema, migration, or code accompanies this
document.** This is the conceptual design to be reviewed and approved before any
implementation work starts.

---

## 1. How employees currently interact with work (current-state inspection)

Before proposing anything new, here is exactly what exists today and where the gap sits —
confirmed against the schema and action code, not assumed:

- **`Employee.departmentId`** — one nullable FK, single-valued. This is the employee's
  *structural home*: stable, always-on, already deeply integrated (headcount, budgets,
  attendance, org chart all join through it). Changing it today is a direct, unaudited
  field edit via the Edit Employee sheet — instant, no history, no approval.
- **`Employee.reportingToId`** — a separate self-referential FK for line management. Who
  someone reports to and which department they sit in are independent today; nothing keeps
  them consistent, and nothing needs to — that's correct for a matrix org, but it means
  there is no dimension today for "who I report to *for this specific piece of work*."
- **`ProjectTask.assigneeId`** — a single nullable FK from a task to one employee. This
  answers "who owns this task," not "who is staffed on this project." A `Project` has no
  member list, no roster, and no percentage-of-time concept anywhere.
- **`Timesheet`** — `employeeId` + optional `projectId`, `date`, `hoursLogged`,
  `taskDescription`, `billable`. This is the closest existing link between an employee and
  a project, but it's **retrospective and self-reported** ("I worked 6 hours on Project X
  today"), not a forward-looking staffing record. It has no start/end date, no allocation
  percentage, no approval, and nothing stops someone from logging hours against a project
  they were never formally staffed on.
- **`Attendance`** — whole-day presence (checked in/out, hours worked), with no project or
  department dimension at all. It answers "were they at work," not "what were they working
  on or for whom."
- **`PayrollRecord`** — monthly, per-employee, no project or department dimension either.
  Compensation is entirely disconnected from where or what someone is currently working on.

**The gap, stated plainly:** every one of the above either records a single permanent fact
(`departmentId`, `reportingToId`) or a retrospective log (`Timesheet`, `Attendance`). There
is no structure anywhere that says, forward-looking, *"this employee is currently, or will
be, working on this project/unit, at this percentage of their time, for this period, and
someone signed off on it."* That's the entire gap this document proposes to close.

The Approval Engine (`ApprovalRequest`: `entityType` + `entityId` + `approverRole` +
`status`, one generic table already serving Purchase Orders, Expense Claims, Budgets, and
Payment Confirmations) is the closest existing architectural relative — a single,
entity-agnostic table that other features route through rather than each inventing their
own approval mechanism. It is the direct model for the recommendation below.

---

## 2. Architectural options compared

Four shapes were considered, per your request:

### Option A — A dated Assignment table (current-state rows)

One row per assignment: who, what they're assigned to, what percentage of their time, from
when, until when (nullable = open-ended), and its current status. "Who is on Project X
right now" is a direct, indexed query (`WHERE targetId = X AND status = 'ACTIVE'`).
"What is Employee Y currently allocated to" is the same query the other direction.

- **For:** cheap, direct answers to exactly the questions that get asked most often
  ("who's on this project," "is this person available," "what's their utilization right
  now") — all of them are a `WHERE` clause on one table, no derivation needed. Matches the
  shape of every other "current state + status" model already in this codebase
  (`ApprovalRequest`, `ProjectTask`, `LeaveRequest` — none of them are event-sourced).
- **Against:** a full history of *changes* (this assignment was 60%, then amended to 80%,
  then ended early) isn't native to the row itself — it needs a side log, the same way
  every other mutable record in this app gets one (`AuditLog`).

### Option B — A direct Employee↔Project join (`ProjectMember`)

A narrower many-to-many table scoped specifically to project membership: employee,
project, role, allocation, dates.

- **For:** simpler if project staffing were the *only* problem being solved.
- **Against:** it explicitly isn't the only problem — the same "who, what, since when,
  until when, what percentage, who approved" shape is needed for **temporary department
  loans** too (a welder moving from Plant A to Plant B for six weeks is not a project, it's
  a unit-to-unit loan). Building `ProjectMember` for projects and a second,
  structurally-identical table for department loans is exactly the kind of duplicate,
  parallel implementation this project's own working rules warn against. Rejected for that
  reason, not because the idea is wrong — it's half of Option A, built twice.

### Option C — A resource-allocation ledger (time-sliced allocation rows)

Instead of one row spanning a date range, pre-materialize one row per employee per
time-bucket (e.g., per week): "Employee Y, week of Aug 10, 60% Project X, 40% home."

- **For:** capacity-planning queries ("total allocated hours next month across the Plant")
  become a simple sum with no date-range math.
- **Against:** every assignment edit has to regenerate every future time-slice it touches,
  which means either a background job or on-write fan-out logic — real operational
  complexity for a benefit (faster planning-horizon queries) that isn't needed yet at this
  platform's scale. This is a legitimate *future optimization on top of Option A*, not a
  replacement for it — the same relationship the ancestor-path/closure-table idea has to
  the plain `parentId` tree in `ORGANIZATION_HIERARCHY_PROPOSAL.md` §3: worth doing when
  the read pattern that needs it actually exists, not before.

### Option D — An event/history model (append-only assignment events)

No "current assignment" row at all — only a stream of events (`ASSIGNED`, `AMENDED`,
`ENDED`), and "who is currently assigned" is derived by replaying the latest event per
employee/target.

- **For:** a perfect, tamper-evident audit trail is native to the model.
- **Against:** the question this feature gets asked *most* — "who is available / what is
  the current state" — becomes the expensive, derived query instead of the cheap, direct
  one, which is backwards for how this data will actually be used day to day (capacity
  checks happen constantly; full history lookups happen occasionally). Nothing else in
  this codebase is modeled this way — `AuditLog` is the one append-only log that exists,
  and it is deliberately a secondary/forensic trail, never the primary source of truth for
  "what is true right now" of any entity. Introducing a second, different modeling
  philosophy just for this one feature would be inconsistent with everything else in the
  app.

### Recommendation: **Option A** — a dated Assignment table, current-state rows with
`startDate`/`endDate`/`status`, changes logged to the existing `AuditLog` mechanism for
history (the same pattern every other mutable entity in this app already uses), with
Option C's time-slicing available as a **later, additive optimization** once Capacity
Planning (Phase 7) actually needs fast multi-week rollups, and Option D's concerns
addressed by the fact that `AuditLog` already gives every mutation a timestamped,
attributed trail without changing what "current state" means.

---

## 3. Proposed structure (conceptual — not a schema, no field types finalized)

One new concept, tentatively **Workforce Assignment** (naming TBD at implementation time —
"Assignment" risks colliding conceptually with `ProjectTask`'s "assignee," worth resolving
before building, not now):

- **Who** — the employee.
- **What it's for** — a *target*, polymorphic in the same way `ApprovalRequest.entityType`
  + `entityId` already is: either a **Project** or an **Org Unit** (a `Department` row —
  deliberately not a separate "Team" concept, since Team/Section/Department/Plant are
  already all `Department` rows distinguished only by `type`; see
  `ORGANIZATION_HIERARCHY_PROPOSAL.md` §1). Two target kinds, not N — a
  target-type-per-feature table explosion is exactly what Option B above was rejected for.
- **How much of their time** — an allocation percentage (1–100), with **100 as the default
  meaning "full-time on this"**. This subsumes "full-time or partial" as one field rather
  than two, and is what every downstream capacity/utilization calculation needs
  numerically anyway.
- **Since when / until when** — a start date, and a nullable end date (nullable = open-
  ended, e.g., a permanent-until-further-notice project staffing). Ending an assignment
  either sets a real end date in advance or is closed out on the day it actually ends.
- **Assignment kind** — a small, closed classification, not a free-text field: at minimum
  **project staffing** vs. **temporary department loan**. This distinguishes "OceanForge
  is staffing Welder X onto Project Falcon at 50%" from "Plant A is temporarily lending
  Welder X to Plant B for six weeks" — same shape, different business meaning, and the
  distinction matters for reporting (§5) and for who should approve it (below). It is
  explicitly **not** used for a *permanent* department transfer — see the important
  distinction in §3.1 below.
- **Who approved it** — routed through the **existing Approval Engine**, not a new
  mechanism: add a `WORKFORCE_ASSIGNMENT` value to the existing `ApprovalEntityType` enum
  (which already grew from 3 to 4 values once, for `PAYMENT_CONFIRMATION` — this is a
  proven, low-friction extension point, not a redesign) and add one case to the existing
  `decideApproval` switch. Not every assignment necessarily needs to go through approval —
  see the workflow discussion below — but when one does, it uses the identical mechanism
  Purchase Orders and Budgets already do.
- **Status** — mirroring every other lifecycle-status enum already in this app: something
  like `PENDING_APPROVAL` (if routed through approval) → `ACTIVE` → `ENDED` /
  `CANCELLED`.
- **A note field**, for the same reason every approval-adjacent record in this app has one.

### 3.1 — A deliberate scope boundary: assignment vs. permanent transfer

The question list this proposal was asked to answer includes *"can someone temporarily
move to another department"* — that's squarely a **Workforce Assignment** (kind:
department loan, with an end date). A **permanent** department transfer is a different,
already-partially-existing action: it's just `Employee.departmentId` being changed for
good, exactly as it works today. What that permanent action is missing — history, an
approval step, an audit-friendly record — is the **Employee Lifecycle Event log** named as
a Phase A Foundation item in `GAP_ANALYSIS.md` §2, not this feature. The two are related
(both eventually flow through the same Approval Engine, both eventually appear on an
employee's "history" view) but they answer different questions and should stay two
concepts: *temporary and concurrent* (Workforce Assignment) vs. *permanent and singular*
(a lifecycle event changing the one `departmentId` field). Conflating them would mean every
permanent transfer has to carry a meaningless "until when" field, and every temporary loan
would corrupt the stable, single-valued meaning `departmentId` has today.

### 3.2 — Answering the specific questions asked

| Question | Answer |
|---|---|
| Which department owns this employee? | Unchanged — `Employee.departmentId`, already exists, stays the single source of truth for structural home. |
| Which project is the employee currently assigned to? | A Workforce Assignment row, `targetType: PROJECT`, `status: ACTIVE`. Can be more than one, concurrently (see below). |
| Since when / until when? | `startDate` / nullable `endDate` on the assignment row. |
| Full-time or partial allocation? | `allocationPercent` (1–100), 100 = full-time, as one field. |
| Who approved the assignment? | Routed through the existing Approval Engine when approval is required (see workflow, §4) — `decidedById`/`decidedOn` on the resulting `ApprovalRequest`, identical to how a Purchase Order approval is recorded today. |
| Can someone belong to multiple projects? | Yes — multiple concurrent `ACTIVE` assignment rows for the same employee, different `targetId`s, allocations summing to (ideally) ≤100. |
| Can someone temporarily move to another department? | Yes — an assignment row with `targetType: ORG_UNIT` pointing at a different department, kind: department loan. Their `Employee.departmentId` does **not** change (§3.1) — they remain structurally home, temporarily working elsewhere. |
| Can a supervisor see resource utilization? | Yes — utilization for any employee is `SUM(allocationPercent)` across their currently-`ACTIVE` assignment rows; "home" capacity is whatever isn't consumed by explicit assignments (an employee with zero assignment rows is implicitly 100% home — no assignment row is ever required for the default case, keeping the common, 90% case exactly as simple as it is today). See §5 for who gets to see this and how. |

---

## 4. Business workflow

1. **Creating an assignment** is a role-gated action (mirroring how Department and
   Employee actions are gated today) — plausibly ADMIN/HR org-wide, plus a Department Head
   or Project/PMO-type role for assignments touching their own unit or project. The exact
   role matrix is an implementation-time decision, not an architectural one.
2. **Whether it needs approval is a business decision the *kind* of assignment should
   drive, not a blanket rule.** A department loan takes someone's time away from their
   department head's team — that's precisely the kind of action the Approval Engine
   already exists for (the same reasoning that already routes Purchase Orders through
   ADMIN approval because they commit organizational resources). A same-department project
   staffing action (a Department Head assigning their own people to a project their
   department owns) plausibly doesn't need a second sign-off, the same way creating an
   Employee doesn't need approval from a second admin today. **Recommendation:** approval
   is required specifically when an assignment would pull an employee's time away from
   their own department head's control (a loan out, or project staffing initiated by
   someone outside the employee's department) — decided by whoever holds `approverRole`
   for that department, exactly mirroring how `decideApproval`'s authorization is already
   "fully data-driven" per the entity's stamped `approverRole` (see CLAUDE.md's Approval
   Engine section, point 12).
3. **While active**, the assignment is visible everywhere its two sides show up — the
   employee's profile, the project's team roster, and (once Phase 8 org-hierarchy
   reporting exists) the owning department's "who's currently loaned out" view.
4. **Ending an assignment** — either it simply reaches its planned `endDate` (a background
   status sweep, or computed live at read time the same way AMC contract status *should*
   be but currently isn't — see `AUDIT_REPORT.md`'s fix for exactly that class of bug;
   this feature should live-compute "has this assignment ended" rather than repeat that
   mistake), or someone with edit rights ends it early with a reason.
5. **Over-allocation** (assignments summing to more than 100% for one employee) should be
   **flagged, not silently hard-blocked** — mirroring this app's general posture of
   trusting the people who use it while surfacing risk (most status transitions in this
   app are soft-guided, not rigidly state-machined, per `GAP_ANALYSIS.md` §7's honest
   read of the CRM/Vendor modules). A real organization does sometimes deliberately
   over-commit someone short-term. A hard cap is a validation-logic decision that can be
   layered on later without any structural change — worth deciding at implementation time
   with real user feedback, not speculatively now.

---

## 5. UI workflow (conceptual — no components proposed yet)

- **Employee detail page** gains an "Assignments" section, in the same place and the same
  pattern as the existing Recent Attendance / Leave History / Payroll History cards —
  current assignments first, past ones below.
- **Project detail page** gains a "Team" section (a real roster, distinct from the
  task-level assignees `ProjectTask` already shows) — who's staffed, at what percentage,
  since when.
- **Department detail** (once one exists beyond the current list page) gains a
  loaned-out / loaned-in summary — directly answers a Plant Head's "who's currently not
  physically working for me even though they're mine" question.
- **A supervisor-scoped utilization view** — "my team's current allocation" — is a natural
  extension of the existing "Team Tasks" section already on `/me` for managers (computed
  the same way: `reportingToId` count > 0 makes someone a manager, no new role needed).
- **Creation flow** — an "Assign" action reachable from both directions (from a Project's
  team section, or from an Employee's profile), the same dual-entry-point pattern already
  used for Department (creatable from the Departments page, editable inline from a
  department's own row).

---

## 6. Reporting implications

This is the feature that makes several currently-impossible reports possible for the first
time, without needing anything else built first:

- **Individual utilization** — `SUM(allocationPercent)` across active assignments, per
  employee. Directly answers the CHRO/Supervisor question from `GAP_ANALYSIS.md` §3/§6.
- **Department capacity** — aggregate loaned-out vs. loaned-in percentage per department,
  the missing half of the "40 technicians budgeted, 34 in the department, but 6 more are
  currently on loan from elsewhere" picture a Plant Head needs.
- **Project staffing cost/roster** — who's on a project and at what percentage, cross-
  referenced against `Timesheet`'s actual logged hours for a "planned vs. actual" view —
  named as a natural future cross-check, not proposed for this phase.
- **Org-wide utilization rollup** — once combined with the org-subtree query primitive
  named in `GAP_ANALYSIS.md`'s Phase A, this is exactly what feeds a CEO/COO "are we
  over- or under-staffed, and where" executive view (Phase D of that same roadmap).

None of this requires the ancestor-path/closure-table optimization yet — a flat
per-employee or per-department query is enough at today's scale; that optimization stays
deferred until it's genuinely needed, per `ORGANIZATION_HIERARCHY_PROPOSAL.md` §3.

---

## 7. Future integrations

Specifically addressing how this anchors everything named as depending on it:

- **Skills Matrix (Phase 5)** — orthogonal at the data level (skills are owned by the
  Employee, not the assignment), but once it exists, assignment *creation* is the natural
  point to eventually check "does this person hold the skill this project role needs" —
  a validation layered on top of Assignment, not a structural dependency of it.
- **Certifications (Phase 5)** — same relationship: assignment creation for a
  safety-gated role (crane operation, welding on a pressure vessel) is where a future
  "is their certification currently valid" check would plug in.
- **Training (Phase 6)** — no direct structural coupling; entirely orthogonal.
- **Shift Planning (part of Phase 7 per your roadmap)** — a shift is fundamentally "which
  time-block does this work happen in," which is a natural additional dimension *on* an
  assignment (or a closely related sibling concept) rather than a separate system that
  would otherwise have to reinvent "who, what, since when."
- **Capacity Planning (Phase 7)** — this **is** Workforce Assignment's primary reporting
  consumer, described in full in §6. Capacity Planning doesn't need a new data model; it
  needs queries and dashboards over this one.
- **Manufacturing (Phase 9)** — this is the concrete mechanism behind your own stated
  reasoning for sequencing Manufacturing last: once "Work Order" or "Production Job"
  exists as a target type alongside Project and Org Unit (an additive extension, the same
  way `ApprovalEntityType` has already grown once), shop-floor staffing becomes
  Workforce Assignment rows too — Production consumes the same structure Projects and
  Departments already do, instead of Manufacturing inventing its own "who's working on
  this" concept from scratch.
- **Executive Dashboards (Phase 8/D)** — every rollup named in §6 is exactly the raw
  material an executive dashboard would aggregate and chart; this phase produces the data,
  dashboards are a presentation layer on top of it.

---

## 8. Summary recommendation

1. **Build one generic Workforce Assignment concept** (Option A: dated, current-state
   rows), not a project-specific join table and a separate department-loan mechanism.
2. **Two target kinds only** — Project, or Org Unit (reusing the existing `Department`
   tree) — mirroring the Approval Engine's proven `entityType`/`entityId` polymorphism
   rather than inventing a new pattern.
3. **Allocation is a percentage (default 100), not a full-time/part-time enum** — it
   subsumes that distinction and is what every capacity calculation needs numerically.
4. **Approval, when required, routes through the existing Approval Engine** via one new
   `ApprovalEntityType` value — no new approval mechanism.
5. **Keep permanent department transfer conceptually separate** from temporary
   assignment/loan — the former changes `Employee.departmentId` (as it does today, ideally
   gaining history via the Phase A lifecycle-event log); the latter never touches it.
6. **History comes from the existing `AuditLog` mechanism**, not a bespoke event-sourced
   model — consistent with how every other mutable entity in this app is already handled.
7. **Time-sliced pre-materialization (Option C) and a hard over-allocation cap are both
   legitimate, explicitly deferred optimizations** — build them when Capacity Planning
   (Phase 7) actually needs them, not speculatively now.

No code, schema, or migrations accompany this document. Awaiting approval before any
implementation work begins.
