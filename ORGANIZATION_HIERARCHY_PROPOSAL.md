# Organization Hierarchy & Workforce Foundation — Design Proposal

Date: 06 Aug 2026. Status: **proposal only — nothing in this document has been implemented.**
No schema changes, migrations, or code accompany this file. It exists to be reviewed and
approved before any implementation work starts, per the phase instructions.

Target customer in mind throughout: **OceanForge Naval Systems** — large manufacturing,
multi-branch, multi-plant, multiple workshops, multiple sections, multiple teams — while
keeping the model generic enough for construction, healthcare, IT, logistics, education,
and retail.

---

## 1. Organization Hierarchy

### The question

Is the `Department` model (self-referencing, `OrgUnitType` enum: `BUSINESS_UNIT →
DIVISION → BRANCH → PLANT → DEPARTMENT → SECTION → TEAM`, shipped in the phase just
closed) sufficient as the one org-hierarchy backbone, or does the platform need a separate
`Organization Unit` entity chain alongside it?

### Two approaches compared

**A — Fixed entity chain**, one table per level:
`Company → Branch → Plant → Division → Department → Section → Team`, each with its own
table and FK to the level above.

- *For:* each level can carry level-specific fields without a shared, mostly-null column
  set (a Plant might want a physical address; a Team never would). The FK chain is a
  compile-time guarantee — a Team literally cannot be assigned as a Plant's parent, because
  there is no FK path that allows it.
- *Against:* every tenant is forced through every level, or every level needs a
  skip-level nullable FK to its grandparent — which is the self-referencing model again,
  just spread across seven tables. A company that only needs "Department" and "Team" still
  carries five empty intermediate tables. Adding an eighth level for a customer that needs
  one (a Shift under a Team, a Region above a Branch) is a schema migration. Every
  cross-cutting concern — org-scoping, active/inactive filtering, the parent index, cycle
  prevention, headcount rollups — has to be built and tested seven times instead of once.

**B — Single self-referencing model** (what `Department` already is):
one table, a `type` column marking which conceptual level a row represents, a nullable
`parentId` self-relation, arbitrary depth.

- *For:* depth is a data decision, not a schema decision — a new level is a new row with a
  new (or repeated) `type` value, not a migration. One relation to secure, filter, and
  index. A five-person company and a 5,000-person multi-plant manufacturer use the exact
  same schema, just different tree shapes.
- *Against:* the guarantees move from compile-time to run-time. Nothing in the database
  stops someone from nesting a `BUSINESS_UNIT` under a `TEAM`; that has to be caught in
  application code (or simply left as a soft constraint an admin is trusted not to violate,
  the same way the app already trusts admins with dozens of other unenforced business
  rules — see CLAUDE.md's "Known business-rule quirks" section). Level-specific fields
  either go on a single shared table (mostly-null columns for fields that only apply to
  some levels) or into a separate side-table keyed by department ID, added only when a
  specific level-specific field is actually needed.

### Recommendation: **B — keep the current self-referencing `Department` model as the one
org-hierarchy backbone. Do not introduce a separate Organization Unit entity chain.**

This is a direct continuation of the decision already made and shipped in the
Organization Foundation phase (see `DEPARTMENT_ARCHITECTURE.md` §2), not a new one. It is
restated and re-evaluated here across industries specifically because building a parallel
"Organization Unit" chain next to `Department` would violate two rules from this project's
own working agreement: *"avoid introducing parallel master-data systems"* and *"reuse
existing patterns."* `Department` already **is** the generic organization-unit model the
second diagram in the phase brief describes — it doesn't need a sibling, it needs to be
recognized as already filling that role.

**The key reframe that makes this work across every industry:** `type` is a *structural
depth marker*, not an industry vocabulary label. The label a business actually uses lives
entirely in `name`. A hospital's "Radiology Ward" is `type: SECTION, name: "Radiology
Ward"`. A retailer's "Downtown Store" is `type: BRANCH, name: "Downtown Store"`. Nothing
about the `OrgUnitType` enum's naming (`PLANT`, `BRANCH`) needs to literally match a given
industry's terminology, because the UI never shows raw enum values to an end user in a
context where the mismatch would matter — it shows `name`.

Walking through the seven target industries against the existing seven-level model,
without any schema change:

| Industry | Company → ... → Team, mapped onto existing levels |
|---|---|
| **Manufacturing** (OceanForge) | Company → Branch (region) → Plant → Division → Department → Section (workshop) → Team |
| **Construction** | Company → Branch (region) → Plant (project site) → Department (Civil/Electrical/Safety) → Section → Team (crew) |
| **Healthcare** | Company (hospital group) → Branch (facility) → Department (Cardiology, Radiology) → Section (ward) → Team (shift team) |
| **IT** | Company → Division (region/BU) → Department (Engineering/Product/Sales) → Team → Team (squad, nested one level deeper) |
| **Logistics** | Company → Branch (region) → Plant (hub/warehouse) → Department (Inbound/Outbound/Fleet) → Team |
| **Education** | Company (institution) → Branch (campus) → Division (faculty/school) → Department (academic dept) → Section (class section) |
| **Retail** | Company → Division (region) → Branch (store) → Department (Grocery/Electronics) → Team (shift team) |

Every one of these fits inside the seven levels already defined, in the order they're
already defined in, with zero migrations. Where an industry's natural depth is shallower
(a small IT company might only ever use Department → Team), the unused levels are simply
never instantiated — there's no penalty for skipping them, because nothing forces a tenant
through every level (§2 of the closed phase's architecture doc already makes this same
point about company size; it applies identically across industries).

**One open consideration, not a blocker:** if a future customer's vocabulary genuinely
doesn't fit any of the seven existing `type` values even as a depth marker (this seems
unlikely given the mapping above, but is worth naming), the fallback is adding one more
enum value — a small, additive migration, not a redesign. That is a fundamentally
different and much cheaper kind of change than the fixed-chain approach's failure mode
(a new *table* and a new FK relation for every unanticipated level).

