# Deployment Checklist & Rollback Plan — Department Foundation + Dev Mode

Date: 07 Aug 2026. Scope: pre-deployment verification of production environment
assumptions, and the checklist/rollback plan to actually ship the Department Foundation,
Dev Mode, and HRMS Task integration work sitting in the working tree. Findings below are
read directly from `package.json`, `prisma.config.ts`, `next.config.ts`, the migration
files, `.env.example`, `context.md`, and a repo-wide search for deployment tooling — not
assumed. This supersedes nothing already established in `PRODUCTION_DEPLOYMENT_INCIDENT.md`
(the earlier login/register incident writeup); it consolidates those same verified facts
into an actionable pre-deploy checklist for this specific release.

---

## 1. What deployment tooling actually exists in this repo — checked directly

A full repo search for every mechanism named in the request found **none of them present**:

| Searched for | Found |
|---|---|
| `Dockerfile*`, `docker-compose*` | None |
| PM2 `ecosystem.config.*` | None |
| `.github/workflows/*` (GitHub Actions) | None — directory doesn't exist |
| `render.yaml`, `fly.toml`, `railway.json`, `Procfile`, `vercel.json` | None |
| `.vercel/` directory | **None** — `README.md` claims "This repo is already linked to a Vercel project (see `.vercel/project.json`)"; that file/directory does not exist. This is a stale/inaccurate line in the README, not a deployment mechanism to rely on. |
| A `scripts/` directory with deploy helpers | Doesn't exist |

**Conclusion: there is no automated deployment pipeline of any kind.** Every deploy today
is, and has to be, a manual sequence of commands run directly on the target host. The
`README.md`'s "Production deployment" section documents three supported manual paths
(Render with a persistent disk, a plain VPS/Docker with a mounted volume, or — explicitly
not-yet-done — Vercel after a database/storage swap). This checklist assumes the
persistent-disk-host path, since that's the one actually in use (confirmed against a real
running deployment during the earlier incident investigation).

## 2. Database: confirmed SQLite, not PostgreSQL

- `src/lib/db.ts` constructs the Prisma client with `new PrismaBetterSqlite3({ url:
  \`file:${dbPath}\` })` **unconditionally** — no branch, no environment check, no
  PostgreSQL adapter path exists in the code that runs.
- `pg` and `@prisma/adapter-pg` are listed in `package.json` but are **dead, unimported
  dependencies** — `context.md` states this explicitly: "an earlier Postgres migration
  attempt was reverted mid-project." `prisma/dev.db.bak-pre-saas` in the repo is a leftover
  backup from that abandoned attempt.
- `DATABASE_URL` (the variable that would normally select a database) **only drives the
  Prisma CLI** (`db push`, `migrate`, `seed`) — never the running application. The app
  resolves its actual database file path independently, from `DATA_DIR`.

**Confirmed: production is SQLite, on a persistent disk, addressed via `DATA_DIR` — not
PostgreSQL, and not `DATABASE_URL`.**

## 3. Schema changes: applied via `prisma db push`, not migrations — verified, not assumed

- `package.json` scripts: `dev`, `build`, `start`, `lint`, `test`, and `postinstall:
  "prisma generate"`. **`postinstall` only regenerates the Prisma Client** (TypeScript/JS
  bindings matching `schema.prisma`) — it does not touch the database file's actual
  structure. Nothing in `build` or `start` touches the database either.
- Only **three migration files** exist in `prisma/migrations/`: `20260723000000_init`,
  `20260805120000_department_master_data`, `20260805170000_department_unit_type`. The
  `init` migration creates 28 tables and — critically — **does not create `Organization`
  at all**, nor does its `User` table have `organizationId`/`isSuperAdmin` columns. Twelve
  schema objects that exist in the app today (`Organization`, `Subscription`,
  `SubscriptionModule`, `UserModuleAccess`, `Payment`, `AuditLog`, `PasswordResetToken`,
  `SalaryStructure`, `SiteVisitAttachment`, `TaskComment`, `DailySummary`, plus
  `User.organizationId`/`isSuperAdmin`) were **never captured in any tracked migration** —
  they exist in `schema.prisma` only, applied historically via `prisma db push` directly
  against the live database.
