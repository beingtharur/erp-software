import type { getClientsForExport } from "@/lib/queries/crm";
import { titleCase } from "@/lib/format";
import type { ExportColumn } from "@/lib/export/workbook";

export type ClientExportRow = Awaited<ReturnType<typeof getClientsForExport>>[number];

export const clientExportColumns: ExportColumn<ClientExportRow>[] = [
  { header: "Client Name", value: (c) => c.name },
  { header: "Industry", value: (c) => titleCase(c.industry) },
  { header: "Tier", value: (c) => c.tier },
  { header: "City", value: (c) => c.city },
  { header: "State", value: (c) => c.state },
  { header: "Contact Name", value: (c) => c.contactName },
  { header: "Contact Title", value: (c) => c.contactTitle },
  { header: "Contact Email", value: (c) => c.contactEmail },
  { header: "Contact Phone", value: (c) => c.contactPhone },
  { header: "Status", value: (c) => c.status },
  { header: "Leads Count", value: (c) => c._count.leads },
  { header: "Projects Count", value: (c) => c._count.projects },
  { header: "Created Date", value: (c) => c.createdAt, numFmt: "dd-mmm-yyyy" },
];