---

## 2. Reporting Structure

### What already exists

Two relationships already do real work here, and they represent two genuinely different
concepts that the current schema correctly keeps separate:

- **`Employee.reportingToId`** — the self-referential "who is my line manager" relation.
  Drives the org chart (`/hrms/org-chart`) and the computed "is this person a manager"
  check (`Employee.count({ reportingToId: employeeId }) > 0` — notably *not* a stored role,
  computed on demand, exactly the lightweight pattern this section should extend rather
  than replace).
- **`Department.headId`** — who administratively leads a given org unit. This is
  deliberately a *different* relation from `reportingToId`: a department's head is not
  necessarily the direct-line manager of every person in that department (in a large
  department, most people report to a team lead who reports to the head, not straight to
  the head). The phase just closed kept these as two independent relations to `Employee`
  specifically because they answer different questions — "who runs this unit" vs. "who do
  I report to."

### The matrix-reporting gap

Administrative Manager and Department Head are already covered by the two relations above.
**Functional Manager** and **Project Manager** are not — an OceanForge engineer might
administratively sit in "Engineering Department" (`reportingToId` → their department's
team lead) while functionally taking direction from a Project Manager for the duration of
a specific project, and that second relationship needs to exist *concurrently* with the
first, not replace it, and needs to end when the project does.

**Recommendation: do not add more manager-shaped foreign keys to `Employee`.** A second
FK (`functionalManagerId`) solves exactly one matrix dimension and breaks the moment a
third (a dotted line to a Skills/Competency lead, say) shows up — this is the same reason
the closed phase rejected a fixed entity chain for org units: hard-coding a fixed number of
relationship *slots* doesn't survive contact with real organizational complexity.

Instead, matrix and project-based reporting is a **time-bound assignment**, not a
permanent structural fact about an employee — which is exactly the shape of relationship
this codebase already has a proven, generic pattern for: the **Approval Engine**
(`ApprovalRequest`, entity-type + entity-ID + role, one generic table serving Purchase
Orders, Expense Claims, and Budgets without a dedicated table per entity type). A future
**Workforce Assignment** concept, built the same way — "this employee, assigned to this
Team/Project, in this capacity, from this date to that date" — would let a Project Manager
relationship, a temporary cross-department loan, or a dotted-line functional report all be
represented as rows in one table instead of a growing set of nullable FK columns on
`Employee`. This directly answers §3's "without duplicating relationships" question too:
one assignment shape, reused for every kind of temporary or many-to-many working
relationship, rather than a bespoke join table per feature.

This is **not proposed for implementation now** — it's named here because Reporting
Structure and Workforce Allocation (§3) are really the same underlying gap, and it would be
a mistake to design them as if they were unrelated problems.

---

## 3. Workforce Allocation

### Structural home vs. participation — two different questions

An employee's relationship to the organization actually has two distinct shapes, and
conflating them is the most common way this kind of model ends up duplicated:

1. **"Where do I structurally belong?"** — a single answer at any point in time. This is
   exactly what `Employee.departmentId` already is, and it already generalizes to any level
   of the hierarchy (a `Department` row with `type: TEAM` is still just a `Department` row
   — an employee's "home" can be pinned at whatever depth the org actually manages people
   at, Division or Team, without a different field for each level). **No change needed
   here.** Walking `parentId` upward from an employee's home department already answers
   "which Plant/Branch/Business Unit are they under" without a second relationship.

2. **"What am I currently working on, and with whom?"** — potentially many concurrent
   answers, each with a start and (usually) an end date: Project A at 60%, Project B at
   40%, a temporary loan to another Team for a month. This is where **Projects** enter —
   and today, `Project` has no membership concept at all; only `ProjectTask.assigneeId`
   exists, which answers "who owns this task," not "who is staffed on this project."

