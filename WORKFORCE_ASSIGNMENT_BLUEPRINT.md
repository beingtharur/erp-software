# Workforce Assignment — Final Architecture Blueprint

Date: 06 Aug 2026. Status: **final design review — no schema, migration, or code
accompanies this document.** This supersedes `WORKFORCE_ASSIGNMENT_ARCHITECTURE.md` as the
authoritative reference: it keeps that document's core recommendation (a single, dated
Assignment table, polymorphic across two target kinds, modeled on the Approval Engine's
proven pattern) and refines it against seven stress-test reviews. Where this document adds
a field, distinction, or boundary that the earlier proposal didn't have, it says so and
explains which review surfaced the need — nothing here was added speculatively.

This is the document to implement against once approved.

---

## 0. What changed from the initial proposal, and why

The prior proposal got the core shape right: one Assignment concept, two target kinds
(Project, Org Unit), percentage allocation, approval via the existing Approval Engine,
history via `AuditLog`. Stress-testing it against a real OceanForge welder's actual day
(Review 1) and a real manufacturing chain (Review 3) surfaced three real gaps in that
initial shape, all resolved below:

1. **No way to say who supervises or manages *this specific* assignment**, as distinct
   from an employee's permanent line manager. → adds a `role` classification.
2. **No way to say whether an assignment competes for capacity or merely describes
   organizational placement** — a welder can be 100% on Project NS-108 *and* placed in
   Hull Fabrication Team B at the same time without that being 200%. → adds a `purpose`
   classification.
3. **No mechanism to guarantee history stays accurate after the org chart changes** — a
   report on a five-year-old project must not silently change because departments got
   renamed or reorganized since. → adds point-in-time snapshot fields.

None of these are new tables or new target kinds — they're additional fields on the one
Assignment row, and the two-target-kind design (§2) is unchanged and confirmed correct by
every review below, including across six other industries (Review 7 / §10).

---

## 1. Final architecture

### 1.1 The concept

**Workforce Assignment** — one generic record answering "this employee, working on this
target, in this capacity, at this percentage of their time, from when until when, in what
status, approved by whom." Modeled directly on the existing `ApprovalRequest` pattern
(polymorphic `entityType`/`entityId`, one table serving many callers) rather than a new
architectural idiom.

### 1.2 Conceptual fields

