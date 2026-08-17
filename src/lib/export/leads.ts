import type { getLeadsForExport } from "@/lib/queries/crm";
import { titleCase } from "@/lib/format";
import type { ExportColumn } from "@/lib/export/workbook";

export type LeadExportRow = Awaited<ReturnType<typeof getLeadsForExport>>[number];

export const leadExportColumns: ExportColumn<LeadExportRow>[] = [
  { header: "Lead Title", value: (l) => l.title },
  { header: "Client", value: (l) => l.client.name },
  { header: "Source", value: (l) => titleCase(l.source) },
  { header: "Product Line", value: (l) => titleCase(l.productLine) },
  { header: "Stage", value: (l) => titleCase(l.stage) },
  { header: "Value", value: (l) => l.value },
  { header: "Probability %", value: (l) => l.probability },
  { header: "Expected Close Date", value: (l) => l.expectedCloseDate, numFmt: "dd-mmm-yyyy" },
  { header: "Owner", value: (l) => l.owner.name },
  { header: "Created Date", value: (l) => l.createdAt, numFmt: "dd-mmm-yyyy" },
];