**Recommendation:** keep `Employee.departmentId` exactly as it is for structural home
membership — it's already correct and already general. Add project/team *participation* as
the same generic Workforce Assignment concept named in §2, rather than a
`Project`-specific membership table. One assignment shape covers: project staffing,
temporary team loans, and (per §2) functional/matrix reporting — because all three are the
same underlying fact ("this person, this unit-or-initiative, this capacity, this time
window") wearing different labels.

### A rollup cost worth naming now, deciding later

Because `Department` is a tree, "how many employees roll up under this Business Unit"
requires walking `parentId` down through every descendant, not a single indexed lookup.
For the volumes this platform runs today, that's a non-issue. It stops being a non-issue
the moment Executive Dashboards (§4) need fast, frequent rollups across a deep OceanForge-
scale tree. The standard fix — a materialized ancestor path or a closure table, kept in
sync whenever `parentId` changes — is a well-understood, additive change (new column or new
table, populated from the existing tree, nothing about the existing relations moves). It is
called out here so it's on record as a known, deferred piece of technical design, not
discovered as a surprise mid-way through building dashboards. **Not proposed for
implementation now** — the phase-closure principle applies here too: build it when a real
read pattern needs it, not speculatively.

---

## 4. Future Integration

How the design above (self-referencing `Department` as the org-hierarchy backbone,
structural home via `departmentId`, participation via a future generic Workforce
Assignment) accommodates each named future module, without redesigning anything proposed
above:

- **Skills Matrix** — skills are owned by the *person*, not the org unit (`Employee` is the
  natural anchor), but every "which skills does Engineering have" or "which Plant is short
  on certified welders" report is just a filter through `Employee.departmentId` — the
  hierarchy is a reporting dimension a Skills Matrix consumes for free, not something it
  needs to model itself.
- **Certifications** — same shape as Skills, with an expiry date. Worth explicitly learning
  from a documented gap in the current app: `AmcContract.status` and `VendorPayment`'s
  `OVERDUE` status are both static values set once and never recomputed as real time
  passes (see CLAUDE.md's "Known business-rule quirks," items 3–4). A Certifications
  feature should compute "expired / expiring soon" live from the stored expiry date on
  every read, the same fix already applied elsewhere in this codebase for that exact class
  of bug — not repeat it.
- **Training** — structurally similar to the existing `EmployeeDocument` pattern (owned by
  an Employee, optionally tagged with which org unit ran or required it). No new hierarchy
  concept needed.
- **Workforce Planning** — "budgeted headcount for Department X next quarter" is a natural
  sibling to the `Budget` model, which already carries a `departmentId` FK from the phase
  just closed. Rather than overloading `Budget` (which is about money, via
  `ExpenseCategory`, not headcount), a distinct lightweight entity — target headcount, org
  unit, time period — reuses the exact same `Department` dimension `Budget` already uses,
  keeping the two comparable (planned spend vs. planned headcount, same org-unit axis)
  without merging two different kinds of "plan" into one table.
- **Project Resource Allocation** — this *is* §3's Workforce Assignment concept, applied to
  Projects specifically: percentage allocation, date range, role, employee, project. Named
  once, reused everywhere it's needed, rather than built separately for this specific case.
- **Shift Planning** — which shift a Team or employee is on is a new, orthogonal dimension
  (time-of-day/rotation, not org placement), but it filters and groups by the *existing*
  hierarchy exactly the way headcount and budgets already do — a Shift Planning feature
  reads `Department`/`Team` as an input, it doesn't need its own parallel structure.
- **Executive Dashboards** — the one place where the rollup-cost consideration from §3
  becomes concrete. Once this phase is real, that's the trigger point for the
  ancestor-path/closure-table optimization named above — not before.

The throughline across all six: none of them need their own org-structure concept. Every
one of them either anchors on `Employee` and uses `Department` purely as a filter/reporting
dimension, or anchors on the future generic Workforce Assignment concept. That's the
practical test of whether the hierarchy design proposed in §1 is actually sufficient — and
by that test, it is.

---

## 5. Summary recommendation

1. **Keep `Department` (self-referencing, `OrgUnitType`) as the single organization-unit
   backbone.** Do not build a separate Organization entity chain. It already generalizes
   across all seven target industries with zero schema changes, because `type` is a depth
   marker and `name` carries the industry vocabulary.
2. **Keep `reportingToId` (line management) and `Department.headId` (unit leadership) as
   two separate, already-correct relations.** Don't merge them.
3. **Do not add more manager-shaped foreign keys to `Employee` for matrix/functional/
   project reporting.** Design (not yet build) a single generic Workforce Assignment
   concept — modeled on the existing Approval Engine's entity-type/entity-ID pattern —
   that covers project staffing, temporary team loans, and matrix reporting as one shape.
4. **Keep `Employee.departmentId` exactly as-is** for structural home membership; it
   already generalizes to any hierarchy depth and needs no change.
5. **Defer the ancestor-path/closure-table rollup optimization** until Executive
   Dashboards (or any other feature needing fast cross-tree rollups) is actually being
   built — it's a known, additive, low-risk change whenever it's needed, not a
   prerequisite now.

None of the above has been implemented. Awaiting review before any schema or code work
begins on this phase.
