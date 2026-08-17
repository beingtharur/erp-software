-- Departments become organization-scoped master data instead of a free-text
-- string repeated on every employee and budget.
--
-- Hand-written rather than generated because the existing strings carry real
-- meaning ("Installation", "Service & Maintenance", …) and must survive: this
-- creates one Department per distinct (organization, name) pair, repoints
-- Employee and Budget at it, and only then drops the old columns.

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "headId" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_code_key" ON "Department"("organizationId", "code");
CREATE INDEX "Department_organizationId_isActive_idx" ON "Department"("organizationId", "isActive");
CREATE INDEX "Department_parentId_idx" ON "Department"("parentId");

-- AlterTable: add the foreign keys alongside the existing strings
ALTER TABLE "Employee" ADD COLUMN "departmentId" TEXT REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD COLUMN "departmentId" TEXT REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one Department per distinct (organization, name), drawn from both
-- employees and budgets so a budget for a department nobody currently works in
-- still resolves. Codes are auto-assigned per organization and editable in the
-- UI afterwards; deriving them from the names would collide (for example
-- "Sales — West" and "Sales — South" both reduce to "SALES").
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

-- Repoint employees at their department
UPDATE "Employee"
   SET "departmentId" = (
       SELECT d."id"
         FROM "Department" d
        WHERE d."organizationId" = "Employee"."organizationId"
          AND d."name" = "Employee"."department"
   )
 WHERE "department" IS NOT NULL AND trim("department") <> '';

-- Repoint budgets, resolving the organization through the requesting employee
-- (Budget has no organizationId of its own).
UPDATE "Budget"
   SET "departmentId" = (
       SELECT d."id"
         FROM "Department" d
         JOIN "Employee" e ON e."id" = "Budget"."requestedById"
        WHERE d."organizationId" = e."organizationId"
          AND d."name" = "Budget"."department"
   )
 WHERE "department" IS NOT NULL AND trim("department") <> '';

-- DropIndex (references the column about to be dropped)
DROP INDEX "Budget_department_category_idx";

-- AlterTable: the strings are now redundant
ALTER TABLE "Employee" DROP COLUMN "department";
ALTER TABLE "Budget" DROP COLUMN "department";

-- CreateIndex
CREATE INDEX "Budget_departmentId_category_idx" ON "Budget"("departmentId", "category");
