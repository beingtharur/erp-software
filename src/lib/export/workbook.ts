import ExcelJS from "exceljs";

// The one generic, shared piece every report reuses — everything
// report-specific (columns, data source) lives in its own file under
// src/lib/export/ instead of here, so this stays a pure builder.

export type ExportColumn<T> = {
  header: string;
  width?: number;
  /** e.g. "dd-mmm-yyyy" for a Date value — lets Excel treat it as a real,
   * sortable date rather than a plain string. */
  numFmt?: string;
  value: (row: T) => string | number | Date | null;
};

export async function buildReportWorkbook<T>(params: {
  reportTitle: string;
  organizationName: string;
  sheetName: string;
  columns: ExportColumn<T>[];
  rows: T[];
  generatedAt?: Date;
  /** Extra lines between the metadata block and the column headers — e.g.
   * client/date/status info for a single-record "document" style export
   * (Customer Quotation Document) or a totals summary section (Salary
   * Register). Omit for a plain register/list export. */
  extraHeaderLines?: string[];
  /** Lines appended after the data rows — e.g. a bolded "Total: ₹X" line.
   * Omit for a plain register/list export. */
  footerLines?: string[];
}): Promise<Buffer> {
  const {
    reportTitle,
    organizationName,
    sheetName,
    columns,
    rows,
    generatedAt = new Date(),
    extraHeaderLines,
    footerLines,
  } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Exist Digitally — Ops Platform";
  workbook.created = generatedAt;

  const sheet = workbook.addWorksheet(sheetName);

  // Metadata header block — product name, tenant, report title, timestamp —
  // so a downloaded file is self-identifying once it's been emailed around
  // or sitting in someone's Downloads folder next to a dozen others.
  sheet.addRow(["Exist Digitally — Ops Platform"]).font = { bold: true, size: 13 };
  sheet.addRow([`Organization: ${organizationName}`]).font = { bold: true };
  sheet.addRow([reportTitle]).font = { bold: true, size: 12 };
  sheet.addRow([`Generated: ${formatGeneratedAt(generatedAt)}`]).font = { italic: true, color: { argb: "FF666666" } };
  for (const line of extraHeaderLines ?? []) {
    sheet.addRow([line]);
  }
  sheet.addRow([]);

  const headerRow = sheet.addRow(columns.map((c) => c.header));
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    cell.border = { bottom: { style: "thin" } };
  });

  for (const row of rows) {
    const dataRow = sheet.addRow(columns.map((c) => c.value(row) ?? ""));
    columns.forEach((c, i) => {
      if (c.numFmt) dataRow.getCell(i + 1).numFmt = c.numFmt;
    });
  }

  for (const line of footerLines ?? []) {
    sheet.addRow([line]).font = { bold: true };
  }

  sheet.columns.forEach((col, i) => {
    col.width = columns[i]?.width ?? Math.max(columns[i]?.header.length ?? 10, 14);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function formatGeneratedAt(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** employees-2026-08-17.xlsx — standardized across every report. */
export function buildExportFilename(reportKey: string, date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${reportKey}-${y}-${m}-${d}.xlsx`;
}
