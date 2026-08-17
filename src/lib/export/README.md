# How to add a new Excel export

This is the pattern Employee Export established. Follow it exactly for
Attendance/Payroll/Vendors/Purchase Orders/Quotations — the goal is that
every future report is a small, mechanical addition, not a redesign.

## 1. Reuse an existing query — don't write a new one

Every export must read from the *same* query function that already powers
the corresponding list page (e.g. `getEmployees()` for `/hrms/employees`).
This keeps one source of truth for what a record looks like — the exported
file can never drift from what's already on screen. If no suitable query
exists yet for the report you're adding, that's a sign the list page itself
is missing one too; add it there first, not export-only.

## 2. Define columns in their own file — `src/lib/export/<report>.ts`

```ts
import type { get<Report> } from "@/lib/queries/<module>";
import type { ExportColumn } from "@/lib/export/workbook";

export type <Report>ExportRow = Awaited<ReturnType<typeof get<Report>>>[number];

export const <report>ExportColumns: ExportColumn<<Report>ExportRow>[] = [
  { header: "Column Label", value: (row) => row.someField },
  // For a Date value, add numFmt so Excel treats it as a real, sortable date:
  { header: "Some Date", value: (row) => row.someDate, numFmt: "dd-mmm-yyyy" },
];
```

Nothing in this file fetches data — it's a pure mapping from a row shape to
Excel columns. Keep it that way; it's what stops `workbook.ts` (the one
truly shared piece) from ever needing report-specific logic.

## 3. Route handler — `src/app/api/exports/<report>/route.ts`

```ts
import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { get<Report> } from "@/lib/queries/<module>";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { <report>ExportColumns } from "@/lib/export/<report>";
import { logExport } from "@/lib/export/audit";

export async function GET(request: NextRequest) {
  // Use the EXACT SAME requireRole/requireModuleAccess calls as the page
  // this export mirrors — never invent a new permission for an export.
  // Exports inherit the access rules of the data they expose, nothing more.
  await requireRole([...]);
  await requireModuleAccess("...");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  let rows = await get<Report>(user.organizationId!);

  // Read any query-string filters even if the UI doesn't expose them yet —
  // every export route should accept ?filter=value from day one, so adding
  // the actual UI control later never means touching the route.
  const someFilter = request.nextUrl.searchParams.get("someFilter");
  if (someFilter) rows = rows.filter((r) => /* ... */);

  // After the permission gate, before the response — only genuinely-authorized,
  // actually-served downloads get recorded. Never skip this: it's how "who
  // downloaded the employee/payroll database?" gets answered later.
  await logExport({
    report: "<report>",
    organizationId: user.organizationId!,
    userId: user.id,
    filters: someFilter ? { someFilter } : undefined,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: "<Report> Report",
    organizationName: organization.name,
    sheetName: "<Report>",
    columns: <report>ExportColumns,
    rows,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename("<report>")}"`,
    },
  });
}
```

## 4. Metadata header — automatic, don't reimplement it

`buildReportWorkbook()` always writes the same 5-row header block (product
name, `Organization: {name}`, report title, generated timestamp, blank
separator) before your column headers — this is why `reportTitle` and
`organizationName` are required params, not optional. Never write a report
that skips this or does its own header formatting.

## 5. Filename — always via `buildExportFilename()`

`buildExportFilename("employees")` → `employees-2026-08-17.xlsx`. Pick a
short, lowercase, hyphen-free `reportKey` that matches the route segment.
Never hardcode a filename string in a route handler.

## 6. Add the download link to the corresponding list page

A plain anchor, not a fetch/blob dance — the browser handles the download
natively from the `Content-Disposition` header:

```tsx
<Button variant="outline" nativeButton={false} render={<a href="/api/exports/<report>" />}>
  <Download />
  Export to Excel
</Button>
```

## 7. Verify before calling it done

- Round-trip the generated buffer through `exceljs`'s own reader and print
  the rows back — don't just trust that `writeBuffer()` didn't throw.
- Log in as a role that *should* be blocked and confirm the request
  redirects (to `/access-denied` or `/login`), not that it silently 200s.
- Log in as a role that *should* have access and confirm the file opens
  and contains the right organization's data only.
