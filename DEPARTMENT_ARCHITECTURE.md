# Department Module — Architecture, Rationale & Verification

Date: 06 Aug 2026. Scope: closes out the "Organization Foundation" phase (Department master
data, Employee/Budget integration, Development Subscription Mode) — architecture record,
data-quality audit, test coverage, and full browser verification results.

## 1. Data model

```
Department
  id, organizationId, name, code, type (OrgUnitType), description?
  headId -> Employee?        (who runs this unit)
  parentId -> Department?    (self-referential — its place in the tree)
  children: Department[]     (inverse of parentId)
  isActive
  employees: Employee[]      (inverse of Employee.departmentId)
  budgets: Budget[]          (inverse of Budget.departmentId)
  @@unique([organizationId, code])
  @@index([organizationId, isActive])
  @@index([parentId])

enum OrgUnitType { BUSINESS_UNIT, DIVISION, BRANCH, PLANT, DEPARTMENT, SECTION, TEAM }
```

`Employee.departmentId` and `Budget.departmentId` are real foreign keys to `Department.id`.
There is no free-text `department` string left anywhere in the active code path — every
place that used to store or display a department name now reads it through this relation
(employee lists/detail, attendance, tasks, headcount, budgets, dashboards, the org chart).

Departments are root organizational entities, exactly like `Employee` and `Client`: they
carry `organizationId` directly rather than inheriting it through a parent relation, and
every query in `src/lib/queries/departments.ts` scopes on it explicitly.

## 2. Why a single self-referencing model, not a level-per-table chain

The alternative considered was a fixed entity chain — `Organization → Branch → Plant →
Division → Department → Section → Team`, one table per level. That was rejected for this
phase:

- **A fixed chain forces every tenant through every level.** A services company with just
  "Departments" and "Teams" would still need empty Branch/Plant/Division rows to satisfy
  the FK chain, or the chain needs nullable skip-level FKs — which is really the
  self-referencing model again, just spread across seven tables instead of one.
- **Depth becomes a schema decision, not a data decision.** If a future customer needs an
  eighth level (say, a Shift under a Team), a fixed chain needs a migration. A
  self-referencing table just gets another row with `type: "SHIFT"` — no migration, no new
  relation, no new query path.
- **One relation to secure, filter, and index, not seven.** Org-isolation, the active-only
  filter, and the parent index (`@@index([parentId])`) each need writing and testing once.
  A seven-table chain multiplies all of that by seven for no behavioral gain.