| Field | Meaning | Surfaced by |
|---|---|---|
| `employeeId` | Who. | — (baseline) |
| `targetType` | `PROJECT` or `ORG_UNIT` today; extensible later (§14). | Initial proposal |
| `targetId` | What — a `Project` row, or a `Department`-tree node at any depth (Team/Section/Department/Plant/Branch/Division/Business Unit are all the same table, per `ORGANIZATION_HIERARCHY_PROPOSAL.md` §1). | Initial proposal |
| `role` | `MEMBER`, `LEAD/SUPERVISOR`, or `MANAGER` — this person's capacity *within this specific assignment*. | **New — Review 1** |
| `purpose` | `CAPACITY` (competes for the 100% ceiling — project staffing, a department loan), `PLACEMENT` (organizational embedding that doesn't independently draw down capacity — e.g., "which team am I currently working within" while already accounted for by a concurrent capacity assignment), or `SCHEDULE` (timing/shift context, once Shift exists as a target — §14). | **New — Review 1** |
| `kind` | A reporting label: `PROJECT_STAFFING`, `DEPARTMENT_LOAN`, `CROSS_PLANT_DEPLOYMENT`, `TEAM_PLACEMENT`, `EMERGENCY_DEPLOYMENT`, etc. Orthogonal to `purpose` — doesn't change behavior, exists purely so a PMO Director can filter "show me every cross-plant deployment" without inferring it from other fields. | **New — Review 2** |
| `allocationPercent` | 1–100, default 100. Meaningful specifically for `purpose: CAPACITY` rows — see §3.2 for how utilization math treats `PLACEMENT` rows. | Initial proposal |
| `startDate` / `endDate` | Since when / until when. Nullable end = open-ended. | Initial proposal |
| `status` | `PENDING_APPROVAL` → `ACTIVE` → `ENDED` / `CANCELLED`. | Initial proposal |
| Approval linkage | Via the existing `ApprovalRequest` mechanism, one new `ApprovalEntityType` value, when the assignment's `kind` requires sign-off (§8). | Initial proposal |
| **Snapshot fields** | The employee's `departmentId` and `reportingToId` *as of assignment creation*, plus a human-readable label of the target *as of assignment creation*. Immutable once written. | **New — Review 5** |
| `note` | Free text, matching every other approval-adjacent record in this app. | Initial proposal |

### 1.3 What is deliberately **not** part of Workforce Assignment

Confirmed and sharpened by Review 2 — these look superficially similar (a "who, since
when, until when" shape) but are different relationship categories and would corrupt the
model if folded in:

- **Permanent department membership** — stays exactly what it is today,
  `Employee.departmentId`, a single stable field, not a row in this table (§0, unchanged
  from the initial proposal, reaffirmed after stress-testing).
- **Committee / representative membership** (e.g., a Safety Committee seat) — this is
  governance/representation, not work-capacity allocation. It may reuse this table's
  *shape* as a pattern later if the business needs to track it formally, but it is not
  the same rows, and forcing it in would stretch the engine's purpose past what "who owns
  this person's time" actually means.
- **Mentor / mentee pairing** — this is an employee-to-employee relationship (closer in
  shape to `reportingToId`, a self-relation on `Employee`) not an employee-to-work
  relationship. A different target shape entirely; out of scope here.

---

## 2. Relationship model — Review 1 walkthrough

Taking the OceanForge welder example directly, and classifying every stated relationship:

```
Employee: Welder, OceanForge
│
├─ Administrative Department: Engineering
│   → Employee.departmentId (permanent, unchanged, NOT an assignment)
│
├─ Functional Manager: Engineering Manager
│   → Employee.reportingToId (permanent, unchanged, NOT an assignment —
│      already correctly separate from Department.headId per
│      ORGANIZATION_HIERARCHY_PROPOSAL.md §2)
│
├─ Current Project: NS-108 Missile Frigate
│   → Workforce Assignment: targetType=PROJECT, targetId=NS-108,
│      role=MEMBER, purpose=CAPACITY, allocationPercent=100
│
├─ Project Manager: Project Manager NS-108
│   → Workforce Assignment: targetType=PROJECT, targetId=NS-108,
│      role=MANAGER  ← a *different assignment row*, for a different
│      employee, targeting the same Project. "Who is the PM for
│      NS-108" is resolved by looking up the assignment(s) on that
│      Project with role=MANAGER — no separate "projectManagerId"
│      field is needed on Project itself.
│
├─ Current Team: Hull Fabrication Team B
│   → Workforce Assignment: targetType=ORG_UNIT, targetId=Team B,
│      role=MEMBER, purpose=PLACEMENT (does not add to the 100%
│      ceiling — the welder's capacity is already accounted for by
│      the NS-108 assignment; Team B describes *where* that work
│      happens, not an additional draw on their time)
│
├─ Temporary Assignment: Kochi Yard
│   → Not a separate row. Team B is organizationally nested under
│      Kochi Yard in the Department tree (Kochi Yard = a PLANT-level
│      node, Team B = a TEAM-level descendant of it). "Kochi Yard" is
│      derived by walking targetId's parentId chain upward from the
│      single Team B assignment — recording it twice would be
│      redundant data that could drift out of sync with itself.
│
├─ Current Shift: Night Shift
│   → Once Shift Planning (Phase 7) exists: a Workforce Assignment
│      with targetType=SHIFT, purpose=SCHEDULE (§14) — same engine,
│      third target kind, does not compete for capacity.
│
├─ Current Supervisor: Shift Supervisor
│   → Derived, not stored directly: the person holding
│      role=LEAD/SUPERVISOR on an assignment targeting the same
│      Team B (or Department.headId, for the *permanent* organizational
│      head, if no shift-specific supervisor assignment exists — see
│      §5 for when the two differ)
│
├─ Quality Inspector Singh — NOT a Workforce Assignment relationship at
│   all (§5 / Review 3) — Singh inspects the welder's output, doesn't
│   own their time
│
└─ Safety Officer Patel — NOT a Workforce Assignment relationship to
    the welder directly (§5 / Review 3) — Patel's own responsibility
    for Workshop 3 can itself be a Workforce Assignment
    (role=SAFETY_OFFICER-equivalent on the workshop's ORG_UNIT), but
    that's Patel's assignment, not a relationship stored against the
    welder
```

**Conclusion: yes, the proposed model represents this without ambiguity**, and does so
with *fewer* concepts than the raw list suggests — eight stated relationships resolve into
two permanent fields (already existing), three Workforce Assignment rows (Project, Team,
future Shift), and three *derived* facts (Supervisor, Project Manager, ancestry-implied
Plant) that need no storage of their own. That reduction — turning "supervisor" and
"project manager" from things you'd otherwise store per-employee into things you *derive*
by asking "who holds `role=LEAD/MANAGER` on the same target" — is the single most
important refinement this review produced.

---

## 3. Assignment lifecycle & types — Review 2 walkthrough

| Type | In the engine? | Justification |
|---|---|---|
| **Permanent Department** | **No** | Single, stable, always-on fact — `Employee.departmentId`, unchanged. Modeling it as a "assignment with no end date" would make the 90% common case (an employee with a stable home and no active loans) carry a permanent row for no benefit. |
| **Temporary Department Loan** | **Yes** — `targetType=ORG_UNIT`, `kind=DEPARTMENT_LOAN`, `purpose=CAPACITY` | Textbook fit: bounded duration, competes for capacity, needs approval from the losing department. |
| **Project Assignment** | **Yes** — `targetType=PROJECT`, `purpose=CAPACITY` | The core case this feature exists for. |
| **Shift Assignment** | **Yes, once Shift exists as a target type (§14)** — `purpose=SCHEDULE` | Same lifecycle shape (who, since when, until when, who approved a schedule change) as everything else in this table; deliberately tagged `SCHEDULE` so it never double-counts against capacity. |
| **Emergency Assignment** | **Yes — not a new type, a `kind` value / workflow variant** | Structurally identical to a department loan or project reassignment; the difference is *process* (may be created before formal approval, with retroactive sign-off), not *shape*. Modeling it as a separate table would duplicate everything except one workflow rule. |
| **Cross-Plant Deployment** | **Yes** — `targetType=ORG_UNIT`, `kind=CROSS_PLANT_DEPLOYMENT` | Structurally identical to a department loan (loaning to a higher-level org-unit node); kept as its own `kind` purely so it's separately reportable, which costs nothing. |
| **Training Assignment** | **Conditionally** | Enrollment, curriculum, pass/fail, and certificates belong entirely to the future Training module (Phase 6) — Workforce Assignment should know nothing about any of that. But when a training program is long/blocking enough to take someone off their normal capacity for a meaningful stretch (a two-week offshore certification course, not a one-hour lunch-and-learn), Training should create a thin `purpose=CAPACITY` assignment purely so Capacity Planning correctly sees them as unavailable — a pointer, not a duplication of Training's own rich data. |
| **Committee Assignment** | **No** — deliberately out of scope | Governance/representation, not work-capacity allocation (§1.3). |
| **Mentor Assignment** | **No** — deliberately out of scope | Employee-to-employee, not employee-to-work (§1.3). |

---

## 4. Manufacturing reality — Review 3 walkthrough

Chain given: *Morning Shift → Hull Fabrication → Project NS-108 → Workshop 3 → Team Bravo
→ Supervisor Kumar → Quality Inspector Singh → Safety Officer Patel.*

The rule this review establishes, stated once and applied consistently: **Workforce
Assignment models ownership and placement — who effectively "has" the employee's time or
organizational position. It does not model every functional interaction a person has while
working.**

```
IN Workforce Assignment (ownership/placement):
  Morning Shift        → targetType=SHIFT (future),  purpose=SCHEDULE
  Hull Fabrication     → ancestor of Team Bravo, derived (not its own row)
  Project NS-108       → targetType=PROJECT,          purpose=CAPACITY
  Workshop 3           → ancestor of Team Bravo, derived (not its own row)
  Team Bravo           → targetType=ORG_UNIT,          purpose=PLACEMENT
  Supervisor Kumar     → DERIVED: role=LEAD on an assignment targeting
                          Team Bravo (or Department.headId if no
                          shift-specific lead assignment exists)

NOT in Workforce Assignment (functional interaction, not ownership):
  Quality Inspector Singh → belongs to a future Quality module: an
    Inspection record referencing the Project/Work Order and the
    inspector. Singh reviews the welder's *output*; Singh does not
    own the welder's time. (Singh's own placement — "Singh is the
    QA inspector responsible for Workshop 3" — could itself be a
    Workforce Assignment, role=QUALITY_INSPECTOR-equivalent on
    Workshop 3's ORG_UNIT. That's Singh's row, not a relationship
    stored against the welder.)
  Safety Officer Patel   → same pattern as Singh: Patel's
    responsibility for the workshop is Patel's own assignment
    (if modeled at all); any sense in which the welder "reports to"
    Patel is contextual (same-workshop lookup), not a stored
    per-employee relationship.
```

This generalizes cleanly: **any cross-functional oversight role (quality, safety,
compliance) is just another Workforce Assignment targeting the same org unit, distinguished
by `role`.** A welder never needs a direct, stored relationship to the Quality Inspector or
Safety Officer — both are discoverable by asking "who else is assigned to Workshop 3, in
what role" at query time. This is the same derivation mechanism already used for
Supervisor and Project Manager in §2 — one mechanism, reused, rather than a new
relationship type per oversight function.

---

## 5. Resource planning — Review 4 walkthrough

Each PMO Director question, and whether the architecture answers it:

| Question | Answerable? | How |
|---|---|---|
| Who is available next week? | **Yes, efficiently** | Employees whose `SUM(allocationPercent)` across `purpose=CAPACITY` assignments active during that week is under 100. A standard indexed date-range aggregate — the same shape of query `LeaveRequest` availability checks already use. |
| Which department is overloaded? | **Yes**, with a scaling caveat | Requires: home headcount (`COUNT employees WHERE departmentId = X`), loaned-out sum, and loaned-in sum. Answerable today at moderate scale; rolling this up across a deep multi-plant tree (Section → Plant → Business Unit) benefits from the ancestor-path/closure-table optimization already flagged as deferred in `ORGANIZATION_HIERARCHY_PROPOSAL.md` §3 — same conclusion applies here, not a new problem. |
| Which welders are free? | **Yes, once Skills Matrix (Phase 5) exists alongside it** | Workforce Assignment supplies "are they free"; identifying "who is a welder" needs Skills Matrix (or, more coarsely, `EmployeeRole` today). This is a correctly-sequenced dependency, not a flaw — it's exactly why your own roadmap puts Skills before Workforce Planning. |
| Which engineer is allocated above 100%? | **Yes, directly** | `SUM(allocationPercent) WHERE purpose='CAPACITY' AND status='ACTIVE' GROUP BY employeeId HAVING SUM > 100` — the core validation query behind the "flag, don't hard-block" over-allocation posture (§8). |
| Who is allocated across multiple projects? | **Yes, directly** | `COUNT(DISTINCT targetId) WHERE targetType='PROJECT' AND status='ACTIVE' GROUP BY employeeId HAVING COUNT > 1`. |

**Nothing here requires a change to the proposed structure.** It requires indexes on
`employeeId`, `(targetType, targetId)`, and `(status, startDate, endDate)` from day one —
these are queries a PMO Director would run routinely, not occasional reports, so the
indexing is a baseline requirement, not a later optimization (see §11).

---

## 6. Historical accuracy — Review 5

**The risk, stated precisely:** a raw Assignment row (`employeeId`, `targetId`, dates,
`role`) is naturally durable — it doesn't change just because today's org chart does. But
any fact **derived by joining to current state** is not durable. If "who was their manager
during this assignment" is answered by looking up the employee's *current* `reportingToId`,
or a department's *current* name, a reorganization five years later silently rewrites
history that should never change.

**The resolution — two rules, both required:**

1. **Assignment rows are never deleted, and never hard-mutated after the fact** — ending
   one sets `status: ENDED` with a real `endDate`; it does not disappear. This is already
   this app's established pattern (`Department` is deactivated, never deleted, for the
   identical reason — losing history to tidy up current state is a bad trade).
2. **Point-in-time facts get snapshotted onto the assignment row at creation, not derived
   live.** Specifically: the employee's `departmentId` and `reportingToId` *as of that
   moment*, and a plain-text label of the target *as of that moment* (so a Project or
   Department rename next year doesn't retroactively relabel a five-year-old record). This
   is the same principle most real-world systems use for point-in-time accuracy (an
   invoice snapshots the customer's billing address at the time of sale rather than joining
   to their current one) — applied here for the first time in this codebase, but not a new
   idea to it.

With both rules in place, "who worked on NS-108 five years ago, in what role, for how
long, under which manager" is answered entirely from that assignment's own row — no join
to today's Employee, Department, or Project state required, and no risk of today's
reorganization changing yesterday's answer.

---

## 7. Business workflows

(Consolidated from the initial proposal, unchanged in substance, restated for
completeness as part of one final blueprint.)

1. **Creation** is role-gated, matching how Department and Employee actions are gated
   today (plausibly ADMIN/HR org-wide, plus a Department Head or PMO-type role scoped to
   their own unit/project — the exact matrix is an implementation-time decision).
2. **Approval is required specifically when an assignment pulls an employee's time away
   from their own department head's control** (a loan out, or project staffing initiated
   by someone outside the employee's department) — routed through the existing Approval
   Engine via one new `ApprovalEntityType` value, decided by whoever holds `approverRole`
   for that context, exactly mirroring how `decideApproval`'s authorization is already
   fully data-driven today.
3. **While active**, the assignment is visible on both sides — the employee's profile and
   the target's roster (Project team section, or a Department's loaned-in/out view).
4. **Ending** — either the assignment reaches its planned `endDate` (computed live at
   read time, the way AMC contract status *should* be but historically wasn't in this
   codebase — deliberately not repeating that class of bug) or someone with edit rights
   ends it early with a note.
5. **Over-allocation is flagged, not hard-blocked**, matching this app's general posture
   of surfacing risk rather than rigidly gating it — a hard cap is a validation-logic
   decision that can be layered on later without any structural change, once real usage
   shows whether it's needed.

---

## 8. Future module integration — Review 6

How each named module consumes Workforce Assignment rather than duplicating the
employee-to-work relationship itself:

| Module | Consumes | Does **not** duplicate |
|---|---|---|
| **Skills Matrix** | Reads Assignment at staffing time to check role-fit against a target's skill needs | Skills stay Employee-owned; Assignment doesn't store them |
| **Certifications** | Same pattern — a gate/warning at assignment creation ("this certification expired, still assign them?") | Certification data stays its own record |
| **Training** | Optionally creates a thin `purpose=CAPACITY` assignment only when training meaningfully blocks capacity (§3) | Curriculum, pass/fail, and completion data stay entirely in Training |
| **Performance Reviews** | Reads assignment history to know who this person actually worked under/on during the review period — the exact historical-accuracy mechanism from §6 | Doesn't keep its own copy of reporting/project context |
| **Succession Planning** | Reads `role=LEAD/MANAGER` assignment history plus Skills/Certifications as a readiness signal | Doesn't re-derive org structure itself |
| **Recruitment** | Mostly upstream — a new hire's first Workforce Assignment (initial team/project placement) reuses this engine instead of a bespoke "new hire placement" step | — |
| **Timesheets** | Already has `projectId`; future cross-check of "are you logging time against something you're actually assigned to" | Timesheet keeps its own retrospective-hours purpose; Assignment is forward-looking, not a replacement |
| **Payroll** | Could read allocation percentages for labor-cost allocation across departments/projects — a real capability this data unlocks | Payroll doesn't duplicate assignment data — and per §6, it must read the *snapshotted* percentages for a closed pay period, never today's live state |
| **Attendance** | Stays independent (presence is orthogonal to allocation); could cross-reference "were they present during their assigned shift" | No structural dependency |
| **Production Planning** | Shop-floor staffing becomes Assignment rows once a Work Order target type exists (§14) | Doesn't invent its own "who's working on this" concept |
| **Maintenance** | Same pattern — a technician assigned to a Maintenance Work Order is an Assignment row | — |
| **Safety** | Looks up "who is currently in Workshop 3" via ORG_UNIT assignments for incident-context and safety-briefing purposes | Doesn't own or duplicate placement data |
| **Quality** | References the Project/Work Order (and, via Assignment, who worked on it) to attribute inspection findings | Doesn't keep its own staffing copy |
| **Executive Dashboards** | The ultimate consumer — every rollup (utilization, capacity, staffing, loan balance) is computed from Assignment plus the org-subtree primitive | Pure presentation layer, no new data of its own |

---

## 9. Cross-industry validation — Review 7

Testing the same architecture (targetType `PROJECT`/`ORG_UNIT`, `role`, `purpose`, `kind`,
`allocationPercent`) against six other industries, honestly assessing what would and
wouldn't need to change:

| Industry | How it maps | What's emphasized differently |
|---|---|---|
| **Hospital** | Ward rotations and shift coverage are `ORG_UNIT` + future `SHIFT` assignments; a clinical trial or research study can be a `PROJECT`. | Leans heavily on `ORG_UNIT`/`SHIFT`, less on `PROJECT` — validates that Shift matters well beyond manufacturing. |
| **Construction** | Nearly identical to OceanForge — site/project staffing, crew/trade department placement, temporary crew deployment between sites. | Closest analog to the primary use case; no adjustment needed. |
| **IT** | `PROJECT` = product/sprint initiative (a natural, already-familiar concept in this industry); `ORG_UNIT` = squad/team. | Strong `PROJECT`-centric fit; `SHIFT` still relevant for on-call rotations. |
| **Retail** | `ORG_UNIT` = store/department, `SHIFT` central (very shift-heavy industry), temporary loans for seasonal staffing between stores. | Leans on `ORG_UNIT`/`SHIFT`; `PROJECT` used narrowly (e.g., a store-opening initiative). |
| **University** | `ORG_UNIT` = faculty/department; `PROJECT` = a research grant, with `allocationPercent` mapping directly onto the real-world concept of "20% effort on Grant X" — arguably the cleanest real-world validation of the percentage-allocation design anywhere in this review. | Strong `PROJECT`-centric fit. |
| **Logistics** | `ORG_UNIT` = hub/warehouse/route team, `SHIFT` central, temporary staff deployment between hubs common. | Leans on `ORG_UNIT`/`SHIFT`. |

**Conclusion: yes, the same architecture holds across all six** without structural
changes — what varies by industry is simply which target type and `kind` values see
heavier use, exactly the kind of variation `type`-as-data (not schema) was already designed
to absorb in the Department model.

**One honest limitation surfaced by this exercise, not by the manufacturing-focused
reviews:** the existing `Project` model is CRM/client-delivery-shaped (`clientId`
required, `leadId`, `quotationId`, `productLine`, `industry` — all sales-pipeline fields).
A University research grant with no commercial client, or a purely internal manufacturing
Work Order, doesn't fit that shape cleanly today. This is named explicitly in §12 as a
deliberately deferred limitation, not something this phase needs to resolve — it likely
means a future, more general "Internal Initiative" concept sits alongside (not replacing)
the existing client-facing `Project` as a third assignable target, once that need is
concrete rather than hypothetical.

---

## 10. Performance considerations

- **Needed from day one:** indexes on `employeeId`, `(targetType, targetId)`, and
  `(status, startDate, endDate)` on the Assignment table — the §5 resource-planning
  queries are routine, not occasional, for a PMO Director, so this isn't an optimization
  to defer.
- **Deferred, revisit when needed:** the ancestor-path/closure-table optimization for
  fast org-subtree rollups (named in `ORGANIZATION_HIERARCHY_PROPOSAL.md` §3, reconfirmed
  relevant in §5 above for "which department is overloaded" at full multi-plant depth).
  Not needed at today's scale; becomes needed once Executive Dashboards (Phase D) are
  querying it constantly.
- **Deferred, revisit when needed:** time-sliced pre-materialized allocation records
  (Option C from the initial proposal's comparison) — only worth the write-side complexity
  once Capacity Planning needs fast multi-week-ahead forecasting queries that a plain
  date-range scan can't serve quickly enough.

---

## 11. Risks

- **Double-counting capacity if `purpose` is misapplied.** The entire "Team B doesn't add
  to the 100% ceiling" reasoning in §2 depends on whoever creates an assignment correctly
  choosing `CAPACITY` vs. `PLACEMENT`. Getting this wrong doesn't corrupt data, but it
  silently produces wrong utilization numbers — worth a clear default and UI guidance at
  implementation time (e.g., `PROJECT` targets default to `CAPACITY`, `ORG_UNIT` targets
  default to `PLACEMENT`, overridable).
- **Approval-routing ambiguity for cross-cutting assignments.** §7's rule ("approval
  required when time is pulled from the employee's own department head") is clear for the
  simple case; a cross-plant deployment initiated *by* the losing department head has no
  natural second approver under that rule. Worth a concrete decision at implementation
  time, not a schema concern.
- **Snapshot fields going stale relative to the *live* relations they're near.** The
  point-in-time snapshot (§6) must be write-once; any future refactor that "helpfully"
  updates it on a later edit would silently reintroduce the exact historical-accuracy bug
  this design exists to prevent. Worth a very visible comment/guard at implementation
  time, not just a convention.
- **`Project`'s CRM-shaped fields limiting non-sales use cases** (§9) — a known,
  explicitly deferred limitation, not a blocker for the manufacturing/project-staffing
  use case this phase targets.

---

## 12. Things deliberately not supported (by design, for now)

- Committee/representative membership as a first-class Workforce Assignment concept
  (§1.3).
- Mentor/mentee pairing (§1.3).
- Internal, non-client-facing initiatives that don't fit today's `Project` shape (§9) —
  usable as a `PROJECT` target only to the extent a tenant is willing to stretch the
  existing model (e.g., an internal client-less initiative could use a placeholder
  internal "client" record); a proper fix is deferred, not solved here.
- A hard cap preventing over-100% allocation (§7) — flagged, not blocked, until real usage
  shows a hard cap is actually wanted.
- Fast org-subtree rollups and time-sliced forecasting (§10) — both explicitly deferred
  performance optimizations, not missing correctness.

---

## 13. Future extensibility

New target types are added the same low-friction way `ApprovalEntityType` has already
grown once (3 → 4 values, for `PAYMENT_CONFIRMATION`) — an additive enum value plus one
new case wherever `targetType` is switched on, never a redesign of the Assignment
structure itself:

- **`SHIFT`** — once Shift Planning (Phase 7) exists, `purpose=SCHEDULE`.
- **`WORK_ORDER`** — once Manufacturing (Phase 9) exists, shop-floor and maintenance
  staffing become Assignment rows the same way project staffing already is.
- **`TRAINING`** — conditionally, per §3, only for capacity-blocking training.

The `role` and `purpose` classifications introduced in this review are themselves small,
closed, additive enums — extending either (a new `role` value for a specialized function,
a new `purpose` value if a genuinely new capacity-treatment emerges) never requires
touching the core `employeeId`/`targetType`/`targetId`/dates/status shape.

---

## 14. Recommended implementation phases

Within your own Phase 4 (Workforce Foundation), sequenced so each step is independently
useful and nothing is built before what it depends on:

1. **Core Assignment structure** — `employeeId`, `targetType`(`PROJECT`|`ORG_UNIT`),
   `targetId`, `role`, `purpose`, `kind`, `allocationPercent`, dates, `status`, snapshot
   fields, `note`. No UI yet.
2. **Approval integration** — the new `ApprovalEntityType` value and `decideApproval`
   case, reusing the existing engine end to end.
3. **Core UI** — creation flow (from both a Project's team section and an Employee's
   profile), the Employee "Assignments" section, the Project "Team" section — mirroring
   existing patterns (Recent Attendance/Leave/Payroll History cards; Department's
   dual-entry-point create/edit pattern).
4. **Resource-planning queries** — the §5 queries, surfaced first as data (API/query
   layer), dashboards deferred to Phase D per `GAP_ANALYSIS.md`.
5. **Supervisor/utilization views** — the derived-relationship lookups from §2 (current
   supervisor, project manager, department loan balance), which depend on step 1–3 having
   real data to derive from.

Everything past this point (Shift as a target type, Work Order as a target type, hard
allocation caps, closure-table rollups) is explicitly deferred to the phase that actually
needs it, per §10–§13.

---

## 15. Governance — freezing this architecture

Per your explicit direction: **once this document is approved, Workforce Assignment is
frozen as the one employee-to-work relationship model in this ERP.** Every future module
that needs to know "who is working on what, for whom, since when" — Skills Matrix,
Training, Manufacturing, PMO, Capacity Planning, and anything not yet named — is expected
to consume this table (per §8's pattern: read from it, extend it additively via new
`targetType`/`role`/`purpose`/`kind` values when genuinely needed) rather than invent a
parallel employee-to-work relationship of its own. This is the same discipline the
Approval Engine has already proven out across four unrelated entity types in this codebase
— the goal is for Workforce Assignment to become that same kind of foundation, not a
one-off feature.

---

No code, schema, or migrations accompany this document. This is the implementation
blueprint — awaiting your approval before any implementation work begins.
