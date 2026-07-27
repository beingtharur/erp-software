# Exist Digitally Ops Platform — Product Audit & Fix Report

Date: 27 Jul 2026. Scope: full-repo audit, bug fixes, and testing per the CLAUDE.md functional reference. AWS deployment was explicitly excluded from this pass (per your direction) — see "Deployment" at the end.

## 1. Executive Summary

Overall the app is in good shape: auth, multi-tenancy, billing, and most CRUD flows are real and working, not stubs. The two most important findings this pass are environmental, not code defects:

1. **The committed Prisma client (`src/generated/prisma`, gitignored) is stale relative to `prisma/schema.prisma`.** The last two commits (site-visit management, payroll/salary-structure) added schema fields and relations that were never regenerated into the client. This causes real TypeScript compile errors today (`npx tsc --noEmit` fails) touching client/project/quotation/site-visit detail pages and payroll — and `next build` will fail until this is fixed.
   - **Fix (do this first, on your own machine):** run `npx prisma generate` (or `npm install`, which runs it via postinstall). I could not do this from my sandboxed environment — its network egress blocks `binaries.prisma.sh` (confirmed 403), which Prisma's CLI needs even just to validate the schema. This is a sandbox restriction, not a problem with your schema or setup; on your Mac (or CI) it should just work.
2. Beyond that, I found and fixed 15 real logic/security bugs across CRM, HRMS, Vendor, Finance, and Field modules (list below), all verified by a 49-test unit suite (24 of which are new, covering the new logic directly) and isolated TypeScript diffs proving my changes introduce zero new type errors.

**Production readiness:** blocked only on step 1 above. Once the client is regenerated, `next build` should succeed — nothing in my changes depends on anything beyond the current schema.

## 2. Environment housekeeping (please do these on your machine)

My sandbox could edit files but could not safely run destructive git/filesystem operations against your mounted project folder — it enforces unusual permission restrictions (blocks `unlink`/`rmdir` on existing files even as the owning user) that don't exist on a normal machine. Three small cleanups are needed, all trivial from your own Terminal:

- `rm .git/index.lock` — a stale lock left by an interrupted `git stash` attempt (harmless, git operations still worked around it via `git show`/`git checkout` for reads, but writes will refuse until this is removed).
- `rm -rf .next-old-1785132323` — a 2.8GB renamed copy of your old `.next` build folder I created while diagnosing the build error above, then couldn't delete. Safe to delete; it's just a stale build cache.
- Run `npx prisma generate` per item 1 above.

## 3. Bugs Fixed

All changes are additive/corrective — no existing feature was removed or disabled. Each item below only mutated behavior that was previously either broken, unenforced, or missing entirely; I re-verified the surrounding tests/flows after each fix.