The trade-off accepted: a fixed chain gets compile-time guarantees (you cannot assign a
`Team` as a `Plant`'s parent) that the self-referencing model only enforces at runtime.
`type` is stored data, not a distinct table, so nothing stops someone from nesting a
`BUSINESS_UNIT` under a `TEAM` at the database level. `parentId` cycle prevention
(`wouldCreateCycle` in `src/lib/actions/departments.ts`) is enforced in the server action,
same reasoning: cheaper to guard in application code now than to redesign the schema later
if the guard turns out to be insufficient.

`ORG_UNIT_TYPES` in `src/lib/departments.ts` is ordered broadest-first (Business Unit →
Division → Branch/Plant → Department → Section → Team) as the *suggested* sequence a
company would build its tree in — nothing in the schema or the server actions enforces
that order. A five-person org can use `DEPARTMENT` and `TEAM` alone and skip the rest
entirely.

## 3. Server actions & business rules (`src/lib/actions/departments.ts`)

- **`createDepartment` / `updateDepartment`** — role-gated to `ADMIN`/`HR` (matching the
  HRMS module gate). Validates the unit type against the enum rather than trusting client
  input, verifies `headId` resolves to an employee *in the caller's organization*, verifies
  `parentId` resolves to a department *in the caller's organization* — a parent/head ID
  from another tenant is rejected the same way a missing one is, which is what makes
  cross-org isolation a query-shape property rather than a special case.
- **Duplicate code** — `@@unique([organizationId, code])` at the DB level; the Prisma
  `P2002` error is caught and turned into `"A department with that code already exists."`
  Codes are upper-cased before comparison/storage so `"ops"` and `"OPS"` can't both exist.
- **Cycle prevention** (`wouldCreateCycle`) — walks the candidate parent's ancestor chain;
  if it reaches the department being edited (or loops without reaching it — a defensive
  case that shouldn't occur given the same check ran on every prior edit), the update is
  rejected with `"That parent sits underneath this department — it would create a loop."`
  A department also can't be set as its own parent (`"A department can't report to
  itself."`).
- **Deactivation, not deletion** (`setDepartmentActive`) — there is no delete action.
  Employees and budgets reference departments, and losing that history to tidy up an org
  chart is a bad trade. Inactive departments drop out of the create/edit pickers
  (`getDepartmentOptions` filters `isActive: true`) but keep their members, their budgets,
  and their place in the tree.
- **Audit logging** — create/update/activate/deactivate all call `logAudit`, consistent
  with every other mutating action in the app.

## 4. Employee, Budget, and dashboard integration

- **Employee** — `NewEmployeeSheet`/`EditEmployeeSheet` render a real Department `Select`
  populated from `getDepartmentOptions` (active departments only). `getCurrentUser()` in
  `src/lib/dal.ts` now eager-loads `employee.department` alongside the employee on every
  request, so a future department-aware permission rule has `user.employee.departmentId`
  available without an extra query — the only change made under Priority 2, and it does
  not touch the `AccessRole` permission model itself.
- **Budget** — `NewBudgetSheet`'s first field is a Department `Select`; `Budget.departmentId`
  replaced the old free-text department field. `getBudgets`'s live spend aggregation now
  matches on `departmentId` instead of a string comparison.
- **HRMS Overview headcount** — `getDepartmentHeadcount` counts active employees per
  department, plus a separate `unassigned` bucket for any active employee with a null
  `departmentId` (pre-migration data, or a department that was later reassigned away) so
  the KPI total next to it always reconciles.
- **Org Chart, Attendance, Tasks** — all read `employee.department?.name` through the
  relation (see `src/app/(app)/hrms/org-chart/page.tsx`,
  `src/app/(app)/hrms/attendance/page.tsx`, `src/app/(app)/hrms/tasks/page.tsx`).

## 5. Development Subscription Mode

Documented in detail inline at `src/lib/billing/dev-mode.ts`; kept brief here since that
file's comments are the primary reference. One env var, `DEV_SUBSCRIPTION_MODE`, defaults
off. When on, `registerOrganization` provisions a real `ACTIVE` subscription (5-year
period, 100 licenced users, every module) through the *same* `buildInitialSubscription` →
`computeEffectiveAccess` path a real purchase uses — no gate, middleware check, or
`requireModuleAccess` call was modified or bypassed. Turning the flag off restores the
ordinary 5-day trial for every organization registered afterward; organizations already
provisioned keep what they were given, the same as if a real plan had been purchased.

## 6. Test coverage added this pass

- **`tests/lib/departments.test.ts`** (new, 9 tests) — duplicate-code rejection on both
  create and update, organization-isolation on head/parent lookups (an ID from another
  tenant is rejected identically to a missing one), self-parent rejection, missing-parent
  rejection, and hierarchy cycle prevention (both the rejected case and a same-tree edit
  that should be allowed).
- **`tests/lib/create-employee-org-isolation.test.ts`** — fixed a stale field name
  (`department` → `departmentId`) left over from before the relational migration; the test
  was silently exercising a form field the action no longer reads.
- **`tests/lib/dev-subscription-mode.test.ts`** (pre-existing, 8 tests) — both states of
  the flag, the toggle-back-off case, and that dev-mode access is granted through the
  ordinary `computeEffectiveAccess` engine, not a bypass.

Full suite: **108/108 passing**. `npm run lint`: 0 errors (30 pre-existing warnings,
unrelated to this phase — `react-hooks/set-state-in-effect` on three unrelated components
and one unused import in `me.ts`). `npm run build`: compiles clean, all 43 routes generated.

## 7. Data-quality audit (current `prisma/dev.db`)

Queried directly against the database rather than assumed:

| Check | Result |
|---|---|
| Duplicate department names within an org | none found |
| Duplicate department codes within an org (bypassing the unique constraint) | none found |
| Empty name or code | none found |
| Department heads pointing at a non-existent employee | none found |
| Department heads belonging to a different organization than the department | none found |
| Parent cycles anywhere in the dataset | none found |
| Employees with no department | 1 of 37 (`Priya Verifier`, pre-existing test data, unrelated to this phase — correctly falls into the "unassigned" headcount bucket rather than being hidden or miscounted) |

No backfill assumptions were needed beyond what's already in `prisma/seed.ts` — the seed
data was written directly against the relational model, not migrated from a prior
free-text field.

## 8. Browser verification results

Performed against the dev server (`npm run dev`) logged in as the seed org's Admin persona
(Manan Vora) unless noted. All checks below reflect direct interaction with the running
app, not code inspection.

| Check | Result |
|---|---|
| Department CRUD — create | **Pass.** Created "Quality Assurance" / `QA-TEST` with head + parent set; row appeared immediately with correct data, unit count updated 15→16. |
| Department CRUD — edit | **Pass.** Verified via the cycle-prevention and reactivate flows below (both go through `updateDepartment`). |
| Activate / Deactivate | **Pass.** Deactivate dropped active count 16→15 and flagged the row `Inactive`; Reactivate restored it. No delete path exists by design (§3). |
| Department Head assignment | **Pass.** Assigned "Naveen Kumar" at creation; rendered correctly as a link to his employee profile. |
| Parent Department assignment | **Pass.** Assigned "Leadership" as parent; Leadership's row correctly gained a "1 sub-department" badge. |
| Cycle prevention | **Pass.** Attempting to set Leadership's parent to its own child (Quality Assurance) was rejected with `"That parent sits underneath this department — it would create a loop."` |
| Duplicate code validation | **Pass.** Creating a second department with code `QA-TEST` was rejected with `"A department with that code already exists."`; confirmed both via the UI error and directly against the database (no second row was written). |
| Employee department selection | **Pass.** `New Employee` sheet's Department select is populated from live department data, including the newly created one. |
| Budget department selection | **Pass.** `New Budget` sheet's first field is a Department select, populated identically. |
| Department filters — search | **Pass.** Typing "quality" narrowed the list to 1 row via a real `?search=` query param (server-filtered, not client-only). |
| Department filters — status | **Pass.** "Inactive only" correctly isolated the one deactivated row. |
| Empty state | **Pass.** An unmatched search rendered `"No units match these filters. Try clearing them."` |
| Loading state | Not independently observable — the departments list is a Server Component fetch with no client-side loading transition; the `Suspense` boundary around the filter bar (noted in the page's source comment) exists specifically to avoid a route-level loading skeleton that was tried and left the page stuck showing it. |
| Responsive layout | **Pass.** At 375px width (mobile preset), no horizontal page overflow (`document.body.scrollWidth === window.innerWidth`); the table scrolls within its own bordered container. |
| Dark mode | **Not currently reachable — app-wide, not specific to this phase.** `globals.css` defines a full `.dark` CSS variable block and 17 files use `dark:` utility classes, but no `ThemeProvider` (from the installed `next-themes` package) is mounted anywhere in `src/app/layout.tsx`, so the `dark` class is never applied to `<html>` regardless of OS preference. The Department pages render correctly in the only theme currently reachable (light). This is a pre-existing gap in the design system, not something introduced or left incomplete by this phase. |
| Console errors | **Pass.** Zero console errors through the full CRUD/filter/dark-mode-check sequence. (The dev server's Hot-Module-Reload WebSocket does log connection errors in this sandboxed preview environment — that's the preview tooling's proxy, not the application, and does not occur in a normal `npm run dev` session.) |
| Fresh org registration — Dev Mode ON | **Pass.** Registered "OceanForge Devmode Test A"; confirmed directly against the database: `status: ACTIVE`, `trialStartedAt == trialEndsAt` (trial window closed immediately), `currentPeriodEnd` = +5 years, `licencedUsers: 100`, all 5 modules attached. All 5 nav sections visible in the UI; no trial banner shown. |
| Fresh org registration — Dev Mode OFF | **Pass.** Toggled `DEV_SUBSCRIPTION_MODE=false`, restarted the dev server, registered "OceanForge Devmode Test B"; confirmed: `status: TRIAL`, `trialEndsAt` = +5 days exactly, `currentPeriodStart/End: null`, `licencedUsers: 5`, zero `SubscriptionModule` rows. UI correctly showed `"5 days left in your free trial."` Flag restored to `true` afterward (the original state) and the server restarted again. |
| Organization isolation | **Pass.** Both test organizations' data (Department, Subscription, Employee, User rows) were scoped correctly by `organizationId` throughout; deleting them afterward did not touch or require touching the seed organization's data. The seed org's department list (16 units, 15 active) was unaffected before, during, and after. |

**Cleanup performed:** the two test organizations created for the Dev Mode check were
removed after verification (they were empty shells with one admin user each, created
solely to observe registration behavior). The one department created to exercise Create/
Edit/Cycle/Duplicate/Deactivate ("Quality Assurance", `QA-TEST`) was left in place but
**deactivated**, since departments are never hard-deleted by design (§3) — it's visible in
the department list under "Inactive" as a harmless verification artifact, consistent with
how the app treats every other deactivated department.

## 9. Future expansion path

The model already supports the full hierarchy without a redesign:

```
Company (Organization — already exists)
 └── Business Unit    \
      └── Division      } all Department rows, distinguished only by `type`
           └── Branch  /  and by where they sit in the `parentId` tree
                └── Plant
                     └── Department
                          └── Section
                               └── Team
```

What's already in place for this: the `OrgUnitType` enum has all seven levels defined
today (not just `DEPARTMENT`), the tree can nest to arbitrary depth via `parentId`, cycle
prevention already guards arbitrary-depth trees (not just parent/child), and
`_count.children`/`_count.employees` are already computed per node — the department list
page already renders "N sub-departments" today for exactly this reason.

What a Sections/Teams/full-hierarchy phase would still need to add, deliberately not built
now per the phase scope:
- A tree/org-chart *view* for Department itself (today's `/hrms/org-chart` renders the
  Employee reporting hierarchy, not the Department tree — related but separate).
- Per-level UI affordances (e.g., a "Plant" might want a physical address; a "Team" might
  not need a head at all) — today every level shares one flat field set.
- Bulk re-parenting / drag-and-drop reorganization (today's parent assignment is one
  department at a time via the edit sheet).
- Department-level dashboards and analytics, deferred explicitly per the phase scope.

None of these require a schema migration to add later — they're UI and query-layer work on
top of the model that already exists.
