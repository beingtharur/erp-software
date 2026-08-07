# Production Incident: Deployment Consistency Analysis & Procedure

Date: 06 Aug 2026. Scope: verification pass on the `login()`/`registerOrganization()`
500-error investigation — specifically, whether the deployment process itself can produce
a Prisma-Client/SQLite-schema mismatch, and if so, exactly where. No code, schema, or
migrations were changed to produce this analysis — everything below is read directly from
`package.json`, `prisma.config.ts`, the migration files, and `next.config.ts`.

---

## 1. Deployment sequence — where mismatches can occur

Mapping every step that touches either the Prisma Client or the SQLite file, in the order
this project's own tooling actually runs them:

```
git pull / checkout new code
        │
        ▼
npm ci  ──────────────────────────────────────────┐
        │                                          │
        ▼                                          │
  postinstall hook fires automatically:             │
  "prisma generate"                                 │  <- regenerates the CLIENT
        │                                            │     from the CHECKED-OUT
        ▼                                            │     schema.prisma. Always
npm run build ("next build")                         │     runs. Cannot be skipped
        │                                            │     without skipping npm ci
        ▼                                            │     itself.
npm start ("next start")                              │
        │                                             │
        ▼                                             │
   app is now serving traffic                          │
   with a Client that matches                           │
   TODAY's schema.prisma                                 │
                                                          │
   ══════════════ THE GAP ══════════════                 │
                                                          │
   Nothing above this line ever touches the ACTUAL        │
   database file's structure. That only happens if        │
   someone separately, manually runs:                     │
                                                          │
        DATA_DIR=<mount path> npx prisma db push  ◄───────┘  <- the ONLY thing that
        (or `prisma migrate deploy`)                             ever changes what
                                                                   tables/columns
                                                                   physically exist
```

**The mismatch window, exactly:** between "new code deployed and serving traffic" and
"someone remembers to run `db push` against the actual production `DATA_DIR`," the server
is live with a Client that expects the new schema, querying a database that doesn't have
it yet. Nothing in `npm ci` / `npm run build` / `npm start` closes this gap — it is a fully
manual, separate step by design (`README.md` and `context.md` both say so explicitly), and
there is no health check, startup assertion, or CI step anywhere in this repo that verifies
Client-schema-vs-database consistency before serving traffic. Confirmed: `grep`-ing the
repo for CI/CD config (`.github/workflows/*`, `Dockerfile`, `render.yaml`, etc.) found
**none** — there is no automated deployment pipeline of any kind today; every deploy is a
manual sequence of commands on the server.

**Can `prisma generate` succeed while `db push` is skipped?** Yes, trivially — they are
fully independent operations against different targets (`prisma generate` reads
`schema.prisma` and writes generated TypeScript/JS to `node_modules/.prisma/client`;
`db push` reads `schema.prisma` and writes DDL to whatever `DATABASE_URL`/`--url` points
at). Neither one checks whether the other has run. This is the direct answer to "could one
succeed while the other is skipped" — not only could it happen, the standard `npm ci`
sequence *guarantees* client generation runs on every deploy while *guaranteeing nothing*
about the database being touched at all.

---

## 2. Deployment matrix

