# Exist Digitally Ops Platform — Project Context

This file is written for a future Claude session (or any engineer) picking this repo up cold. Read this before making changes — it captures architecture, conventions, and non-obvious gotchas that aren't visible from skimming the code.

## What this is

A **single Next.js application** — there is no separate backend. It's a multi-tenant SaaS ops platform (CRM, HRMS, Vendor Management, GPS field tracking, Finance, Helpdesk, task management) owned and operated by **Exist Digitally** (support: digitallyexist@gmail.com, +91 96256 33868). It was originally built as a single-tenant demo for a fictional customer company "EOS Techno," then retrofitted into a real multi-tenant subscription product with a 5-day trial, manual UPI/bank payment collection, and admin-verified activation. **"EOS Techno" is now just the seeded demo tenant** (one example customer organization used to exercise multi-tenancy) — it is not the platform's own brand; the platform itself is Exist Digitally.

Everything — UI, business logic, and data access — lives in one Next.js App Router codebase. "Frontend" and "backend" are not separate deployables; see the Deployment section for what that means in practice.

## Tech stack

- **Next.js 16.2.10** (App Router, Turbopack) — ⚠️ this fork intentionally deviates from stock Next.js conventions. `middleware.ts` is renamed **`src/proxy.ts`**, exporting a `proxy()` function instead of `middleware()`. Before assuming any Next.js API/convention, check `node_modules/next/dist/docs/` or the actual code — don't trust training-data memory of "how Next.js works" for this repo (see `AGENTS.md`).
- **React 19.2**, **TypeScript 5**, **Tailwind CSS v4**
- **Prisma 7.8/7.9** ORM with the `@prisma/adapter-better-sqlite3` driver adapter — **SQLite is the permanent, sole database.** Do not reintroduce Postgres/MySQL/Mongo — an earlier Postgres migration attempt was reverted mid-project; `pg` and `@prisma/adapter-pg` remain in `package.json` as **dead dependencies** (not imported anywhere under `src/`) — safe to remove, just hasn't been done.
- **@base-ui/react** for all interactive primitives (Select, Dialog, DropdownMenu, Sheet, etc.), wrapped in `src/components/ui/*` (shadcn-style). Not Radix.
- **jose** for JWT session signing, **better-sqlite3** as the native SQLite driver.
- **Vitest** for unit tests (`tests/lib/*.test.ts`).
- **Local filesystem** for both the SQLite file (`prisma/dev.db`) and uploaded files (`public/uploads/`) — see "Storage & persistence caveats" below, this is the most important thing to understand before deploying.

## Auth & session

- Custom auth, not NextAuth/Clerk/Auth0. Password hashing via `scryptSync` (`src/lib/password.ts`). Sessions are httpOnly JWT cookies (`src/lib/session.ts`, cookie name `eos_session`, 7-day expiry, `SESSION_SECRET` env var required — **the app throws at import time if `SESSION_SECRET` is unset**).
- `src/proxy.ts` is the edge auth gate: redirects unauthenticated requests to `/login`, redirects authenticated users away from `/login`/`/register`, and clears a stale session cookie when `?session=expired` is present (used when a session references a deleted user, e.g. after a reseed).
- `src/lib/dal.ts` is the server-side authorization toolkit, used at the top of every layout/page/action:
  - `getCurrentUser()` — cached, throws/redirects to `/login` if no valid session.
  - `requireRole([...AccessRole])` — the original single-tenant RBAC gate, still authoritative for role-based nav sections.
  - `requireSuperAdmin()` — gates `/platform-admin/*`, checks `session.isSuperAdmin` (a flag orthogonal to `AccessRole` — the platform operator, not a per-org admin).
  - `getCurrentOrganization()` — cached, loads the org + its subscription + subscription modules.
  - `requireActiveAccess()` — the trial/subscription gate. Computes access **live from timestamps** (see `src/lib/billing/access.ts::computeEffectiveAccess`), never trusts a possibly-stale `status` column. Redirects to `/subscription` if the org has no active trial/paid access.
  - `requireModuleAccess(moduleKey)` — layered on top of `requireActiveAccess()`: checks both that the org's plan includes the module AND that this specific user has been granted it (`UserModuleAccess`). Redirects to `/subscription?blocked=module` (org-level block) or `/access-denied` (per-user permission gap).

## Multi-tenancy

