-- Adds the org-unit level to Department so the same self-referencing tree can
-- represent Business Units, Divisions, Branches, Plants, Sections and Teams —
-- not just departments — without a second entity or another migration later.
--
-- Additive and non-destructive: every existing row becomes a DEPARTMENT, which
-- is what it already was.
ALTER TABLE "Department" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'DEPARTMENT';