- This rules out `prisma migrate deploy` as this project's real deployment mechanism (if
  it had ever been used, the app's multi-tenancy wouldn't exist at all) and confirms `npx
  prisma db push` against `DATA_DIR` is the actual, load-bearing schema-sync step —
  entirely manual, and not triggered by anything in `npm ci`/`build`/`start`.

**Do not switch this project to `prisma migrate deploy` without first reconciling the
migration history against the live database** — given how far behind the tracked
migrations are, doing so today would attempt to recreate tables that already exist (or
worse, silently diverge). That's a separate follow-up, not part of this deployment.

## 4. Environment variables required for this specific release

Cross-checked `.env.example` against what the Department Foundation and Dev Mode work
actually reads from `process.env`:

| Variable | New for this release? | Required? | Notes |
|---|---|---|---|
| `SESSION_SECRET` | No (pre-existing) | **Yes** — app won't boot without it | Unchanged by this release |
| `DATA_DIR` | No (pre-existing) | **Yes**, on any persistent-disk host | Unchanged by this release; still the single most important variable to get right (§2) |
| `DEV_SUBSCRIPTION_MODE` | **Yes — new in this release** | No — defaults to `"false"`/unset | **Must not be `"true"` in production.** Local `.env` currently has it set to `"true"` for testing convenience — verify explicitly before deploy that the production environment either omits it or sets it to `"false"`. If left on, every newly-registered organization gets a full paid plan for free instead of the normal 5-day trial (see `src/lib/billing/dev-mode.ts` for the exact behavior). |
| `PAYMENT_*` (5 variables) | No (pre-existing) | Recommended | Unchanged by this release |

**No other new environment variables are needed.** The Department module itself
(`Department`, `OrgUnitType`, the new `departmentId` FKs, `AuditLog`) is pure schema +
application logic — it doesn't read any new configuration.

## 5. Breaking schema changes and required deployment ordering

Everything the Department Foundation phase changed, and its blast radius (fully detailed
with per-object login/registration impact analysis in `PRODUCTION_DEPLOYMENT_INCIDENT.md`
§3, restated here as the deployment-relevant summary):

- **New table:** `Department` (self-referencing, `OrgUnitType` enum).
- **New table:** `AuditLog` — added in the same commit, **not present in any migration
  file** (only in `schema.prisma` / applied via prior `db push`).
- **New columns:** `Employee.departmentId`, `Budget.departmentId` (both nullable FKs to
  `Department`).
- **Dropped columns:** `Employee.department`, `Budget.department` (the old free-text
  fields) — **this is the one genuinely breaking, ordering-sensitive change.** Old
  application code still reads/writes `Employee.department` as a plain string; if that code
  is still serving traffic at the moment the `DROP COLUMN` runs, every request touching an
  Employee record starts failing immediately.

**Required ordering, as a direct consequence:**

1. Deploy new code, but do **not** yet run `db push` — the new Prisma Client will be
   ahead of the database at this point, which is fine as long as the *previous* process
   is still the one actually serving requests.
2. Stop the old process (or drain its traffic) — this is the moment old code stops
   depending on `Employee.department`/`Budget.department` existing.
3. **Then** run `DATA_DIR=<mount path> npx prisma db push` — this is when the `DROP
   COLUMN` is safe to execute, because nothing still-running needs those columns.
4. Start the new process.

Running `db push` **before** step 2 (proactively, ahead of stopping old code) is the
specific mistake to avoid for this release — it's fine for purely additive schema changes
in general, but not for this one, because of the two dropped columns.

## 6. Deployment checklist

Run in order. Each step assumes the persistent-disk-host pattern (`DATA_DIR`) already in
use — adjust paths for your actual host.

- [ ] **Back up the database file** before touching anything: `cp $DATA_DIR/dev.db
      $DATA_DIR/dev.db.bak-$(date +%Y%m%d%H%M%S)`.
- [ ] Confirm `DEV_SUBSCRIPTION_MODE` is **not** `"true"` in the production environment
      (§4) — check explicitly, don't assume, since it's a new variable this release
      introduces.
