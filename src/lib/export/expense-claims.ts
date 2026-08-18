import type { getExpenseClaims } from "@/lib/queries/finance";
import { titleCase } from "@/lib/format";
import type { ExportColumn } from "@/lib/export/workbook";

export type ExpenseClaimExportRow = Awaited<ReturnType<typeof getExpenseClaims>>[number];

export const expenseClaimExportColumns: ExportColumn<ExpenseClaimExportRow>[] = [
  { header: "Claim Number", value: (c) => c.claimNumber },
  { header: "Employee", value: (c) => c.employee.name },
  { header: "Department", value: (c) => c.employee.department?.name ?? "—" },
  { header: "Category", value: (c) => titleCase(c.category) },
  { header: "Description", value: (c) => c.description },
  { header: "Amount", value: (c) => c.amount },
  { header: "Expense Date", value: (c) => c.expenseDate, numFmt: "dd-mmm-yyyy" },
  { header: "Status", value: (c) => titleCase(c.status) },
  { header: "Approved By", value: (c) => c.decidedByName ?? "—" },
  { header: "Approved Date", value: (c) => c.decidedOn, numFmt: "dd-mmm-yyyy" },
];