Real multi-tenant (many organizations share one SQLite database), added on top of an originally single-tenant schema. The key architectural choice: `organizationId` was added directly **only** to root models with no parent to scope through — `Organization`, `User`, `Employee`, `Client`, `Vendor`, `GeofenceZone`. Every other model (Lead, Quotation, Attendance, PayrollRecord, SupportTicket, PurchaseOrder, ExpenseClaim, PersonalTask, etc. — the other ~29 models) is scoped **transitively** through those root FKs in every query, e.g. `prisma.leaveRequest.findMany({ where: { employee: { organizationId } } })`, rather than duplicating the column onto all 35 models.

**The actual security boundary is in the query/action layer, not just `requireRole`.** Every "detail" lookup by ID uses `findFirst({ where: { id, organizationId } })` (or the transitive equivalent) instead of `findUnique({ where: { id } })` — this is what stops org A from viewing org B's record by guessing/pasting its ID. Every mutating Server Action derives `organizationId` from `getCurrentUser()` internally (never accepts it as a client-supplied parameter), and every update/delete-by-ID either pre-checks ownership via `findFirst` or uses `updateMany`/`deleteMany` with the org filter baked into the `where` + a `result.count === 0` check.

`User.organizationId` is **nullable** — the only user with `organizationId: null` is the platform super-admin (`isSuperAdmin: true`), who belongs to no organization. `src/app/(app)/layout.tsx` redirects super-admins to `/platform-admin` before they can ever hit an org-scoped page (prevents a null-organizationId crash).

## Subscription / billing system

One `Subscription` row per organization is the entire trial+billing state machine (no separate `Trial` model). States: `TRIAL | ACTIVE | EXPIRED | CANCELLED | PAYMENT_PENDING | PAYMENT_FAILED`. Effective access is always computed live (`computeEffectiveAccess` in `src/lib/billing/access.ts`) from `trialEndsAt`/`currentPeriodEnd` timestamps — the stored `status` is never trusted alone, so a stale status column self-heals without needing a cron job.