| Application code | Prisma Client | SQLite Schema | Expected result |
|---|---|---|---|
| Old | Old | Old | ✅ Normal operation — the pre-Department-phase state. |
| New | New | New | ✅ Normal operation — the state a fully correct deploy (code + `db push`) produces. |
| **New** | **New** | **Old** | ❌ **This is the observed failure.** The Client (regenerated automatically by `postinstall`) expects `Employee.departmentId` and the `AuditLog` table; the database doesn't have them yet. Any query touching those objects throws `PrismaClientKnownRequestError` ("no such column"/"no such table"), which Next.js's production error boundary redacts to a generic digest at the browser — exactly what was reproduced. This is the state you land in automatically, by default, the moment new code is deployed without a manual `db push` — there is nothing that prevents it. |
| New | Old | New | Very unlikely to be reached in practice, and even less likely to run: `postinstall` regenerates the Client on every `npm ci`, so a stale Client alongside new code would require deliberately skipping/short-circuiting install (e.g., reusing a stale `node_modules` without reinstalling). If it did happen, new app code referencing models the old Client's generated API doesn't expose (e.g., `prisma.department`, or `buildInitialSubscription`'s expected `Subscription` shape) would most likely fail **at `next build`'s type-check step**, before the app ever serves traffic — a build failure, not a runtime 500. |
| Old | New | New | Old code simply doesn't reference the new columns/tables at all, so its queries continue to succeed unchanged — the new schema objects just sit there unused. **✅ Functionally safe** for old code's own behavior, though it means the newest features (Department, audit logging) silently aren't active. This is also the state you're briefly in if `db push` is deliberately run *ahead of* a code deploy — see §4's recommended ordering, and the one caveat about `DROP COLUMN` below. |
| Old | Old | New | Same reasoning as directly above, one step earlier in the sequence — old Client, old code, new DB. Additive schema changes (new tables, new nullable columns) are harmless to old code querying with an old Client. **The one exception, specific to this project's actual migration:** the Department migration doesn't just add columns, it also **drops** `Employee.department` and `Budget.department` (the old free-text fields) after backfilling. If *old* application code is still running (still reading/writing `Employee.department`) at the moment that `DROP COLUMN` executes, it would start failing immediately — this is the concrete reason schema pushes that include a drop must happen **after** old code has stopped running, not proactively ahead of a code deploy, for this specific migration. |

---

## 3. Department-phase migration — object-by-object impact on `login()` / `registerOrganization()`

Every schema object introduced by the Department Foundation phase (`df0b0d1`), checked
against exactly what `login()` and `registerOrganization()` actually touch (§ traced in the
prior message — `login()` only ever reads `User`+`Employee`; `registerOrganization()`
writes `Organization`, `Subscription`, `Employee`, `User`, then separately `AuditLog`):

| Object | Login fails if missing? | Registration fails if missing? | Both? | Neither? |
|---|---|---|---|---|
| `Department` table (new) | No — `login()`'s `include: { employee: true }` never joins Department | No — `registerOrganization()` never creates or reads a Department row; the founding admin's `departmentId` is simply left `null` | | ✅ **Neither** |
| `Employee.departmentId` (new column) | **Yes** — it's part of `Employee`'s full scalar column set, which the Client selects whenever `employee: true` is included | **Yes** — `tx.employee.create(...)` writes/returns the full row shape the Client expects | ✅ **Both** | |
| `Budget.departmentId` (new column) | No — Budget isn't touched by login | No — no Budget is created during registration | | ✅ **Neither** |
| `Employee.department` (old column, dropped) | No — a stale *extra* column the Client no longer references is harmless; Prisma doesn't error on unexpected columns, only missing expected ones | No — same reasoning | | ✅ **Neither**, if merely *not yet dropped* (extra/stale is safe) |
| `Budget.department` (old column, dropped) | No | No | | ✅ **Neither** |
| `Department.type` (new column) | No — Department isn't touched by login | No — Department isn't touched by registration | | ✅ **Neither** |
| `AuditLog` table (new — added in the same commit, but notably **not captured in any migration file at all**, see §4) | No — `login()` never calls `logAudit` | **Yes** — `registerOrganization()`'s `logAudit(...)` call does an unconditional `prisma.auditLog.create(...)` after the transaction | | Registration only |

**This sharpens the earlier hypothesis considerably.** Among every single object this phase
introduced, exactly **one** — `Employee.departmentId` — is capable of explaining *both*
failures on its own. `AuditLog`'s absence explains registration failing but says nothing
about login. Every other new object explains neither. The evidence now points precisely at
**`Employee.departmentId` missing from the production database's `Employee` table** as the
most specific, best-supported single cause — with `AuditLog` also missing (likely, since
neither object was ever captured in a migration file — see next section) as a compounding,
registration-specific second failure point.

---

## 4. A second, independent finding: the tracked migrations are far behind `schema.prisma`

Checked directly, not assumed: there are only three migration files in the entire repo —
`20260723000000_init`, `20260805120000_department_master_data`,
`20260805170000_department_unit_type`. The `init` migration creates exactly **28 tables**
and — notably — **does not create `Organization` at all**, nor does its `User` table have
`organizationId` or `isSuperAdmin` columns. That means the entire multi-tenancy layer
(`Organization`, `Subscription`, `SubscriptionModule`, `UserModuleAccess`, `Payment`,
`User.organizationId`/`isSuperAdmin`) plus `AuditLog`, `PasswordResetToken`,
`SalaryStructure`, `SiteVisitAttachment`, `TaskComment`, and `DailySummary` — twelve
schema objects that plainly exist in the app today — were **never captured in any tracked
migration file**. They exist in `schema.prisma` only, having been applied historically via
`prisma db push` directly.

This has two implications, one reassuring and one cautionary:

- **Reassuring:** this rules out "someone ran `prisma migrate deploy`" as this incident's
  cause — if that had ever been run against this database, essentially nothing in the app
  would work (no `Organization` table means no multi-tenancy at all), which is inconsistent
  with a server that's clearly been running a multi-tenant app in production up to now.
  This production deployment has necessarily always relied on `db push`, exactly as the
  README instructs.
- **Cautionary:** the migration history cannot be trusted or relied on as a safety net or a
  reproducible record of what's been applied. If anyone ever switches this project to
  `prisma migrate deploy` for consistency without first reconciling the migration history
  against what's actually live, it would be catastrophic — not incremental. This is worth
  fixing at some point (`prisma migrate diff` against the live database, then baselining a
  correct migration history) but is explicitly **not** part of resolving today's incident.

---

## 5. Recommended deployment procedure going forward

Documenting this so the class of issue — new code live before the database structure
catches up — cannot recur silently:

1. **Back up the SQLite file** before touching anything — `cp $DATA_DIR/dev.db
   $DATA_DIR/dev.db.bak-$(date +%Y%m%d%H%M%S)` (or equivalent). One file, trivial to do,
   trivial to restore from.
2. **Deploy the new code** (`git pull` / redeploy artifact) — `npm ci` runs, which
   regenerates the Prisma Client automatically via `postinstall`. At this exact point the
   Client is ahead of the database — this is expected and fine as long as the *old* server
   process is still the one serving traffic (it doesn't restart until step 5).
3. **Run `prisma generate` explicitly as its own logged step**, even though `npm ci`
   already does it — makes the sequence self-documenting in deploy logs rather than
   relying on a side effect of install.
4. **Run `DATA_DIR=<mount path> npx prisma db push`** — the step this incident's root
   cause was almost certainly missing. For this specific migration (which includes a
   `DROP COLUMN`), this must happen **after** the old process has stopped serving requests
   that reference the columns being dropped (see the matrix's Old/Old/New row) — in
   practice, that means step 4 should come immediately before, not long before, step 5.
5. **Restart the application process** (`pm2 restart` / equivalent) so it picks up both
   the new build output and now-consistent database.
6. **Health check** — a lightweight, scripted check that specifically exercises the thing
   that broke this time: submit `POST /login` (or `/register`) with a throwaway/known-bad
   credential and confirm a normal `{error: "Invalid email or password."}` response, not a
   500. A 500 here means Client/schema are still mismatched — catch it before calling the
   deploy done, not from a user report.
7. **Rollback path, if the health check fails:** restore the database backup from step 1,
   redeploy the previous code version, restart, re-run the health check. Because step 4's
   changes in this project are additive-plus-one-drop rather than wholesale rewrites, a
   restored backup plus the previous code version should always be consistent with each
   other (they were, together, the last known-good state).

The core discipline this encodes: **code and schema move together, and "moved" isn't true
until both the Client *and* the live database reflect the same `schema.prisma` — verified
by an actual request, not assumed from a successful build.**

---

---

## 6. Addendum — an unrelated real bug found while exercising the app locally

While using the app's own "New user" flow locally to set up a real test organization
(fully migrated local database, so this is **not** the production incident above — it's
independent), `createUserForEmployee` (`src/lib/actions/admin.ts`) crashed with:

```
PrismaClientKnownRequestError: Invalid `tx.employee.create()` invocation —
Foreign key constraint violated on the foreign key
```

**Root cause:** the shared `DepartmentSelect` component (`src/components/departments/
department-select.tsx`) defaults its form value to the literal string `"none"` when no
department is chosen (`defaultValue={... ?? (allowNone ? "none" : undefined)}`). Several —
not all — server actions that read `departmentId` from that form only normalize an *empty
string* to `null` (`String(formData.get("departmentId") ?? "").trim() || null`), never
checking for the `"none"` sentinel specifically. The literal string `"none"` is truthy, so
it passes straight through as a real (garbage) foreign-key value, and Prisma throws.

Checked every real caller of this pattern:

| Action | Vulnerable? |
|---|---|
| `createEmployee` (hrms.ts) — the primary "New Employee" flow | **Yes** |
| `updateEmployee` (hrms.ts) — Edit Employee sheet | **Yes** (notably, the same function already handles this exact sentinel correctly for its `reportingToId` field two lines below — `reportingToIdRaw === "" \|\| reportingToIdRaw === "none" ? null : reportingToIdRaw` — making the omission on `departmentId` look like an isolated oversight, not a design choice) |
| `createSelfEmployeeProfile` (hrms.ts) — "Complete your profile" banner | **Yes** |
| `createUserForEmployee` (admin.ts) — "New user" admin flow | **Yes** — reproduced directly |
| `createBudget` (finance.ts) — New Budget sheet | **No** — it looks the department up (`prisma.department.findFirst`) and uses the *found row's* id rather than the raw form value, so a stray `"none"` degrades to a friendly "Department not found" error instead of a crash |

**Blast radius:** any brand-new organization's very first "add an employee" or "add a
portal user" action, submitted before any department has been created (the exact, unavoidable
state every new signup starts in) — or any later one where department is deliberately left
unset — hits this. This is unrelated to the production deployment issue investigated above;
it reproduces identically on a fully up-to-date local database and would affect production
too once the deployment issue is fixed. Not fixed here — flagged for a decision on when to
address it, per this session's "no code changes without being asked" constraint.

---

No code, schema, or migrations were changed to produce this document.