- [ ] Confirm `SESSION_SECRET`, `DATA_DIR`, and the `PAYMENT_*` variables are already set
      correctly in the production environment (unchanged by this release, but worth
      confirming as part of the same pass).
- [ ] Confirm the production host's Node version matches `.nvmrc` (**24.16.0**) — a
      mismatch causes `better-sqlite3` (a native module) to fail with a
      `NODE_MODULE_VERSION` error on the first database query, while pages that don't
      touch the database keep rendering fine (documented in `README.md`, and the same
      failure signature investigated in `PRODUCTION_DEPLOYMENT_INCIDENT.md`).
- [ ] Deploy the new code (`git pull` / redeploy artifact), run `npm ci` (this runs
      `postinstall: prisma generate` automatically, regenerating the Client to match the
      new `schema.prisma`) and `npm run build`.
- [ ] **Do not restart the running process yet.** The old process should keep serving
      traffic on the old schema until the next two steps are done (§5's ordering
      requirement).
- [ ] Stop the old process / drain its traffic.
- [ ] Run `DATA_DIR=<mount path> npx prisma db push` — this is the step that must not be
      skipped, and must happen here, not earlier. Confirm it reports the expected schema
      changes (new `Department`/`AuditLog` tables, new `departmentId` columns, the two
      dropped `department` string columns) before proceeding.
- [ ] Start the new process (`npm start`, or the equivalent under your process manager).
- [ ] **Health check** — don't just confirm the server is up; exercise something that
      actually queries the database, since a schema mismatch leaves static/public pages
      (like `/login`'s GET) rendering fine while every database-touching action 500s. At
      minimum: submit a login attempt (even with a deliberately wrong password) and
      confirm a normal `{error: "Invalid email or password."}` response, not a 500.
- [ ] Spot-check the new functionality specifically: `/hrms/departments` loads and lists
      departments; creating a department works; a fresh org registration (`/register`)
      succeeds end-to-end (this exercises the `AuditLog` write path, which has no test
      coverage of its own at the schema-application level — see below).
- [ ] Confirm `DEV_SUBSCRIPTION_MODE`'s effect matches what was intended in step 2 by
      actually registering a test organization and checking whether it lands on a 5-day
      trial or a full plan.

## 7. Rollback plan

Because this release's schema changes are additive-plus-two-drops rather than a wholesale
rewrite, a straightforward code+database rollback pair stays consistent:

1. **If the health check in §6 fails** (500s on database-touching actions, wrong
   trial/plan behavior, or anything else unexpected): stop the new process immediately —
   don't leave it serving broken requests while diagnosing.
2. **Restore the database backup** taken in §6's first step: `cp
   $DATA_DIR/dev.db.bak-<timestamp> $DATA_DIR/dev.db`.
3. **Redeploy the previous code version** (`git checkout <previous commit>` or the
   equivalent artifact rollback), `npm ci`, `npm run build`.
4. **Restart the process** on the restored database and previous code. Because the backup
   was taken immediately before any schema change, and the previous code was the last
   thing that actually ran successfully against that exact schema, this pairing is
   guaranteed consistent — there's no partial-migration state to reconcile.
5. **Re-run the health check** from §6 against the rolled-back state to confirm recovery
   before considering the incident closed.
6. **Diagnose from the redacted production error digest** — Next.js hides the real
   stack trace from the browser in production; the full error (including the exact
   missing table/column, if that's the cause) is in the server process's own stdout/stderr
   (`pm2 logs`, `journalctl`, or wherever it's captured). This is the single fastest way to
   distinguish a schema issue from a Node/native-module issue from something else —
   detailed diagnostic reasoning already available in `PRODUCTION_DEPLOYMENT_INCIDENT.md`
   if needed.

**What rollback does *not* need to worry about:** no data migration/backfill logic runs
as part of this release's `db push` beyond the schema shape itself (the Department phase's
backfill — populating `Department` rows from the old free-text strings — already ran
against this project's database in the past, as part of getting to today's `schema.prisma`
state; it is not part of *this* deploy). A rollback here is a clean schema-and-code pair
swap, not an attempt to undo a data transformation.

---

No code, schema, or migrations were changed to produce this document.
