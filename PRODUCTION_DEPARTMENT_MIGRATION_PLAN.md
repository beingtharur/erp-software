# Production Department Migration — Executable Sequence

Date: 09 Aug 2026. Status: **ready to execute.** Confirmed via raw terminal output (not a
summary) showing the real `PRAGMA table_info` results, `.tables`, row counts, and
`git show 45f8976:prisma/schema.prisma` matching this repo's actual schema verbatim.

**Important finding from the confirmed output: code is already deployed ahead of the
database.** The running process is on commit `45f8976` (which expects `Department` and
`departmentId`), but the database is still on the old schema (`department TEXT NOT NULL`,
no `Department` table). This means production is very likely serving errors on every
database-touching request right now — the `curl` 307 redirect that was reported as "healthy"
only proves the login *page* loads, not that login *works* (same pattern as the original
500 diagnosis: public/redirect routes never touch the database). Treat this as active,
not hypothetical — the priority is closing this gap correctly, not slowly.

Confirmed facts used below:
- Repo: `/home/ubuntu/app`
- Database: `/home/ubuntu/data/dev.db`
- Employee rows: 44, Budget rows: 8
- Employee distinct `department` values (24): Leadership, Projects, Process Engineering,
  Piping & Design, Containment Systems, Sales — West, Sales — Gujarat, Sales — South,
  Sales — North, Installation, Service & Maintenance, Human Resources, Finance & Accounts,
  Administration, Procurement, xdtfchjbnk, Software Development, Computer Programming,
  Computer repair, HR Department, Employee Management, Finance, Field Operations, Management
- Budget distinct `department` values (6, all subset of the above): Administration,
  Containment Systems, Human Resources, Process Engineering, Sales — West, Service &
  Maintenance
- No `Department` table exists yet; neither table has a `departmentId` column yet

---

## Step 0 — confirm the process manager (one unknown left)

Not yet confirmed from raw output. Run this before anything else — it determines the
restart command later:

```bash
sudo systemctl list-units --type=service --all 2>/dev/null | grep -iE 'node|next|eos|ops|hrm'
command -v pm2 >/dev/null && pm2 list
ps aux | grep -i "[n]ext start"
```

Use whatever this reveals in place of `<service-name>` further down.

## Step 1 — fresh backup (don't rely on any previously-claimed backup)

```bash
BACKUP="/home/ubuntu/data/dev.db.bak-$(date +%Y%m%d%H%M%S)"
cp /home/ubuntu/data/dev.db "$BACKUP"
ls -la "$BACKUP"
echo "Backup: $BACKUP"
```

## Step 2 — create the Department table and the two new foreign key columns

Purely additive — safe even though the app is currently running (broken or not) against
this database:

```bash
sqlite3 /home/ubuntu/data/dev.db <<'SQL'
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "headId" TEXT,
    "parentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Department_organizationId_code_key" ON "Department"("organizationId", "code");
CREATE INDEX "Department_organizationId_isActive_idx" ON "Department"("organizationId", "isActive");
CREATE INDEX "Department_parentId_idx" ON "Department"("parentId");

ALTER TABLE "Employee" ADD COLUMN "departmentId" TEXT REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD COLUMN "departmentId" TEXT REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
SQL
```

## Step 3 — create Department records from the existing text values, per organization

```bash
sqlite3 /home/ubuntu/data/dev.db <<'SQL'
INSERT INTO "Department" ("id", "organizationId", "name", "code", "isActive", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(16))),
    src."organizationId",
    src."name",
    'DEPT-' || printf('%03d', ROW_NUMBER() OVER (PARTITION BY src."organizationId" ORDER BY src."name")),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "organizationId", "department" AS "name"
      FROM "Employee"
     WHERE "department" IS NOT NULL AND trim("department") <> ''
    UNION
    SELECT DISTINCT e."organizationId", b."department" AS "name"
      FROM "Budget" b
      JOIN "Employee" e ON e."id" = b."requestedById"
     WHERE b."department" IS NOT NULL AND trim(b."department") <> ''
) src;
SQL
```

## Step 4 — backfill `Employee.departmentId`

```bash
sqlite3 /home/ubuntu/data/dev.db <<'SQL'
UPDATE "Employee"
   SET "departmentId" = (
       SELECT d."id" FROM "Department" d
        WHERE d."organizationId" = "Employee"."organizationId"
          AND d."name" = "Employee"."department"
   )
 WHERE "department" IS NOT NULL AND trim("department") <> '';
SQL
```