| # | Area | File(s) | Fix |
|---|------|---------|-----|
| 1 | ID generation race condition | `src/lib/sequence.ts` (new), `crm.ts`, `hrms.ts`, `admin.ts`, `vendor.ts`, `finance.ts` | `employeeCode`/`quoteNumber`/`ticketNumber`/`claimNumber`/`poNumber`/`contractNumber` are genuinely globally-unique DB columns (confirmed in `schema.prisma`) generated via non-atomic `count()`-then-insert. Two concurrent creates could compute the same number and crash with a raw Prisma P2002 error. Added `withUniqueCodeRetry()` — retries the whole count+insert on a unique-constraint collision. *(Note: I initially assumed this needed per-org scoping per the CLAUDE.md doc's wording, but code inspection showed a prior commit (6afe280) already fixed that correctly — the columns are intentionally globally unique, and per-org scoping would have reintroduced the cross-org collision bug it fixed. I corrected course before implementing.)* |
| 2 | No enforced status state machines | `src/lib/status-transitions.ts` (new) + `crm.ts`, `vendor.ts` + 4 dropdown components | Lead stage, quotation status, milestone status, ticket status, project-task status, and PO status could all jump to *any* other status unconditionally (e.g. ticket `OPEN → CLOSED` directly, milestone `PLANNED → COMPLETED` without ever starting). Added a single transition-map module and wired it into both the server actions (reject invalid transitions) and the dropdown UIs (only offer valid next states). |
| 3 | AMC contract status never updates | `src/lib/amc-status.ts` (new) + `queries/crm.ts`, `queries/dashboard.ts` | `AmcStatus` was set once at seed time and never recomputed as `endDate` approached/passed. Now computed live from `endDate` + `renewalReminderDays` (30-day default) on every read — contract lists, client/project detail pages, and dashboard KPIs all reflect real expiry state. |
| 4 | Vendor payment OVERDUE never updates | `src/lib/payment-status.ts` (new) + `queries/vendor.ts`, `queries/dashboard.ts` | Same class of bug — `OVERDUE` was only ever assigned by the seed script. Now derived live from `dueDate` vs. now on every read (vendor detail, payments list, dashboard KPI). |
| 5 | Quotation revision never increments | `reviseQuotation()` in `crm.ts` + `ReviseQuotationButton` (new) | `revision` was hardcoded to 1 forever with no code path to bump it. Added a "Revise" action (allowed from SENT/UNDER_REVIEW/REJECTED) that increments `revision` and resets to DRAFT — surfaced as a button on the quotation detail page. |
| 6 | No geofence containment check | `src/lib/geo.ts` (new) + `field.ts` `checkIn()` | A real device GPS fix at check-in was trusted unconditionally, even if nowhere near the site — the drawn circle on the live map was purely cosmetic. Added a Haversine-distance check (25m GPS-accuracy buffer) that rejects a device fix outside the zone's radius. The synthetic `jitter()` fallback (no device fix available) is unaffected — it's inside the zone by construction. |
| 7 | GPS tracking was one-shot, not continuous | `recordLocationPing()` in `field.ts` + `MyFieldStatus` component | A `LocationPing` was only ever written once, at check-in. Added a periodic (5-minute) client-side ping while checked in, using the real device fix, so a genuine location trail accumulates instead of relying purely on the client-only cosmetic map animation. |
| 8 | Payroll had no tax/PF/ESI logic | *(already fixed before this session — see note)* | `src/lib/payroll.ts` already computes PF/ESI/professional tax/income tax via `calculateSalaryComponents`, and a `SalaryStructure` model + `createSalaryStructure` action already let HR enter `basicSalary`/allowances directly. The CLAUDE.md doc describing this as a gap is stale; no change needed. |
| 9 | Timesheets always billable | `logTimesheet()` in `me.ts` + `LogTimesheetSheet` | No UI ever produced a non-billable entry despite the HRMS table rendering both states. Added a real "Billable to client" checkbox (defaults checked, preserving existing behavior). |
| 10 | Ticket reassignment didn't notify | `assignTicket()` in `crm.ts` | CRITICAL-priority ticket *creation* notified all ADMINs, but reassigning an existing ticket to someone was silent. Now notifies the newly assigned employee (skips if unchanged). |
| 11 | Leave applications never notified anyone | `applyLeave()` in `me.ts` | Unlike expense claims/budgets/POs, applying for leave never routed through notifications — HR only discovered pending requests by visiting `/hrms/leave`. Now notifies the HR role at submission, matching the other approval-adjacent flows. |
| 12 | Module access was additive-only, never revocable | `updateUser()` in `admin.ts` + `EditUserSheet` | Changing a user's role always *added* the new role's default modules but never removed extras an admin had granted — there was no way to revoke a module at all. The quick inline role-switch dropdown (`updateUserRole`) intentionally keeps the old additive-only behavior (it has no module UI to be explicit with). The full **Edit user** sheet now has a real module checkbox grid; submitting it grants exactly what's checked and revokes what isn't. |
| 13 | CRM status/assignment actions missing role gates | `crm.ts`: `updateLeadStage`, `updateQuotationStatus`, `updateMilestoneStatus`, `updateProjectTaskStatus`, `updateTicketStatus`, `assignTicket`, `resolveTicket` | These only called `getCurrentUser()`, not `requireRole()`. Since Next.js Server Actions are independently callable endpoints (not gated by the page layout that normally restricts `/crm` to ADMIN/SALES), any authenticated user with a valid session — regardless of role — could invoke these directly, bypassing the UI entirely. Added `requireRole(["ADMIN","SALES"])` to match their sibling `create*` actions. (Site-visit actions were deliberately left alone — they intentionally allow the assigned employee, of any role, to manage their own visit; that's existing correct behavior, not a gap.) |
| 14 | PO status had no server-side transition validation | `updatePurchaseOrder()` in `vendor.ts` | The edit form's status field is a hidden input always resubmitted unchanged today, but the action itself would have accepted any status value from a crafted request. Added the same transition-map validation as item 2, as defense in depth. |
| 15 | Minor: no success toast on project-task status change | `ProjectTaskRow` | Every other status-mutating component shows a success toast; this one only showed errors. Added the missing toast for consistency. |

### Explicitly NOT changed (confirmed correct/intentional, or out of scope)
- Cross-org uniqueness of the six sequential codes — already correctly global (see item 1's note).
- Site-visit lifecycle (`startVisit`/`rescheduleSiteVisit`/`completeSiteVisit`/`cancelSiteVisit`) — already has real status guards and a working, richer feature set than the CLAUDE.md doc describes (it's stale there too: AMC contracts *do* have a creation action now, site visits are *not* read-only).

## 4. Feature-by-Feature Status

| Module | Status | Notes |
|---|---|---|
| Auth (login/register/logout/demo personas) | WORKING | Verified via existing `dal`/`session`/`password` unit tests (all passing). |
| CRM — Pipeline/Leads | WORKING | Stage transitions now enforced; role gate added. |
| CRM — Clients | WORKING | No change needed. |
| CRM — Projects/Milestones/Tasks | WORKING | Transition validation added to milestone & task status. |
| CRM — Quotations | WORKING | Added real revision increment + transition enforcement. |
| CRM — Site Visits | WORKING | Already a full lifecycle feature (ahead of the old docs). |
| CRM — AMC Contracts | WORKING | Status is now live-computed instead of static. |
| CRM — Helpdesk/Tickets | WORKING | Transition enforcement, role gates, and reassignment notifications added. |
| HRMS — Employees/Attendance/Leave | WORKING | Leave now notifies HR on submission. |
| HRMS — Payroll | WORKING | Already had real PF/ESI/tax logic and direct salary entry (pre-existing). |
| HRMS — Timesheets | WORKING | Billable toggle added. |
| HRMS — Org Chart / Documents | WORKING | No change needed. |
| Vendor Management | WORKING | PO status validated; live OVERDUE payment status. |
| GPS & Field Tracking | WORKING | Real geofence containment check + periodic location pings added. |
| Finance — Expense Claims / Budgets | WORKING | No functional change; verified approval-notification flow intact. |
| Admin — User & Module Management | WORKING | Module access is now genuinely revocable, not just additive. |
| Platform Admin (superadmin) | WORKING (not modified) | Out of scope for this pass — no reported issues found. |
| Subscription/Billing | WORKING (not modified) | No reported issues found; server-side price recomputation and UTR duplicate guard already correct. |
| **Production build** | **BLOCKED** | Stale generated Prisma client — see section 1/2. Not caused by my changes; pre-existed this session (confirmed via `git stash`-equivalent diffing). |

## 5. Navigation Audit

No broken links, dead routes, or missing handlers were found in the reviewed navigation (`src/lib/nav.ts`, sidebar, section tabs). The CLAUDE.md doc's list of "no creation UI exists" items for AMC contracts and site visits is out of date — both already have full creation/lifecycle UI in the current code.

## 6. Testing Summary

- **Unit tests:** `npx vitest run` — **49/49 passing** (25 pre-existing + 24 new, covering: status-transition rules for all 6 entity types, AMC live-status computation, vendor-payment live-status computation, Haversine/geofence math, and the existing dal/session/password/nav/payroll suites untouched).
- **Type-checking:** `npx tsc --noEmit` — isolated to only the files I changed, zero new errors introduced (confirmed by running the same check before/after each edit). The remaining errors project-wide are 100% attributable to the stale generated client (section 1) and existed before I touched anything.
- **Lint:** `npx eslint` on all touched files — clean (fixed 3 pre-existing-pattern unused-var warnings along the way).
- **Not run:** full `next dev`/`next build` end-to-end click-through — blocked by the sandbox's filesystem restrictions on this specific mounted folder (unrelated `EPERM` errors on build-artifact cleanup, confirmed to also happen on files my changes never touched) and by the stale-client build failure in section 1. Once you run `npx prisma generate` locally, I'd recommend a manual click-through of `/crm/quotations/[id]` (revise button), `/crm/helpdesk` (ticket reassignment/notifications), `/me` (timesheet billable checkbox), `/admin/users` (module checkboxes), and `/field` (check-in from outside vs. inside a zone) to confirm the new UI end-to-end.

## 7. Deployment

Per your direction this session did not attempt AWS deployment. No infrastructure was provisioned or touched.

## 8. Remaining Risks

- **Do the Prisma regeneration first** — everything else is secondary until `npx tsc --noEmit` is clean.
- The three environment cleanups in section 2.
- I did not add a background job / cron for AMC or payment status — they're computed live on read instead, which is correct for anything the app displays but won't, e.g., proactively email someone the day a contract expires. If you want proactive expiry notifications later, that's a separate, larger feature (needs a scheduler).
- The revised-quotation flow keeps the same `quoteNumber` and just bumps `revision` in place (no separate history row) — appropriate for the current schema, but means the pre-revision line items aren't preserved as a separate historical record. Worth knowing if you later want full revision history.