- **Trial**: 5 days from org creation, unlocks all 5 modules regardless of what's eventually purchased.
- **Licensing**: user-based + module-based. `UserModuleAccess` grants are per-user, additive on top of role defaults (auto-seeded at user creation to match `roleSectionAccess[accessRole]` in `src/lib/nav.ts`, so nothing changes by default — an admin has to deliberately grant extra modules beyond a user's role).
- **Licence enforcement**: `createUserForEmployee` (`src/lib/actions/admin.ts`) does the user-count check *inside* the same `$transaction` as the insert — the write lock on the insert prevents a race between two concurrent creations both slipping under the limit.
- **Pricing**: single source of truth in `src/lib/billing/pricing-config.ts` (`calculatePrice()`) — ₹400/module/user/month, 5-user minimum, 15% volume discount at 20+ users. Recomputed server-side on payment submission; never trusts a client-supplied amount.
- **Manual payment flow**: UPI QR + bank details (`src/lib/billing/payment-config.ts`, env-driven) → user submits UTR/amount/date/method/screenshot on `/subscription/payment` → `Payment` row created `PENDING` (`Payment.utr` is `@unique`, which alone prevents duplicate-payment reuse) → platform super-admin reviews at `/platform-admin` → `approvePayment`/`rejectPayment` in `src/lib/actions/platform-admin.ts`. Approval is one `$transaction`: payment status, subscription status + period dates (extends from the *existing* `currentPeriodEnd` if renewing before expiry, else from now — avoids overlapping periods), and `SubscriptionModule` rows all move together or not at all.
- Payment screenshots reuse `src/lib/storage.ts` (see below).

## Module-based access control

`src/lib/nav.ts` defines the 5 real feature modules (`crm`, `hrms`, `vendors`, `field`, `finance`) plus the pre-existing 6-role RBAC (`AccessRole`: ADMIN/SALES/FIELD/HR/PROCUREMENT/FINANCE) that predates multi-tenancy and is still fully intact — every module `layout.tsx` calls **both** `requireRole([...])` (unchanged original gate) **and** `requireModuleAccess("key")` (new billing gate), as two independent checks. Frontend nav hiding is cosmetic only; both server-side checks are the actual boundary.

## Task management / evening summaries

`PersonalTask` (originally a self-only "My Tasks" board) was extended rather than duplicated: `assignedById` (null for self-created tasks, set to the manager's employeeId for a manager-assigned one), `priority`, `isBlocked`/`blockerNote`, plus a new `TaskComment` relation for a discussion thread. "Manager" isn't a new role — it's defined as *anyone with ≥1 direct report* via the pre-existing `Employee.reportingTo` org-chart hierarchy, and a manager can assign across the whole org (no team/department ACL). `DailySummary` is a new, separate model (one row per employee per day, upserted) — an employee's free-text evening report (completed/in-progress/pending/blockers/updates/next-day plan), reviewed by their manager on the same `/me` page.

## Data model (35 Prisma models, grouped)

- **Platform**: `Organization`, `User`, `Notification`
- **Billing**: `Subscription`, `SubscriptionModule`, `UserModuleAccess`, `Payment`
- **HRMS**: `Employee`, `Attendance`, `LeaveRequest`, `PayrollRecord`, `Timesheet`, `EmployeeDocument`
- **CRM**: `Client`, `Lead`, `Quotation`, `QuotationLineItem`, `SiteVisit`, `AmcContract`, `Project`, `Milestone`, `ProjectTask`, `SupportTicket`
- **Vendor Management**: `Vendor`, `PurchaseOrder`, `VendorPayment`
- **GPS & Field Tracking**: `GeofenceZone`, `LocationPing`, `VisitLog`
- **Approvals**: `ApprovalRequest` (generic polymorphic engine — `entityType`/`entityId` cover `PURCHASE_ORDER`, `EXPENSE_CLAIM`, `BUDGET`; the switch in `src/lib/actions/approvals.ts::decideApproval` is the extension point for entity-specific side effects, e.g. approving a PO also creates its `VendorPayment`)
- **Personal productivity**: `PersonalTask`, `TaskComment`, `DailySummary`
- **Finance**: `ExpenseClaim`, `Budget`

## Route inventory (`src/app`)

- `/login`, `/register` (public — org self-signup creates `Organization` + `Subscription(TRIAL)` + first ADMIN user, no forced `Employee` record since `User.employeeId` is optional)
- `/access-denied` (per-user permission gap)
- `/subscription`, `/subscription/payment` (trial/plan status, plan calculator, manual payment submission)
- `/platform-admin`, `/platform-admin/organizations` (super-admin only: payment review/approval, org list)
- `(app)` route group — the main authenticated shell (`AppSidebar` + trial/access gate in its `layout.tsx`):
  - `/` (dashboard), `/me` (self-service: attendance check-in/out, leave, timesheets, expense claims, personal/assigned tasks, evening summary)
  - `/admin/users` (per-org user & role management — distinct from `/platform-admin`)
  - `/approvals` (generic approval inbox)
  - `/crm`, `/crm/clients[/[id]]`, `/crm/projects[/[id]]`, `/crm/quotations[/[id]]`, `/crm/site-visits`, `/crm/amc`, `/crm/helpdesk[/[id]]`
  - `/hrms`, `/hrms/employees[/[id]]`, `/hrms/attendance`, `/hrms/leave`, `/hrms/payroll`, `/hrms/timesheets`, `/hrms/org-chart`
  - `/vendors[/[id]]`, `/vendors/purchase-orders`, `/vendors/payments`
  - `/field`, `/field/visits`, `/field/geofences`
  - `/finance`, `/finance/budgets`

## Storage & persistence caveats (read this before deploying)

This is the single most important thing for production planning:

1. **SQLite runtime path is `DATA_DIR`-aware, not `DATABASE_URL`-driven.** `src/lib/db.ts` connects to `path.join(process.env.DATA_DIR, "dev.db")` when `DATA_DIR` is set, otherwise `path.join(process.cwd(), "prisma", "dev.db")` (local dev, unchanged). `DATABASE_URL` in `.env`/`prisma.config.ts` only drives the Prisma **CLI** (`db push`, `migrate`, `seed`), never the running app — don't expect changing `DATABASE_URL` to move the app's actual database.
2. **Uploaded files** (`src/lib/storage.ts`) follow the same `DATA_DIR` pattern: unset → `public/uploads/`, served by Next's normal static handling, URLs like `/uploads/<key>` (local dev, unchanged). Set → `<DATA_DIR>/uploads/`, served instead by `src/app/api/uploads/[...path]/route.ts` (files move outside `public/` so Next can no longer serve them as static assets), URLs like `/api/uploads/<key>`. The `{url, storageKey}` interface this file exposes is unchanged either way — a future swap to Vercel Blob/S3 still only touches this one file.
3. **On any host with a persistent disk** (Render, Railway, Fly.io, a plain VPS), set one env var — `DATA_DIR=/data` (or wherever the disk is mounted) — and both the database file and uploads land on it together, surviving restarts/redeploys. Zero other code changes needed; this is the primary supported deployment path (see `README.md`).
4. **Standard serverless (Vercel Functions, Netlify Functions, AWS Lambda) is still not a good fit even with `DATA_DIR`** — those platforms don't offer a persistent disk to point `DATA_DIR` at in the first place. Making this app work on Vercel specifically still needs the bigger swap: SQLite → Turso/libSQL over HTTP, and `storage.ts`'s local-disk implementation → Vercel Blob.
5. The dev-time gotcha carries over to prod too: `db.ts` uses a `globalForPrisma` singleton — any `schema.prisma` change needs a full process restart, not just a hot reload, for the new client to take effect.

## Environment variables

Actually consumed by the app (verified by grepping `process.env` — the old `.env.example`/README describing Postgres was stale and has been corrected):

| Variable | Required? | Used by |
|---|---|---|
| `SESSION_SECRET` | **Yes** — throws at boot if missing | `src/lib/session.ts` (JWT signing) |
| `DATA_DIR` | No locally; **yes in production on a persistent-disk host** (set to the mount path) | `src/lib/db.ts`, `src/lib/storage.ts` |
| `DATABASE_URL` | Only for Prisma CLI (`db push`/`migrate`/`seed`), not the running app | `prisma.config.ts` |
| `PAYMENT_UPI_ID` | No — falls back to a demo placeholder | `src/lib/billing/payment-config.ts` |
| `PAYMENT_ACCOUNT_NAME` | No — placeholder fallback | same |
| `PAYMENT_BANK_NAME` | No — placeholder fallback | same |
| `PAYMENT_ACCOUNT_NUMBER` | No — placeholder fallback | same |
| `PAYMENT_IFSC` | No — placeholder fallback | same |

**Production must set real `PAYMENT_*` values** — the fallbacks are fake demo data and payments would appear to come from "EOS Techno Private Limited / HDFC Bank" placeholders otherwise.

## Testing & demo data

- `npx vitest run` — unit tests in `tests/lib/*.test.ts` (session JWT round-trip/tamper detection, `dal.ts` role gates, `nav.ts` config, password hashing, payroll math). `test/stubs/server-only.ts` stubs the `server-only` package for the test environment.
- `npx tsx prisma/seed.ts` — wipes and reseeds all demo data, including **two organizations** specifically to exercise multi-tenant isolation:
  - **EOS Techno** (`ACTIVE` subscription, all 5 modules, 50 licences) — the main demo org. Default logins (password `demo123` for everyone): `manan.vora@eostechno.com` (ADMIN, full access), `nikhil.bhatt@eostechno.com` (SALES), `suresh.yadav@eostechno.com` (FIELD), `pooja.nair@eostechno.com` (HR), `tanvi.mehta@eostechno.com` (PROCUREMENT), `ankit.shah@eostechno.com` (FINANCE).
  - **Vasant Industrial Supplies** (`TRIAL` status, 5 licences) — a second, smaller org that exists purely to prove cross-tenant isolation. Login: `kiran.deshpande@vasantindustrial.com` / `demo123` (ADMIN).
  - Platform super-admin: `platform-admin@eostechno.internal` / `demo123` (`isSuperAdmin: true`, no organization, lands on `/platform-admin`).

## Known pre-existing issues (not fixed, flagged for awareness)

- **`react-hooks/set-state-in-effect` ESLint errors in 16 files** (e.g. `new-lead-sheet.tsx`, `new-employee-sheet.tsx`, `new-task-sheet.tsx`, and 13 others) — every "New X" sheet component uses the same `useEffect(() => { if (state?.success) { toast(...); setOpen(false); } }, [state])` idiom to close itself after a successful Server Action. `tsc`/`next build` are unaffected (this is a stricter React lint rule, not a type or build error); functionally correct. Left alone deliberately as a systemic, pre-existing pattern — fixing it everywhere would be a large unrelated refactor.
- `pg` and `@prisma/adapter-pg` in `package.json` are dead weight from an abandoned Postgres migration attempt — safe to `npm uninstall` but harmless to leave.
- `prisma/dev.db.bak-pre-saas` in the repo is a manual backup snapshot from that same abandoned migration — safe to delete once you're confident you don't need to roll back to it.

## Where to look for X

- Adding a new module/nav section → `src/lib/nav.ts` (`navSections`, `roleSectionAccess`), then wire `requireModuleAccess` into its `layout.tsx`.
- Adding a new org-scoped model → add the FK to its parent (never a new `organizationId` column unless it's a true root model), scope every query transitively, use `findFirst`/`updateMany` with the org filter for anything looked up by ID.
- Changing pricing → `src/lib/billing/pricing-config.ts` only.
- Changing payment/bank details → `.env` (`PAYMENT_*`) or the fallback constants in `src/lib/billing/payment-config.ts`.
- Approval side effects for a new entity type → extend the `ApprovalEntityType` enum + the switch in `src/lib/actions/approvals.ts`.