## Step 5 — backfill `Budget.departmentId`

```bash
sqlite3 /home/ubuntu/data/dev.db <<'SQL'
UPDATE "Budget"
   SET "departmentId" = (
       SELECT d."id" FROM "Department" d
       JOIN "Employee" e ON e."id" = "Budget"."requestedById"
        WHERE d."organizationId" = e."organizationId"
          AND d."name" = "Budget"."department"
   )
 WHERE "department" IS NOT NULL AND trim("department") <> '';
SQL
```

## Step 6 — validation queries

```bash
sqlite3 -header -column /home/ubuntu/data/dev.db <<'SQL'
SELECT 'Employee total (must be 44)' AS check_name, COUNT(*) AS value FROM Employee
UNION ALL
SELECT 'Budget total (must be 8)', COUNT(*) FROM Budget
UNION ALL
SELECT 'Employees unmapped (must be 0)', COUNT(*) FROM Employee
 WHERE department IS NOT NULL AND trim(department) <> '' AND departmentId IS NULL
UNION ALL
SELECT 'Budgets unmapped (must be 0)', COUNT(*) FROM Budget
 WHERE department IS NOT NULL AND trim(department) <> '' AND departmentId IS NULL
UNION ALL
SELECT 'Department rows created', COUNT(*) FROM Department;
SQL

sqlite3 -header -column /home/ubuntu/data/dev.db <<'SQL'
SELECT d.organizationId, d.name, d.code, COUNT(e.id) AS employee_count
  FROM Department d LEFT JOIN Employee e ON e.departmentId = d.id
 GROUP BY d.id ORDER BY d.organizationId, d.name;
SQL
```

**STOP — read the output before continuing.** Required: Employee total = 44, Budget total
= 8, both "unmapped" checks = 0. Expect ~24 Department rows including odd ones like
`xdtfchjbnk` and `Computer repair` — that's correct (the migration's job is structural
correctness, not data cleanup; rename those later through the UI). If any required number
is wrong, go straight to the rollback in Step 9 and stop.

## Step 7 — restart and verify the app is actually healthy now

```bash
sudo systemctl restart <service-name>   # from Step 0
sleep 2
sudo systemctl status <service-name> --no-pager
curl -sI http://localhost:3000/login | head -5
```

Then functionally confirm: log in with a real account (no 500), submit a throwaway test
registration, and load `/hrms/departments`, `/hrms/employees`, `/hrms/payroll`, and a
Projects page.

**STOP here too.** Do not run Step 8 until every one of those genuinely works.

## Step 8 — drop the old text columns (only after Step 7 passes)

```bash
sqlite3 /home/ubuntu/data/dev.db <<'SQL'
DROP INDEX IF EXISTS "Budget_department_category_idx";
ALTER TABLE "Employee" DROP COLUMN "department";
ALTER TABLE "Budget" DROP COLUMN "department";
CREATE INDEX "Budget_departmentId_category_idx" ON "Budget"("departmentId", "category");
SQL
```

This is optional cleanup, not a functionality requirement — the app already works
correctly after Step 7 with the old columns just sitting there unused. Do it once you're
comfortable, not under time pressure.

## Step 9 — rollback (if Step 6 or Step 7 fails)

```bash
sudo systemctl stop <service-name>
cp "$BACKUP" /home/ubuntu/data/dev.db
cd /home/ubuntu/app && git log -1 --format="%H"   # note current commit for reference
sudo systemctl start <service-name>
curl -sI http://localhost:3000/login | head -5
```

Since Step 8 (the only irreversible step) is gated behind a confirmed-healthy Step 7, a
rollback before that point is just restoring the Step 1 backup and restarting — no code
rollback needed, since the deployed code was never the problem, the schema gap was.

## Step 10 — reconcile Prisma's migration tracking

```bash
cd /home/ubuntu/app && npx prisma migrate status
```

Read the output. If `20260805120000_department_master_data` and
`20260805170000_department_unit_type` show as pending, mark them applied (you just ran
their SQL by hand) rather than letting a future `migrate deploy` try to rerun them:

```bash
npx prisma migrate resolve --applied 20260805120000_department_master_data
npx prisma migrate resolve --applied 20260805170000_department_unit_type
```
