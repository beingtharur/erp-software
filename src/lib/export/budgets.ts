import type { getBudgets } from "@/lib/queries/finance";
import { titleCase } from "@/lib/format";
import type { ExportColumn } from "@/lib/export/workbook";

export type BudgetExportRow = Awaited<ReturnType<typeof getBudgets>>[number];

export const budgetExportColumns: ExportColumn<BudgetExportRow>[] = [
  { header: "Department", value: (b) => b.department?.name ?? "—" },
  { header: "Category", value: (b) => titleCase(b.category) },
  { header: "Proposed Amount", value: (b) => b.proposedAmount },
  { header: "Utilized Amount", value: (b) => b.spent },
  { header: "Remaining Amount", value: (b) => b.proposedAmount - b.spent },
  { header: "Start Date", value: (b) => b.startDate, numFmt: "dd-mmm-yyyy" },
  { header: "End Date", value: (b) => b.endDate, numFmt: "dd-mmm-yyyy" },
  { header: "Status", value: (b) => titleCase(b.status) },
  { header: "Requested By", value: (b) => b.requestedBy.name },
];
